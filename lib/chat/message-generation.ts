import { Prisma } from "@prisma/client";
import {
  CurrentIdentity,
  createChatOwnerWhere,
} from "@/lib/auth/current-identity";
import {
  readAnswerCompletionStatus,
  readAnswerSources,
  readAnswerVisuals,
  readQuickQuestionMenu,
} from "@/lib/messages/metadata";
import {
  parseClarifiedTripContext,
  type ClarifiedTripContext,
} from "@/lib/ai/clarification/schema";
import { findQuickSubQuestion } from "@/lib/quick-questions/menus";
import { isPromptProfile } from "@/lib/quick-questions/profiles";
import { prisma } from "@/lib/prisma";
import type { TravelAnswerMessage } from "@/lib/ai/types";

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CONTENT_LENGTH = 1200;

export type ChatMessageRecord = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  status: "pending" | "complete" | "failed";
  sequence: number;
  content: string;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatOwnerMissDiagnostics = {
  reason: "missing_chat" | "deleted_chat" | "owner_mismatch";
  identityType: "profile" | "anonymous";
  identityOwnerId: string | null;
  chatStatus: string | null;
  chatOwnerType: "profile" | "anonymous" | null;
  chatOwnerId: string | null;
};

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isUniqueSequenceError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function toChatMessageRecord(message: {
  id: string;
  chatId: string;
  role: string;
  status: "pending" | "complete" | "failed";
  sequence: number;
  content: string;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): ChatMessageRecord {
  if (message.role !== "user" && message.role !== "assistant") {
    throw new Error(`Unexpected chat message role: ${message.role}`);
  }

  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    status: message.status,
    sequence: message.sequence,
    content: message.content,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
    metadata: message.metadata,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export function serializeUserMessage(message: ChatMessageRecord) {
  return {
    id: message.id,
    chatId: message.chatId,
    role: "user" as const,
    status: "complete" as const,
    sequence: message.sequence,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export function serializeAssistantMessage(message: ChatMessageRecord) {
  const completionStatus = readAnswerCompletionStatus(message.metadata);

  return {
    id: message.id,
    chatId: message.chatId,
    role: "assistant" as const,
    status:
      message.status === "failed" ? ("failed" as const) : ("complete" as const),
    sequence: message.sequence,
    content: message.content,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
    visuals: readAnswerVisuals(message.metadata),
    sources: readAnswerSources(message.metadata),
    quickQuestionMenu: readQuickQuestionMenu(message.metadata),
    truncated: completionStatus.truncated,
    maybeTruncated: completionStatus.maybeTruncated,
    finishReason: completionStatus.finishReason,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export function serializePendingAssistantMessage(message: ChatMessageRecord) {
  return {
    id: message.id,
    chatId: message.chatId,
    role: "assistant" as const,
    status: "pending" as const,
    sequence: message.sequence,
    content: message.content,
    errorCode: null,
    errorMessage: null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export function toTravelHistory(messages: ChatMessageRecord[]): TravelAnswerMessage[] {
  return messages
    .filter(
      (message) =>
        message.status === "complete" && !readQuickQuestionMenu(message.metadata),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content:
        message.content.length > MAX_HISTORY_CONTENT_LENGTH
          ? `${message.content.slice(0, MAX_HISTORY_CONTENT_LENGTH)}...`
          : message.content,
    }));
}

export function getFastPathAnswer(message: string) {
  const normalized = message.trim().toLowerCase();

  if (!["hello", "hi", "hey", "thanks", "thank you"].includes(normalized)) {
    return null;
  }

  if (normalized === "thanks" || normalized === "thank you") {
    return "You're welcome. Ask me any China travel question when you're ready.";
  }

  return "Hello. Ask me about China travel, payments, trains, apps, food, or local tips.";
}

export function resolveQuickSubQuestionMetadata(
  body: Record<string, unknown>,
  message: string,
) {
  const hasQuickSubQuestionFields =
    "sourceQuestionId" in body || "sourceSubQuestionId" in body;

  if (!hasQuickSubQuestionFields) {
    return {
      ok: true as const,
      metadata: undefined,
    };
  }

  const match = findQuickSubQuestion({
    sourceQuestionId: body.sourceQuestionId,
    sourceSubQuestionId: body.sourceSubQuestionId,
  });

  if (
    !match ||
    body.promptProfile !== match.subQuestion.promptProfile ||
    message !== match.subQuestion.question
  ) {
    return {
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    metadata: {
      source: "quick_question_menu",
      promptProfile: match.subQuestion.promptProfile,
      sourceQuestionId: match.menu.sourceQuestionId,
      sourceSubQuestionId: match.subQuestion.id,
    } satisfies Prisma.InputJsonValue,
  };
}

function createClarificationMetadata(body: Record<string, unknown>):
  | {
      clarificationUsed: true;
      clarifiedTripContext: ClarifiedTripContext;
    }
  | undefined {
  if (body.clarificationUsed !== true) {
    return undefined;
  }

  const parsedContext = parseClarifiedTripContext(body.clarifiedTripContext);

  if (!parsedContext.success) {
    return undefined;
  }

  return {
    clarificationUsed: true,
    clarifiedTripContext: parsedContext.data,
  };
}

export function resolveMessageGenerationMetadata(
  body: Record<string, unknown>,
  quickSubQuestionMetadata?: Prisma.InputJsonValue,
) {
  const clarificationMetadata = createClarificationMetadata(body);
  const promptProfile = isPromptProfile(body.promptProfile)
    ? body.promptProfile
    : undefined;

  if (!quickSubQuestionMetadata && !clarificationMetadata && !promptProfile) {
    return undefined;
  }

  return {
    ...(quickSubQuestionMetadata &&
    typeof quickSubQuestionMetadata === "object" &&
    !Array.isArray(quickSubQuestionMetadata)
      ? quickSubQuestionMetadata
      : {}),
    ...(promptProfile ? { promptProfile } : {}),
    ...(clarificationMetadata ?? {}),
  } satisfies Prisma.InputJsonValue;
}

function getIdentityType(identity: CurrentIdentity): ChatOwnerMissDiagnostics["identityType"] {
  return identity.profile ? "profile" : "anonymous";
}

function getIdentityOwnerId(identity: CurrentIdentity) {
  return identity.profile?.id ?? identity.anonymousSession?.id ?? null;
}

async function getChatOwnerMissDiagnostics({
  tx,
  chatId,
  identity,
}: {
  tx: Prisma.TransactionClient;
  chatId: string;
  identity: CurrentIdentity;
}): Promise<ChatOwnerMissDiagnostics> {
  const chat = await tx.chat.findUnique({
    where: {
      id: chatId,
    },
    select: {
      id: true,
      status: true,
      profileId: true,
      anonymousSessionId: true,
    },
  });
  const reason = !chat
    ? "missing_chat"
    : chat.status === "deleted"
    ? "deleted_chat"
    : "owner_mismatch";

  return {
    reason,
    identityType: getIdentityType(identity),
    identityOwnerId: getIdentityOwnerId(identity),
    chatStatus: chat?.status ?? null,
    chatOwnerType: chat?.profileId
      ? "profile"
      : chat?.anonymousSessionId
      ? "anonymous"
      : null,
    chatOwnerId: chat?.profileId ?? chat?.anonymousSessionId ?? null,
  };
}

function logChatOwnerMiss(chatId: string, diagnostics: ChatOwnerMissDiagnostics) {
  console.warn("chat_message_generation_owner_miss", {
    chatId,
    ...diagnostics,
  });
}

export function prepareMessageGeneration({
  chatId,
  identity,
  message,
  metadata,
}: {
  chatId: string;
  identity: CurrentIdentity;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: {
        id: chatId,
        status: {
          not: "deleted",
        },
        ...createChatOwnerWhere(identity),
      },
      include: {
        messages: {
          where: {
            role: {
              in: ["user", "assistant"],
            },
          },
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!chat) {
      const diagnostics = await getChatOwnerMissDiagnostics({
        tx,
        chatId,
        identity,
      });
      logChatOwnerMiss(chatId, diagnostics);

      return {
        chatNotFound: true as const,
        diagnostics,
      };
    }

    const existingMessages = chat.messages.map(toChatMessageRecord);
    const lastSequence = existingMessages.at(-1)?.sequence ?? 0;
    const lastMessage = existingMessages.at(-1);

    if (lastMessage?.role === "assistant" && lastMessage.status === "pending") {
      return {
        chat,
        generationInProgress: true as const,
      };
    }

    if (message) {
      const userMessage = toChatMessageRecord(
        await tx.message.create({
          data: {
            chatId: chat.id,
            role: "user",
            status: "complete",
            sequence: lastSequence + 1,
            content: message,
            metadata,
          },
        }),
      );
      const assistantMessage = toChatMessageRecord(
        await tx.message.create({
          data: {
            chatId: chat.id,
            role: "assistant",
            status: "pending",
            sequence: lastSequence + 2,
            content: "",
          },
        }),
      );

      return {
        chat,
        userMessage,
        assistantMessage,
        history: toTravelHistory(existingMessages),
      };
    }

    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.status !== "complete"
    ) {
      return {
        chat,
        noUnansweredUserMessage: true as const,
      };
    }

    const sourceUserMessage =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? toChatMessageRecord(
            await tx.message.update({
              where: {
                id: lastMessage.id,
              },
              data: {
                metadata: {
                  ...(lastMessage.metadata &&
                  typeof lastMessage.metadata === "object" &&
                  !Array.isArray(lastMessage.metadata)
                    ? lastMessage.metadata
                    : {}),
                  ...metadata,
                },
              },
            }),
          )
        : lastMessage;
    const assistantMessage = toChatMessageRecord(
      await tx.message.create({
        data: {
          chatId: chat.id,
          role: "assistant",
          status: "pending",
          sequence: lastMessage.sequence + 1,
          content: "",
        },
      }),
    );

    return {
      chat,
      userMessage: sourceUserMessage,
      assistantMessage,
      history: toTravelHistory(existingMessages.slice(0, -1)),
    };
  });
}
