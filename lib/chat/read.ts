import "server-only";

import type {
  ChatDetailMessage,
  ChatDetailResponse,
  ChatHistoryResponse,
} from "@/lib/api/types";
import {
  createChatOwnerWhere,
  type CurrentIdentity,
} from "@/lib/auth/current-identity";
import {
  CHAT_HISTORY_CACHE_TTL_SECONDS,
  createChatHistoryCacheKey,
  createChatHistoryOwnerFromRecord,
  safeGetJson,
  safeSetJson,
} from "@/lib/cache/redis";
import {
  readAnswerCompletionStatus,
  readAnswerSources,
  readAnswerVisuals,
  readQuickQuestionMenu,
  readRelatedQuestions,
} from "@/lib/messages/metadata";
import { prisma } from "@/lib/prisma";

const DEFAULT_HISTORY_LIMIT = 30;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_LIMIT = 50;

type HistoryCursor = {
  id: string;
  lastMessageAt: string;
};

function getLimit(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function createPreview(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}

function encodeCursor(value: HistoryCursor) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(value: string | null | undefined): HistoryCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (
      typeof parsed?.id !== "string" ||
      typeof parsed?.lastMessageAt !== "string" ||
      Number.isNaN(new Date(parsed.lastMessageAt).getTime())
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getOwnerFromIdentity(identity: CurrentIdentity) {
  return identity.profile
    ? { type: "profile" as const, profileId: identity.profile.id }
    : {
        type: "anonymous" as const,
        anonymousSessionId: identity.anonymousSession.id,
      };
}

function serializeMessage(message: {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  status: "pending" | "complete" | "failed";
  sequence: number;
  content: string;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: unknown;
  answerFeedback?: Array<{
    reaction: "up" | "down";
    reason:
      | "inaccurate"
      | "outdated"
      | "not_specific"
      | "not_helpful"
      | "hard_to_understand"
      | null;
    comment: string | null;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): ChatDetailMessage {
  if (message.role !== "user" && message.role !== "assistant") {
    throw new Error(`Unexpected chat message role: ${message.role}`);
  }

  const completionStatus =
    message.role === "assistant"
      ? readAnswerCompletionStatus(message.metadata)
      : null;

  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    status: message.status,
    sequence: message.sequence,
    content: message.content,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
    visuals:
      message.role === "assistant"
        ? readAnswerVisuals(message.metadata)
        : undefined,
    sources:
      message.role === "assistant"
        ? readAnswerSources(message.metadata)
        : undefined,
    quickQuestionMenu:
      message.role === "assistant"
        ? readQuickQuestionMenu(message.metadata)
        : undefined,
    feedback:
      message.role === "assistant" && message.answerFeedback?.[0]
        ? {
            reaction: message.answerFeedback[0].reaction,
            reason: message.answerFeedback[0].reason,
            comment: message.answerFeedback[0].comment,
            updatedAt: message.answerFeedback[0].updatedAt.toISOString(),
          }
        : undefined,
    relatedQuestions:
      message.role === "assistant"
        ? readRelatedQuestions(message.metadata)
        : undefined,
    truncated: completionStatus?.truncated,
    maybeTruncated: completionStatus?.maybeTruncated,
    finishReason: completionStatus?.finishReason,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export async function readChatHistory(
  identity: CurrentIdentity,
  options: { limit?: string | null; cursor?: string | null } = {},
): Promise<{
  response: ChatHistoryResponse;
  cacheHit: boolean;
  cacheMs: number;
  dbMs: number;
}> {
  const limit = getLimit(options.limit, DEFAULT_HISTORY_LIMIT);
  const cursor = decodeCursor(options.cursor);
  const owner = getOwnerFromIdentity(identity);
  const canUseCache = !cursor;
  const cacheKey = createChatHistoryCacheKey(owner, limit);
  const cacheStartedAt = Date.now();
  const cachedResponse = canUseCache
    ? await safeGetJson<ChatHistoryResponse>(cacheKey)
    : null;
  const cacheMs = Date.now() - cacheStartedAt;

  if (cachedResponse) {
    return { response: cachedResponse, cacheHit: true, cacheMs, dbMs: 0 };
  }

  const dbStartedAt = Date.now();
  const chats = await prisma.chat.findMany({
    where: {
      status: { not: "deleted" },
      ...createChatOwnerWhere(identity),
      ...(cursor
        ? {
            OR: [
              { lastMessageAt: { lt: new Date(cursor.lastMessageAt) } },
              {
                lastMessageAt: new Date(cursor.lastMessageAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      language: true,
      status: true,
      updatedAt: true,
      lastMessageAt: true,
      messages: {
        where: { role: { in: ["user", "assistant"] } },
        select: { content: true },
        orderBy: [{ sequence: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const dbMs = Date.now() - dbStartedAt;
  const hasMore = chats.length > limit;
  const page = chats.slice(0, limit);
  const lastChat = page.at(-1);
  const response: ChatHistoryResponse = {
    chats: page.map((chat) => ({
      id: chat.id,
      title: chat.title,
      language: chat.language,
      status: chat.status === "archived" ? "archived" : "active",
      updatedAt: chat.updatedAt.toISOString(),
      lastMessageAt: chat.lastMessageAt.toISOString(),
      preview: createPreview(chat.messages[0]?.content),
    })),
    nextCursor:
      hasMore && lastChat
        ? encodeCursor({ id: lastChat.id, lastMessageAt: lastChat.lastMessageAt.toISOString() })
        : null,
  };

  if (canUseCache) {
    await safeSetJson(cacheKey, response, CHAT_HISTORY_CACHE_TTL_SECONDS);
  }

  return { response, cacheHit: false, cacheMs, dbMs };
}

export async function readChatDetail(
  chatId: string,
  identity: CurrentIdentity,
  options: { limit?: string | null; before?: string | null } = {},
): Promise<ChatDetailResponse | null> {
  const limit = getLimit(options.limit, DEFAULT_MESSAGE_LIMIT);
  const before = Number(options.before);
  const beforeSequence = Number.isInteger(before) && before > 0 ? before : null;
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      status: { not: "deleted" },
      ...createChatOwnerWhere(identity),
    },
    select: {
      id: true,
      title: true,
      language: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      messages: {
        where: {
          role: { in: ["user", "assistant"] },
          ...(beforeSequence ? { sequence: { lt: beforeSequence } } : {}),
        },
        orderBy: [{ sequence: "desc" }, { createdAt: "desc" }],
        take: limit + 1,
        include: {
          answerFeedback: {
            where: identity.profile
              ? { profileId: identity.profile.id }
              : { anonymousSessionId: identity.anonymousSession.id },
            select: {
              reaction: true,
              reason: true,
              comment: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!chat || chat.status === "deleted") {
    return null;
  }

  const hasMore = chat.messages.length > limit;
  const messages = chat.messages.slice(0, limit).reverse();
  const earliestMessage = messages[0];

  return {
    chat: {
      id: chat.id,
      title: chat.title,
      language: chat.language,
      status: chat.status === "archived" ? "archived" : "active",
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      lastMessageAt: chat.lastMessageAt.toISOString(),
    },
    messages: messages.map(serializeMessage),
    nextCursor: hasMore && earliestMessage ? String(earliestMessage.sequence) : null,
  };
}

export async function getChatPageInitialData(chatId: string, identity: CurrentIdentity) {
  const [historyResult, detail] = await Promise.all([
    readChatHistory(identity),
    readChatDetail(chatId, identity),
  ]);

  return {
    history: historyResult.response,
    detail,
  };
}

export function getCacheOwnerForRecord(record: {
  profileId: string | null;
  anonymousSessionId: string | null;
}) {
  return createChatHistoryOwnerFromRecord(record);
}
