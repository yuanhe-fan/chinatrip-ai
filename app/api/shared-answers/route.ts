import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/server";
import {
  CreateSharedAnswerRequest,
  CreateSharedAnswerResponse,
} from "@/lib/api/types";
import {
  createChatOwnerWhere,
  getCurrentIdentity,
} from "@/lib/auth/current-identity";
import { readAnswerSources, readAnswerVisuals } from "@/lib/messages/metadata";
import { prisma } from "@/lib/prisma";
import { createShareCacheKey, safeDelete } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function createShareSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function createShareUrl(request: Request, shareSlug: string) {
  return `${new URL(request.url).origin}/share/${shareSlug}`;
}

async function createUniqueShareSlug() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareSlug = createShareSlug();
    const existing = await prisma.sharedAnswer.findUnique({
      where: { shareSlug },
      select: { id: true },
    });

    if (!existing) {
      return shareSlug;
    }
  }

  throw new Error("Unable to create unique share slug.");
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = (await request.json()) as CreateSharedAnswerRequest;
  } catch {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  if (!isRecord(body)) {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  const chatId = typeof body.chatId === "string" ? body.chatId : "";
  const userMessageId =
    typeof body.userMessageId === "string" ? body.userMessageId : "";
  const assistantMessageId =
    typeof body.assistantMessageId === "string"
      ? body.assistantMessageId
      : "";

  if (
    !isUuid(chatId) ||
    !isUuid(userMessageId) ||
    !isUuid(assistantMessageId)
  ) {
    return apiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
  }

  try {
    const identity = await getCurrentIdentity();
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        status: {
          not: "deleted",
        },
        ...createChatOwnerWhere(identity),
      },
      select: {
        id: true,
        profileId: true,
        anonymousSessionId: true,
        messages: {
          where: {
            id: {
              in: [userMessageId, assistantMessageId],
            },
          },
          select: {
            id: true,
            role: true,
            status: true,
            sequence: true,
            content: true,
            metadata: true,
          },
        },
      },
    });

    if (!chat) {
      return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
    }

    const userMessage = chat.messages.find(
      (message) => message.id === userMessageId,
    );
    const assistantMessage = chat.messages.find(
      (message) => message.id === assistantMessageId,
    );

    if (
      !userMessage ||
      userMessage.role !== "user" ||
      !assistantMessage ||
      assistantMessage.role !== "assistant" ||
      assistantMessage.status !== "complete"
    ) {
      return apiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
    }

    if (assistantMessage.sequence !== userMessage.sequence + 1) {
      return apiError("PAIR_NOT_FOUND", "Question-answer pair not found.", 404);
    }

    const existingShare = await prisma.sharedAnswer.findFirst({
      where: {
        assistantMessageId: assistantMessage.id,
        isPublic: true,
        revokedAt: null,
      },
      select: {
        id: true,
        shareSlug: true,
        question: true,
        answer: true,
        createdAt: true,
      },
    });

    const share =
      existingShare ??
      (await prisma.sharedAnswer.create({
        data: {
          chatId: chat.id,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          profileId: chat.profileId,
          anonymousSessionId: chat.anonymousSessionId,
          shareSlug: await createUniqueShareSlug(),
          question: userMessage.content,
          answer: assistantMessage.content,
          isPublic: true,
        },
      }));

    const response: CreateSharedAnswerResponse = {
      share: {
        id: share.id,
        shareId: share.shareSlug,
        url: createShareUrl(request, share.shareSlug),
        question: share.question,
        answer: share.answer,
        visuals: readAnswerVisuals(assistantMessage.metadata),
        sources: readAnswerSources(assistantMessage.metadata),
        createdAt: share.createdAt.toISOString(),
      },
    };

    await safeDelete(createShareCacheKey(share.shareSlug));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to create shared answer", error);

    return apiError("INTERNAL_ERROR", "Failed to create share link.", 500);
  }
}
