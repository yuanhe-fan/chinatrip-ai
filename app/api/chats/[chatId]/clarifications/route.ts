import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/server";
import type {
  CreateClarificationRequest,
  CreateClarificationResponse,
} from "@/lib/api/types";
import {
  createChatOwnerWhere,
  getCurrentIdentity,
} from "@/lib/auth/current-identity";
import { generateTripClarification } from "@/lib/ai/clarification/service";
import { isUuid, isRecord } from "@/lib/chat/message-generation";
import { isPromptProfile } from "@/lib/quick-questions/profiles";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

function isLanguage(value: unknown): value is "en" | "zh" {
  return value === "en" || value === "zh";
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

  const requestBody = body as CreateClarificationRequest;

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
        language: true,
      },
    });

    if (!chat) {
      return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
    }

    const persistedMessage = requestBody.messageId
      ? await prisma.message.findFirst({
          where: {
            id: requestBody.messageId,
            chatId: chat.id,
            role: "user",
          },
          select: {
            content: true,
          },
        })
      : null;
    const message =
      typeof requestBody.message === "string" && requestBody.message.trim()
        ? requestBody.message.trim()
        : persistedMessage?.content.trim() ?? "";

    if (!message) {
      return apiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
    }

    const language = isLanguage(requestBody.language)
      ? requestBody.language
      : chat.language;
    const promptProfile = isPromptProfile(requestBody.promptProfile)
      ? requestBody.promptProfile
      : undefined;
    const clarification = await generateTripClarification({
      chatId: chat.id,
      userMessage: message,
      language,
      promptProfile,
      signal: request.signal,
    });
    const response: CreateClarificationResponse = clarification;

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to create trip clarification", error);

    return apiError("INTERNAL_ERROR", "Failed to create clarification.", 500);
  }
}
