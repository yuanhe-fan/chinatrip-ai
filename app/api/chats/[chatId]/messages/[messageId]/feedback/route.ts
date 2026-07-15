import {
  AnswerFeedbackReason,
  AnswerFeedbackReaction,
  Prisma,
} from "@prisma/client";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import { getCurrentIdentity, createChatOwnerWhere } from "@/lib/auth/current-identity";
import { isRecord, isUuid } from "@/lib/chat/message-generation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const REASONS = new Set<AnswerFeedbackReason>([
  "inaccurate",
  "outdated",
  "not_specific",
  "not_helpful",
  "hard_to_understand",
]);

type RouteContext = { params: Promise<{ chatId: string; messageId: string }> };

type StoredFeedback = {
  reaction: AnswerFeedbackReaction;
  reason: AnswerFeedbackReason | null;
  comment: string | null;
  updatedAt: Date;
};

function serializeFeedback(feedback: StoredFeedback) {
  return {
    reaction: feedback.reaction,
    reason: feedback.reason,
    comment: feedback.comment,
    updatedAt: feedback.updatedAt.toISOString(),
  };
}

function isSameFeedback(
  feedback: StoredFeedback,
  data: Pick<StoredFeedback, "reaction" | "reason" | "comment">,
) {
  return (
    feedback.reaction === data.reaction &&
    feedback.reason === data.reason &&
    feedback.comment === data.comment
  );
}

function feedbackLockedError() {
  return apiError(
    "FEEDBACK_ALREADY_SUBMITTED",
    "Feedback has already been submitted for this answer.",
    409,
  );
}

export async function PUT(request: Request, context: RouteContext) {
  const { chatId, messageId } = await context.params;

  if (!isUuid(chatId) || !isUuid(messageId)) {
    return apiError("MESSAGE_NOT_FOUND", "Answer not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_REQUEST", "Invalid JSON request body.", 400);
  }

  if (!isRecord(body) || (body.reaction !== "up" && body.reaction !== "down")) {
    return apiError("INVALID_REQUEST", "Select a valid feedback reaction.", 400);
  }

  const reaction = body.reaction as AnswerFeedbackReaction;
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (reason !== undefined && !REASONS.has(reason as AnswerFeedbackReason)) {
    return apiError("INVALID_REQUEST", "Select a valid feedback reason.", 400);
  }

  if (comment.length > 500) {
    return apiError("INVALID_REQUEST", "Feedback comments must be 500 characters or fewer.", 400);
  }

  try {
    const identity = await getCurrentIdentity();
    const feedbackOwnerWhere = identity.profile
      ? { profileId: identity.profile.id }
      : { anonymousSessionId: identity.anonymousSession.id };
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        chatId,
        role: "assistant",
        status: "complete",
        chat: { is: { status: { not: "deleted" }, ...createChatOwnerWhere(identity) } },
      },
      select: {
        id: true,
        answerFeedback: {
          where: feedbackOwnerWhere,
          take: 1,
        },
      },
    });

    if (!message) {
      return apiError("MESSAGE_NOT_FOUND", "Answer not found.", 404);
    }

    const data = {
      reaction,
      reason:
        reaction === "down" && reason
          ? (reason as AnswerFeedbackReason)
          : null,
      comment: reaction === "down" && comment ? comment : null,
    };
    const existingFeedback = message.answerFeedback[0];

    if (existingFeedback) {
      return isSameFeedback(existingFeedback, data)
        ? Response.json({ feedback: serializeFeedback(existingFeedback) })
        : feedbackLockedError();
    }

    try {
      const feedback = await prisma.answerFeedback.create({
        data: {
          assistantMessageId: message.id,
          ...feedbackOwnerWhere,
          ...data,
        },
      });

      return Response.json({ feedback: serializeFeedback(feedback) });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const concurrentFeedback = await prisma.answerFeedback.findFirst({
          where: {
            assistantMessageId: message.id,
            ...feedbackOwnerWhere,
          },
        });

        if (concurrentFeedback && isSameFeedback(concurrentFeedback, data)) {
          return Response.json({
            feedback: serializeFeedback(concurrentFeedback),
          });
        }

        return feedbackLockedError();
      }

      throw error;
    }
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return apiError("DATABASE_UNAVAILABLE", "Database is unavailable. Please try again later.", 503);
    }

    console.error("answer_feedback_failed", error);
    return apiError("INTERNAL_ERROR", "Unable to save feedback.", 500);
  }
}
