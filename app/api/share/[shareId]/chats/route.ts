import { NextResponse } from "next/server";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import {
  CreateChatFromShareRequest,
  CreateChatFromShareResponse,
} from "@/lib/api/types";
import {
  createChatOwnerData,
  getCurrentIdentity,
} from "@/lib/auth/current-identity";
import { prisma } from "@/lib/prisma";
import { invalidateChatHistoryCacheForRecord } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RouteContext = {
  params: Promise<{
    shareId: string;
  }>;
};

function isLanguage(value: unknown): value is "en" | "zh" {
  return value === "en" || value === "zh";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isShareId(value: string) {
  return /^[a-zA-Z0-9_-]{6,40}$/.test(value);
}

function createChatTitle(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

export async function POST(request: Request, context: RouteContext) {
  const { shareId } = await context.params;

  if (!isShareId(shareId)) {
    return apiError("SHARE_NOT_FOUND", "Share not found.", 404);
  }

  let body: unknown;

  try {
    body = (await request.json()) as CreateChatFromShareRequest;
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

  try {
    const sourceShare = await prisma.sharedAnswer.findFirst({
      where: {
        shareSlug: shareId,
        isPublic: true,
        revokedAt: null,
      },
      select: {
        id: true,
        shareSlug: true,
      },
    });

    if (!sourceShare) {
      return apiError("SHARE_NOT_FOUND", "Share not found.", 404);
    }

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
          metadata: {
            source: "share",
            shareId: sourceShare.shareSlug,
            sharedAnswerId: sourceShare.id,
          },
        },
      });

      return {
        chat: createdChat,
        firstMessage: createdMessage,
      };
    });

    await invalidateChatHistoryCacheForRecord(chat);

    const response: CreateChatFromShareResponse = {
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
    console.error("Failed to create chat from share", error);

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
