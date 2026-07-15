import type { Metadata } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { ShareView } from "@/features/share/ShareView";
import { getCachedPublicShareBySlug } from "@/lib/share/cached-public-share";
import { incrementPublicShareView } from "@/lib/share/public-share";

type SharePageProps = {
  params: Promise<{
    shareId: string;
  }>;
};

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function createSeoExcerpt(value: string, maxLength: number) {
  const normalized = stripMarkdown(value).replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { shareId } = await params;
  const share = await getCachedPublicShareBySlug(shareId);

  if (!share) {
    return {
      title: "Shared China Travel Answer",
      description:
        "A shared China travel answer from ChinaTrip AI could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = createSeoExcerpt(share.question, 64);
  const description = createSeoExcerpt(share.answer, 155);
  const url = `/share/${share.shareId}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "ChinaTrip AI",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;
  const share = await getCachedPublicShareBySlug(shareId);

  if (!share) {
    notFound();
  }

  after(() => incrementPublicShareView(shareId).catch(() => undefined));

  return <ShareView shareId={shareId} initialShare={share} />;
}
