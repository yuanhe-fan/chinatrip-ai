import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import { SendMessageResponse } from "@/lib/api/types";
import { getCurrentIdentity } from "@/lib/auth/current-identity";
import { generateTravelAnswer, AiProviderError } from "@/lib/ai";
import { TRAVEL_ANSWER_PROMPT_VERSION } from "@/lib/ai/prompts/travel-answer";
import { createGenerationMetadata } from "@/lib/messages/metadata";
import { mergeCompletionStatusMetadata } from "@/lib/ai/completion-status";
import { prisma } from "@/lib/prisma";
import { invalidateChatHistoryCacheForRecord } from "@/lib/cache/redis";
import {
  getFastPathAnswer,
  isRecord,
  isUniqueSequenceError,
  isUuid,
  prepareMessageGeneration,
  resolveMessageGenerationMetadata,
  resolveQuickSubQuestionMetadata,
  serializeAssistantMessage,
  serializeUserMessage,
  toChatMessageRecord,
} from "@/lib/chat/message-generation";

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

export async function POST(request: Request, context: RouteContext) {
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

  try {
    const identity = await getCurrentIdentity();
    const prepared = await prepareMessageGeneration({
      chatId,
      identity,
      message,
      metadata: resolveMessageGenerationMetadata(
        body,
        quickSubQuestionMetadata.metadata,
      ),
    });

    if ("chatNotFound" in prepared) {
      return apiError(
        "CHAT_NOT_FOUND",
        "Chat not found.",
        404,
        process.env.NODE_ENV === "development"
          ? prepared.diagnostics
          : undefined,
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

    try {
      const fastPathAnswer = getFastPathAnswer(prepared.userMessage.content);

      if (fastPathAnswer) {
        const generationMetadata = createGenerationMetadata(
          prepared.userMessage.metadata,
        );
        const assistantMessage = toChatMessageRecord(
          await prisma.message.update({
            where: {
              id: prepared.assistantMessage.id,
            },
            data: {
              status: "complete",
              content: fastPathAnswer,
              errorCode: null,
              errorMessage: null,
              metadata: generationMetadata
                ? {
                    fastPath: true,
                    ...generationMetadata,
                  }
                : {
                    fastPath: true,
                  },
            },
          }),
        );

        await prisma.$transaction([
          prisma.aiUsageLog.create({
            data: {
              chatId: prepared.chat.id,
              messageId: assistantMessage.id,
              provider: "mock",
              model: "fast-path-v1",
              promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
              inputTokens: null,
              outputTokens: null,
              latencyMs: 0,
              success: true,
              fallbackUsed: false,
              metadata: {
                fastPath: true,
              },
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

        const response: SendMessageResponse = {
          userMessage: serializeUserMessage(prepared.userMessage),
          assistantMessage: serializeAssistantMessage(assistantMessage),
          usage: {
            provider: "mock",
            model: "fast-path-v1",
            promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
            inputTokens: null,
            outputTokens: null,
            latencyMs: 0,
            fallbackUsed: false,
          },
        };

        return NextResponse.json(response);
      }

      const aiResult = await generateTravelAnswer({
        chatId: prepared.chat.id,
        userMessage: prepared.userMessage.content,
        language: prepared.chat.language,
        history: prepared.history,
        metadata: createGenerationMetadata(prepared.userMessage.metadata),
      });
      const now = new Date();
      const aiResultMetadata = mergeCompletionStatusMetadata(
        aiResult.metadata,
        aiResult.content,
      );
      const assistantMessage = toChatMessageRecord(
        await prisma.message.update({
          where: {
            id: prepared.assistantMessage.id,
          },
          data: {
            status: "complete",
            content: aiResult.content,
            errorCode: null,
            errorMessage: null,
            metadata: aiResultMetadata as Prisma.InputJsonValue,
          },
        }),
      );

      await prisma.$transaction([
        prisma.aiUsageLog.create({
          data: {
            chatId: prepared.chat.id,
            messageId: assistantMessage.id,
            provider: aiResult.provider,
            model: aiResult.model,
            promptVersion: aiResult.promptVersion,
            inputTokens: aiResult.inputTokens,
            outputTokens: aiResult.outputTokens,
            latencyMs: aiResult.latencyMs,
            success: true,
            fallbackUsed: aiResult.fallbackUsed,
            metadata: aiResultMetadata as Prisma.InputJsonValue,
          },
        }),
        prisma.chat.update({
          where: {
            id: prepared.chat.id,
          },
          data: {
            lastMessageAt: now,
          },
        }),
      ]);
      await invalidateChatHistoryCacheForRecord(prepared.chat);

      const response: SendMessageResponse = {
        userMessage: serializeUserMessage(prepared.userMessage),
        assistantMessage: serializeAssistantMessage(assistantMessage),
        usage: {
          provider: aiResult.provider,
          model: aiResult.model,
          promptVersion: aiResult.promptVersion,
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          latencyMs: aiResult.latencyMs,
          fallbackUsed: aiResult.fallbackUsed,
        },
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error("Failed to generate chat answer", error);

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

      const response: SendMessageResponse = {
        userMessage: serializeUserMessage(prepared.userMessage),
        assistantMessage: serializeAssistantMessage(assistantMessage),
        usage,
      };

      return NextResponse.json(response);
    }
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

    console.error("Failed to send chat message", error);

    return apiError("INTERNAL_ERROR", "Failed to send message.", 500);
  }
}
