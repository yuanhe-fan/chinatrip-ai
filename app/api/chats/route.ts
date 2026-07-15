import { NextResponse } from "next/server";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import {
  CreateChatRequest,
  CreateChatResponse,
} from "@/lib/api/types";
import {
  createChatOwnerData,
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
  invalidateChatHistoryCacheForRecord,
} from "@/lib/cache/redis";
import { readChatHistory } from "@/lib/chat/read";
import { createServerTiming, logPerformance } from "@/lib/performance/server-timing";

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

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);

  try {
    const authStartedAt = Date.now();
    const identity = await getCurrentIdentity();
    const authMs = Date.now() - authStartedAt;
    const result = await readChatHistory(identity, {
      limit: searchParams.get("limit"),
      cursor: searchParams.get("cursor"),
    });
    const totalMs = Date.now() - startedAt;
    logPerformance("chat_history", {
      authMs,
      cacheMs: result.cacheMs,
      dbMs: result.dbMs,
      cacheHit: result.cacheHit ? 1 : 0,
      totalMs,
    });

    return NextResponse.json(result.response, {
      headers: {
        "Server-Timing": createServerTiming({
          auth: authMs,
          cache: result.cacheMs,
          db: result.dbMs,
          total: totalMs,
        }),
        "Cache-Control": "private, no-store",
      },
    });
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
