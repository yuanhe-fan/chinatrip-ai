import type { SharedAnswerResponse } from "@/lib/api/types";
import { readAnswerSources } from "@/lib/messages/metadata";
import { prisma } from "@/lib/prisma";

type PublicShare = SharedAnswerResponse["share"];

export function isPublicShareId(value: string) {
  return /^[a-zA-Z0-9_-]{6,40}$/.test(value);
}

function toPublicShare(share: {
  id: string;
  shareSlug: string;
  question: string;
  answer: string;
  createdAt: Date;
  viewCount: number;
  assistantMessage?: {
    metadata: unknown;
  };
}): PublicShare {
  return {
    id: share.id,
    shareId: share.shareSlug,
    question: share.question,
    answer: share.answer,
    sources: readAnswerSources(share.assistantMessage?.metadata),
    createdAt: share.createdAt.toISOString(),
    viewCount: share.viewCount,
  };
}

export async function getPublicShareBySlug(shareId: string): Promise<PublicShare | null> {
  if (!isPublicShareId(shareId)) {
    return null;
  }

  const share = await prisma.sharedAnswer.findFirst({
    where: {
      shareSlug: shareId,
      isPublic: true,
      revokedAt: null,
    },
    include: {
      assistantMessage: {
        select: {
          metadata: true,
        },
      },
    },
  });

  if (!share) {
    return null;
  }

  return toPublicShare(share);
}

export async function incrementPublicShareView(shareId: string) {
  if (!isPublicShareId(shareId)) {
    return;
  }

  await prisma.sharedAnswer.updateMany({
    where: {
      shareSlug: shareId,
      isPublic: true,
      revokedAt: null,
    },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });
}
