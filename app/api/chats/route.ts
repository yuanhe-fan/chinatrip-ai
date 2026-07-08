import { NextResponse } from "next/server";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import {
  ChatHistoryResponse,
  CreateChatRequest,
  CreateChatResponse,
} from "@/lib/api/types";
import {
  createChatOwnerData,
  getChatHistoryOwner,
  getCurrentIdentity,
} from "@/lib/auth/current-identity";
import { findQuickQuestionByExactQuestion } from "@/lib/quick-questions/questions";
import {
  createQuickQuestionMenuContent,
  createQuickQuestionMenuMetadata,
  getQuickQuestionMenu,
} from "@/lib/quick-questions/menus";
import { prisma } from "@/lib/prisma";
import {
  CHAT_HISTORY_CACHE_TTL_SECONDS,
  createChatHistoryCacheKey,
  invalidateChatHistoryCacheForRecord,
  safeGetJson,
  safeSetJson,
} from "@/lib/cache/redis";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

function isLanguage(value: unknown): value is "en" | "zh" {
  return value === "en" || value === "zh";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createChatTitle(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

function getLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }

  return Math.min(Math.floor(parsed), 50);
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

function logChatHistoryTiming({
  ownerMs,
  cacheMs,
  dbMs,
  totalMs,
  cacheHit,
  ownerType,
  limit,
}: {
  ownerMs: number;
  cacheMs: number;
  dbMs: number;
  totalMs: number;
  cacheHit: boolean;
  ownerType: "profile" | "anonymous" | "none";
  limit: number;
}) {
  console.info("chat_history_timing", {
    ownerMs,
    cacheMs,
    dbMs,
    totalMs,
    cacheHit,
    ownerType,
    limit,
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const limit = getLimit(searchParams.get("limit"));
  let ownerMs = 0;
  let cacheMs = 0;
  let dbMs = 0;
  let cacheHit = false;
  let ownerType: "profile" | "anonymous" | "none" = "none";

  try {
    const ownerStartedAt = Date.now();
    const owner = await getChatHistoryOwner();
    ownerMs = Date.now() - ownerStartedAt;
    ownerType = owner?.type ?? "none";

    if (!owner) {
      const response: ChatHistoryResponse = {
        chats: [],
        nextCursor: null,
      };

      logChatHistoryTiming({
        ownerMs,
        cacheMs,
        dbMs,
        totalMs: Date.now() - startedAt,
        cacheHit,
        ownerType,
        limit,
      });

      return NextResponse.json(response);
    }

    const cacheKey = createChatHistoryCacheKey(owner, limit);
    const cacheStartedAt = Date.now();
    const cachedResponse = await safeGetJson<ChatHistoryResponse>(cacheKey);
    cacheMs = Date.now() - cacheStartedAt;

    if (cachedResponse) {
      cacheHit = true;
      logChatHistoryTiming({
        ownerMs,
        cacheMs,
        dbMs,
        totalMs: Date.now() - startedAt,
        cacheHit,
        ownerType,
        limit,
      });

      return NextResponse.json(cachedResponse);
    }

    const dbStartedAt = Date.now();
    const chats = await prisma.chat.findMany({
      where: {
        status: {
          not: "deleted",
        },
        ...(owner.type === "profile"
          ? { profileId: owner.profileId }
          : { anonymousSessionId: owner.anonymousSessionId }),
      },
      select: {
        id: true,
        title: true,
        language: true,
        status: true,
        updatedAt: true,
        lastMessageAt: true,
        messages: {
          where: {
            role: {
              in: ["user", "assistant"],
            },
          },
          select: {
            content: true,
          },
          orderBy: [{ sequence: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      take: limit,
    });
    dbMs = Date.now() - dbStartedAt;

    const response: ChatHistoryResponse = {
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        language: chat.language,
        status: chat.status === "archived" ? "archived" : "active",
        updatedAt: chat.updatedAt.toISOString(),
        lastMessageAt: chat.lastMessageAt.toISOString(),
        preview: createPreview(chat.messages[0]?.content),
      })),
      nextCursor: null,
    };

    await safeSetJson(cacheKey, response, CHAT_HISTORY_CACHE_TTL_SECONDS);

    logChatHistoryTiming({
      ownerMs,
      cacheMs,
      dbMs,
      totalMs: Date.now() - startedAt,
      cacheHit,
      ownerType,
      limit,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get chat history", error);

    if (isDatabaseUnavailableError(error)) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "Database is unavailable. Please try again later.",
        503,
      );
    }

    return apiError("INTERNAL_ERROR", "Failed to load chat history.", 500);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = (await request.json()) as CreateChatRequest;
  } catch {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  if (!isRecord(body)) {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return apiError("EMPTY_MESSAGE", "Please enter your question.", 400);
  }

  const language = body.language ?? "en";

  if (!isLanguage(language)) {
    return apiError("INVALID_LANGUAGE", "Unsupported language.", 400);
  }

  const quickQuestion = findQuickQuestionByExactQuestion(message);
  const promptProfile =
    quickQuestion &&
    body.promptProfile === quickQuestion.promptProfile &&
    body.sourceQuestionId === quickQuestion.id
      ? quickQuestion.promptProfile
      : null;
  const sourceQuestionId = promptProfile && quickQuestion ? quickQuestion.id : null;

  try {
    const identity = await getCurrentIdentity();
    const now = new Date();

    const { chat, firstMessage } = await prisma.$transaction(async (tx) => {
      const createdChat = await tx.chat.create({
        data: {
          ...createChatOwnerData(identity),
          title: createChatTitle(message),
          language,
          status: "active",
          lastMessageAt: now,
        },
      });

      const createdMessage = await tx.message.create({
        data: {
          chatId: createdChat.id,
          role: "user",
          status: "complete",
          sequence: 1,
          content: message,
          metadata: promptProfile
            ? {
                source: body.source === "home" ? "home" : "quick_question",
                promptProfile,
                sourceQuestionId,
              }
            : body.source === "home" || body.source === "share"
            ? {
                source: body.source,
              }
            : undefined,
        },
      });

      if (quickQuestion && promptProfile) {
        const menu = getQuickQuestionMenu(quickQuestion.id);

        await tx.message.create({
          data: {
            chatId: createdChat.id,
            role: "assistant",
            status: "complete",
            sequence: 2,
            content: createQuickQuestionMenuContent(menu),
            metadata: createQuickQuestionMenuMetadata(menu),
          },
        });
      }

      return {
        chat: createdChat,
        firstMessage: createdMessage,
      };
    });

    await invalidateChatHistoryCacheForRecord(chat);

    const response: CreateChatResponse = {
      chat: {
        id: chat.id,
        title: chat.title,
        language: chat.language,
        status: "active",
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
        lastMessageAt: chat.lastMessageAt.toISOString(),
      },
      firstMessage: {
        id: firstMessage.id,
        chatId: firstMessage.chatId,
        role: "user",
        status: "complete",
        sequence: firstMessage.sequence,
        content: firstMessage.content,
        createdAt: firstMessage.createdAt.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to create chat", error);

    if (isDatabaseUnavailableError(error)) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "Database is unavailable. Please try again later.",
        503,
      );
    }

    return apiError("INTERNAL_ERROR", "Failed to create chat.", 500);
  }
}
