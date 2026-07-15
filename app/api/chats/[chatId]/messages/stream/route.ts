import { Prisma } from "@prisma/client";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import { SendMessageResponse, StreamMessageEvent } from "@/lib/api/types";
import { getCurrentIdentity } from "@/lib/auth/current-identity";
import { AiProviderError, streamTravelAnswer } from "@/lib/ai";
import { TRAVEL_ANSWER_PROMPT_VERSION } from "@/lib/ai/prompts/travel-answer";
import { createGenerationMetadata } from "@/lib/messages/metadata";
import { mergeCompletionStatusMetadata } from "@/lib/ai/completion-status";
import { prisma } from "@/lib/prisma";
import { invalidateChatHistoryCacheForRecord } from "@/lib/cache/redis";
import { createServerTiming, logPerformance } from "@/lib/performance/server-timing";
import {
  getFastPathAnswer,
  isRecord,
  isUniqueSequenceError,
  isUuid,
  prepareMessageGeneration,
  resolveMessageGenerationMetadata,
  resolveQuickSubQuestionMetadata,
  serializeAssistantMessage,
  serializePendingAssistantMessage,
  serializeUserMessage,
  toChatMessageRecord,
} from "@/lib/chat/message-generation";
import type { StreamTravelAnswerDone } from "@/lib/ai/types";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

function createUnknownUsage(error: unknown) {
  return {
    provider: error instanceof AiProviderError ? error.provider : ("mock" as const),
    model: "unknown",
    promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
    inputTokens: null,
    outputTokens: null,
    latencyMs: null,
    fallbackUsed: false,
  };
}

function getAiErrorCode(error: unknown) {
  return error instanceof AiProviderError
    ? error.code
    : "AI_PROVIDER_ERROR";
}

function getAiErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Failed to generate answer.";
}

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: StreamMessageEvent,
) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

async function persistSuccessfulAnswer({
  chatId,
  assistantMessageId,
  content,
  provider,
  model,
  promptVersion,
  inputTokens,
  outputTokens,
  latencyMs,
  fallbackUsed,
  metadata,
}: {
  chatId: string;
  assistantMessageId: string;
  content: string;
  provider: "mock" | "doubao" | "deepseek";
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  fallbackUsed: boolean;
  metadata?: Prisma.InputJsonValue;
}) {
  const assistantMessage = toChatMessageRecord(
    await prisma.message.update({
      where: {
        id: assistantMessageId,
      },
      data: {
        status: "complete",
        content,
        errorCode: null,
        errorMessage: null,
        metadata,
      },
    }),
  );

  await prisma.$transaction([
    prisma.aiUsageLog.create({
      data: {
        chatId,
        messageId: assistantMessage.id,
        provider,
        model,
        promptVersion,
        inputTokens,
        outputTokens,
        latencyMs,
        success: true,
        fallbackUsed,
        metadata,
      },
    }),
    prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        lastMessageAt: new Date(),
      },
    }),
  ]);

  return assistantMessage;
}

export async function POST(request: Request, context: RouteContext) {
  const requestStartedAt = Date.now();
  const { chatId } = await context.params;

  if (!isUuid(chatId)) {
    return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
  }

  let body: unknown = {};

  try {
    const requestText = await request.text();
    body = requestText ? JSON.parse(requestText) : {};
  } catch {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  if (!isRecord(body)) {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  const hasMessageField = "message" in body;
  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  if (hasMessageField && !message) {
    return apiError("EMPTY_MESSAGE", "Please enter your question.", 400);
  }

  const quickSubQuestionMetadata = resolveQuickSubQuestionMetadata(body, message);

  if (!quickSubQuestionMetadata.ok) {
    return apiError("INVALID_QUICK_QUESTION", "Invalid quick question selection.", 400);
  }

  let prepared: Awaited<ReturnType<typeof prepareMessageGeneration>>;

  try {
    const identity = await getCurrentIdentity();
    prepared = await prepareMessageGeneration({
      chatId,
      identity,
      message,
      metadata: resolveMessageGenerationMetadata(
        body,
        quickSubQuestionMetadata.metadata,
      ),
    });
  } catch (error) {
    if (isUniqueSequenceError(error)) {
      return apiError(
        "MESSAGE_GENERATION_IN_PROGRESS",
        "An answer is already being generated for this chat.",
        409,
      );
    }

    if (isDatabaseUnavailableError(error)) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "Database is unavailable. Please try again later.",
        503,
      );
    }

    console.error("Failed to prepare stream message", error);
    return apiError("INTERNAL_ERROR", "Failed to send message.", 500);
  }

  if ("chatNotFound" in prepared) {
    return apiError(
      "CHAT_NOT_FOUND",
      "Chat not found.",
      404,
      process.env.NODE_ENV === "development" ? prepared.diagnostics : undefined,
    );
  }

  if ("noUnansweredUserMessage" in prepared) {
    return apiError(
      "NO_UNANSWERED_MESSAGE",
      "There is no unanswered user message.",
      409,
    );
  }

  if ("generationInProgress" in prepared) {
    return apiError(
      "MESSAGE_GENERATION_IN_PROGRESS",
      "An answer is already being generated for this chat.",
      409,
    );
  }

  const preparedAt = Date.now();
  const fastPathAnswer = getFastPathAnswer(prepared.userMessage.content);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let firstDeltaAt: number | null = null;

      writeEvent(controller, {
        type: "created",
        userMessage: serializeUserMessage(prepared.userMessage),
        assistantMessage: serializePendingAssistantMessage(
          prepared.assistantMessage,
        ),
      });

      try {
        if (fastPathAnswer) {
          firstDeltaAt = Date.now();
          writeEvent(controller, {
            type: "delta",
            content: fastPathAnswer,
          });

          const totalLatencyMs = Date.now() - requestStartedAt;
          const generationMetadata = createGenerationMetadata(
            prepared.userMessage.metadata,
          );
          const assistantMessage = await persistSuccessfulAnswer({
            chatId: prepared.chat.id,
            assistantMessageId: prepared.assistantMessage.id,
            content: fastPathAnswer,
            provider: "mock",
            model: "fast-path-v1",
            promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
            inputTokens: null,
            outputTokens: null,
            latencyMs: totalLatencyMs,
            fallbackUsed: false,
            metadata: {
              fastPath: true,
              ...(generationMetadata ?? {}),
              requestToPreparedMs: preparedAt - requestStartedAt,
              firstDeltaMs: firstDeltaAt - requestStartedAt,
              totalLatencyMs,
            },
          });
          await invalidateChatHistoryCacheForRecord(prepared.chat);
          logPerformance("chat_stream", {
            prepareMs: preparedAt - requestStartedAt,
            firstDeltaMs: firstDeltaAt - requestStartedAt,
            totalMs: totalLatencyMs,
            fastPath: 1,
          });

          writeEvent(controller, {
            type: "done",
            assistantMessage: serializeAssistantMessage(assistantMessage),
            usage: {
              provider: "mock",
              model: "fast-path-v1",
              promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
              inputTokens: null,
              outputTokens: null,
              latencyMs: totalLatencyMs,
              fallbackUsed: false,
            },
          });
          return;
        }

        let streamedContent = "";
        let finalResult: StreamTravelAnswerDone | null = null;

        for await (const chunk of streamTravelAnswer({
          chatId: prepared.chat.id,
          userMessage: prepared.userMessage.content,
          language: prepared.chat.language,
          history: prepared.history,
          metadata: createGenerationMetadata(prepared.userMessage.metadata),
          signal: request.signal,
        })) {
          if (chunk.type === "delta") {
            firstDeltaAt ??= Date.now();
            streamedContent += chunk.content;
            writeEvent(controller, {
              type: "delta",
              content: chunk.content,
            });
          } else {
            finalResult = chunk;
          }
        }

        if (!finalResult || finalResult.type !== "done") {
          throw new AiProviderError(
            "mock",
            "AI_PROVIDER_EMPTY_RESPONSE",
            "AI provider did not finish the stream.",
          );
        }

        const totalLatencyMs = Date.now() - requestStartedAt;
        const firstDeltaMs =
          firstDeltaAt === null ? null : firstDeltaAt - requestStartedAt;
        const finalContent = finalResult.result.content || streamedContent;
        const finalMetadata = mergeCompletionStatusMetadata(
          finalResult.result.metadata,
          finalContent,
        );
        const assistantMessage = toChatMessageRecord(
          await prisma.message.update({
            where: {
              id: prepared.assistantMessage.id,
            },
            data: {
              status: "complete",
              content: finalContent,
              errorCode: null,
              errorMessage: null,
              metadata: finalMetadata as Prisma.InputJsonValue,
            },
          }),
        );

        await prisma.$transaction([
          prisma.aiUsageLog.create({
            data: {
              chatId: prepared.chat.id,
              messageId: assistantMessage.id,
              provider: finalResult.result.provider,
              model: finalResult.result.model,
              promptVersion: finalResult.result.promptVersion,
              inputTokens: finalResult.result.inputTokens,
              outputTokens: finalResult.result.outputTokens,
              latencyMs: finalResult.result.latencyMs,
              success: true,
              fallbackUsed: finalResult.result.fallbackUsed,
              metadata:
                {
                  ...finalMetadata,
                  requestToPreparedMs: preparedAt - requestStartedAt,
                  firstDeltaMs,
                  totalLatencyMs,
                } as Prisma.InputJsonValue,
            },
          }),
          prisma.chat.update({
            where: {
              id: prepared.chat.id,
            },
            data: {
              lastMessageAt: new Date(),
            },
          }),
        ]);
        await invalidateChatHistoryCacheForRecord(prepared.chat);
        logPerformance("chat_stream", {
          prepareMs: preparedAt - requestStartedAt,
          firstDeltaMs,
          aiMs: finalResult.result.latencyMs,
          totalMs: totalLatencyMs,
          fastPath: 0,
        });

        const usage: SendMessageResponse["usage"] = {
          provider: finalResult.result.provider,
          model: finalResult.result.model,
          promptVersion: finalResult.result.promptVersion,
          inputTokens: finalResult.result.inputTokens,
          outputTokens: finalResult.result.outputTokens,
          latencyMs: totalLatencyMs,
          fallbackUsed: finalResult.result.fallbackUsed,
        };

        writeEvent(controller, {
          type: "done",
          assistantMessage: serializeAssistantMessage(assistantMessage),
          usage,
        });
      } catch (error) {
        console.error("Failed to stream chat answer", error);

        const usage = createUnknownUsage(error);
        const assistantMessage = toChatMessageRecord(
          await prisma.message.update({
            where: {
              id: prepared.assistantMessage.id,
            },
            data: {
              status: "failed",
              content: "",
              errorCode: getAiErrorCode(error),
              errorMessage: getAiErrorMessage(error),
            },
          }),
        );

        await prisma.$transaction([
          prisma.aiUsageLog.create({
            data: {
              chatId: prepared.chat.id,
              messageId: assistantMessage.id,
              provider: usage.provider,
              model: usage.model,
              promptVersion: usage.promptVersion,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              latencyMs: usage.latencyMs,
              success: false,
              fallbackUsed: usage.fallbackUsed,
              errorMessage: assistantMessage.errorMessage,
            },
          }),
          prisma.chat.update({
            where: {
              id: prepared.chat.id,
            },
            data: {
              lastMessageAt: new Date(),
            },
          }),
        ]);
        await invalidateChatHistoryCacheForRecord(prepared.chat);
        logPerformance("chat_stream_error", {
          prepareMs: preparedAt - requestStartedAt,
          totalMs: Date.now() - requestStartedAt,
        });

        writeEvent(controller, {
          type: "error",
          assistantMessage: serializeAssistantMessage(assistantMessage),
          error: {
            code: assistantMessage.errorCode ?? "AI_PROVIDER_ERROR",
            message:
              assistantMessage.errorMessage ?? "Failed to generate answer.",
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "Server-Timing": createServerTiming({
        prepare: preparedAt - requestStartedAt,
      }),
    },
  });
}
