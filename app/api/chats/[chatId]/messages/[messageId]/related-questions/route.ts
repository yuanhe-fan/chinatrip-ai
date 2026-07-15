import { Prisma } from "@prisma/client";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import { generateRelatedQuestions } from "@/lib/ai/related-questions/service";
import { getCurrentIdentity, createChatOwnerWhere } from "@/lib/auth/current-identity";
import { isRecord, isUuid } from "@/lib/chat/message-generation";
import { readPromptProfile, readRelatedQuestions } from "@/lib/messages/metadata";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RouteContext = { params: Promise<{ chatId: string; messageId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { chatId, messageId } = await context.params;

  if (!isUuid(chatId) || !isUuid(messageId)) {
    return apiError("MESSAGE_NOT_FOUND", "Answer not found.", 404);
  }

  try {
    const identity = await getCurrentIdentity();
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        chatId,
        role: "assistant",
        status: "complete",
        chat: { is: { status: { not: "deleted" }, ...createChatOwnerWhere(identity) } },
      },
      select: { id: true, sequence: true, content: true, metadata: true, chat: { select: { language: true } } },
    });

    if (!message) {
      return apiError("MESSAGE_NOT_FOUND", "Answer not found.", 404);
    }

    const cachedQuestions = readRelatedQuestions(message.metadata);
    if (cachedQuestions) {
      return Response.json({ relatedQuestions: cachedQuestions });
    }

    const sourceMessage = await prisma.message.findFirst({
      where: { chatId, role: "user", sequence: { lt: message.sequence } },
      orderBy: [{ sequence: "desc" }, { createdAt: "desc" }],
      select: { content: true },
    });

    if (!sourceMessage) {
      return Response.json({ relatedQuestions: [] });
    }

    const relatedQuestions = await generateRelatedQuestions({
      chatId,
      language: message.chat.language,
      sourceQuestion: sourceMessage.content,
      answer: message.content,
      promptProfile: readPromptProfile(message.metadata),
    });

    if (relatedQuestions.length > 0) {
      const metadata = isRecord(message.metadata) ? message.metadata : {};
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: {
            ...metadata,
            relatedQuestions,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return Response.json({ relatedQuestions });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return apiError("DATABASE_UNAVAILABLE", "Database is unavailable. Please try again later.", 503);
    }

    console.error("related_questions_failed", error);
    return Response.json({ relatedQuestions: [] });
  }
}
