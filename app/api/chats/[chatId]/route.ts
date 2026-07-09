import { NextResponse } from "next/server";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import { ChatDetailResponse } from "@/lib/api/types";
import {
  createChatOwnerWhere,
  getCurrentIdentity,
} from "@/lib/auth/current-identity";
import {
  readAnswerCompletionStatus,
  readAnswerSources,
  readAnswerVisuals,
  readQuickQuestionMenu,
} from "@/lib/messages/metadata";
import { isUuid } from "@/lib/chat/message-generation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { chatId } = await context.params;

  if (!isUuid(chatId)) {
    return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
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

    if (!chat || chat.status === "deleted") {
      return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
    }

    const response: ChatDetailResponse = {
      chat: {
        id: chat.id,
        title: chat.title,
        language: chat.language,
        status: chat.status === "archived" ? "archived" : "active",
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
        lastMessageAt: chat.lastMessageAt.toISOString(),
      },
      messages: chat.messages.map((message) => {
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
          truncated: completionStatus?.truncated,
          maybeTruncated: completionStatus?.maybeTruncated,
          finishReason: completionStatus?.finishReason,
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt.toISOString(),
        };
      }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get chat detail", error);

    if (isDatabaseUnavailableError(error)) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "Database is unavailable. Please try again later.",
        503,
      );
    }

    return apiError("INTERNAL_ERROR", "Failed to load chat.", 500);
  }
}
