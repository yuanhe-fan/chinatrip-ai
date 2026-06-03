"use client";

import { ChatInput } from "@/components/ChatInput";
import { AnswerContent } from "@/components/AnswerContent";
import { ImagePreviewOverlay } from "@/components/ImagePreviewOverlay";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  CreateChatFromShareResponse,
  CreateChatResponse,
  SharedAnswerResponse,
} from "@/lib/api/types";
import {
  getPoiAssetGroup,
  type AnswerAsset,
} from "@/lib/answer-assets/registry";
import { formatChinaTripDate } from "@/lib/time/format";
import { ArrowRight, Check, Copy, ExternalLink, Share2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ShareSnapshot = SharedAnswerResponse["share"];

type ImagePreviewState = {
  assets: AnswerAsset[];
  index: number;
};

export function ShareView({
  shareId,
  initialShare,
}: {
  shareId?: string;
  initialShare?: ShareSnapshot;
}) {
  const router = useRouter();
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [question, setQuestion] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [share, setShare] = useState<ShareSnapshot | null>(
    initialShare ?? null,
  );
  const [isLoadingShare, setIsLoadingShare] = useState(
    Boolean(shareId && !initialShare),
  );
  const [shareError, setShareError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<ImagePreviewState | null>(
    null,
  );

  const sharedQuestionText = share?.question ?? "Shared China travel question";
  const sharedAnswerText =
    share?.answer ??
    "This shared answer could not be loaded. Please check the link and try again.";

  useEffect(() => {
    if (!shareId || initialShare) {
      return;
    }

    let isMounted = true;

    async function loadShare() {
      setIsLoadingShare(true);
      setShareError(null);

      try {
        const response = await apiFetch<SharedAnswerResponse>(
          `/share/${shareId}`,
        );

        if (isMounted) {
          setShare(response.share);
        }
      } catch (error) {
        if (isMounted) {
          setShareError(
            error instanceof ApiClientError
              ? error.message
              : "Failed to load shared answer.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingShare(false);
        }
      }
    }

    void loadShare();

    return () => {
      isMounted = false;
    };
  }, [shareId, initialShare]);

  function showToast(message: string) {
    setToast(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => setToast(null), 1800);
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage);
    } catch {
      showToast("Copy failed. Please try again.");
    }
  }

  function handleCopyAnswer() {
    void copyText(sharedAnswerText, "Answer copied");
  }

  function handleCopyLink() {
    void copyText(window.location.href, "Share link copied");
  }

  function handleOpenImagePreview(asset: AnswerAsset) {
    const assets = getPoiAssetGroup(asset.id);
    const index = Math.max(
      0,
      assets.findIndex((candidate) => candidate.id === asset.id),
    );

    setPreviewState({
      assets: assets.length > 0 ? assets : [asset],
      index,
    });
  }

  function handlePreviewNext() {
    setPreviewState((current) =>
      current
        ? {
            ...current,
            index: (current.index + 1) % current.assets.length,
          }
        : current,
    );
  }

  function handlePreviewPrevious() {
    setPreviewState((current) =>
      current
        ? {
            ...current,
            index:
              (current.index - 1 + current.assets.length) %
              current.assets.length,
          }
        : current,
    );
  }

  async function handleSubmit() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = share?.shareId
        ? await apiFetch<CreateChatFromShareResponse>(
            `/share/${share.shareId}/chats`,
            {
              message: trimmedQuestion,
            },
          )
        : await apiFetch<CreateChatResponse>("/chats", {
            message: trimmedQuestion,
            source: "share",
          });

      router.push(`/chat/${response.chat.id}`);
    } catch (error) {
      showToast(
        error instanceof ApiClientError
          ? error.message
          : "Failed to start chat.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#F8F5EF] bg-[linear-gradient(135deg,#F8F5EF_0%,#EEF4F6_52%,#F7F0E6_100%)] text-[#172033]">
      <header className="sticky top-0 z-30 border-b border-[#E6D8C7] bg-white/76 px-4 py-3 shadow-[0_8px_30px_rgba(20,36,58,0.04)] backdrop-blur-xl sm:px-7">
        <div className="mx-auto flex w-full max-w-[60rem] items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-2xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#D49A52]/40"
            aria-label="ChinaTrip AI home"
          >
            <Image
              src="/logo-img.png"
              alt="ChinaTrip AI logo"
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0 rounded-full bg-[#FFFDF9] object-cover shadow-sm ring-1 ring-[#E6D8C7]"
            />
            <span className="truncate text-lg font-semibold tracking-tight text-[#172033] sm:text-xl">
              ChinaTrip AI
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#8A552B,#14243A)] px-3 text-sm font-semibold text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.10)] transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#D49A52]/45 sm:px-4"
          >
            <span className="hidden sm:inline">Ask your own question</span>
            <span className="sm:hidden">Ask</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-8 px-4 py-8 sm:px-7 sm:py-12">
        <section className="rounded-[1.25rem] border border-[#E6D8C7] bg-[#FFFDF9] p-5 shadow-[0_18px_45px_rgba(20,36,58,0.06)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D8C7]/70 pb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E6D8C7] bg-[#EEF4F6] px-3 py-1.5 text-sm font-medium text-[#8A552B]">
              <Share2 className="h-4 w-4" />
              Shared travel answer
            </div>
            <span className="text-sm text-[#756A60]">
              {formatChinaTripDate(share?.createdAt)}
            </span>
          </div>

          {isLoadingShare ? (
            <div className="mt-7 space-y-4">
              <div className="h-4 w-20 animate-pulse rounded-full bg-[#E6D8C7]" />
              <div className="h-20 animate-pulse rounded-[1.25rem] bg-[#8A552B]/20" />
              <div className="h-40 animate-pulse rounded-[1.25rem] bg-white" />
            </div>
          ) : shareError ? (
            <div className="mt-7 rounded-[1.25rem] border border-[#E6D8C7] bg-white p-6 text-sm leading-6 text-[#6F6258]">
              {shareError}
            </div>
          ) : (
            <>
              <div className="mt-7">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#9A8D80]">
                  Question
                </p>
                <h1 className="mt-3 w-full rounded-[1.25rem] rounded-tr-sm bg-[linear-gradient(135deg,#8A552B,#14243A)] px-4 py-3 text-2xl font-bold leading-tight tracking-tight text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.10)] sm:px-6 sm:py-4 sm:text-4xl">
                  {sharedQuestionText}
                </h1>
              </div>

              <article className="mt-7 rounded-[1.25rem] rounded-tl-sm border border-[#E6D8C7] bg-white p-5 text-[0.94rem] leading-7 text-[#26384D] shadow-[0_18px_45px_rgba(20,36,58,0.06)] sm:p-7">
                <div className="flex items-center gap-3 border-b border-[#E6D8C7]/70 pb-4">
                  <Image
                    src="/logo-img.png"
                    alt="ChinaTrip AI"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full bg-[#FFFDF9] object-cover ring-1 ring-[#E6D8C7]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#172033]">
                      ChinaTrip AI
                    </p>
                    <p className="truncate text-xs text-[#756A60]">
                      Practical guidance for China travel
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <AnswerContent
                    content={sharedAnswerText}
                    visuals={share?.visuals}
                    onOpenImage={handleOpenImagePreview}
                  />
                </div>
              </article>
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyAnswer}
              disabled={!share}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6D8C7] bg-[#FFFDF9] px-3 text-sm font-medium text-[#6F6258] transition hover:bg-[#F3EEE7] hover:text-[#14243A] focus-visible:ring-2 focus-visible:ring-[#D49A52]/40"
            >
              <Copy className="h-4 w-4 text-amber-600" />
              Copy answer
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!share}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6D8C7] bg-[#FFFDF9] px-3 text-sm font-medium text-[#6F6258] transition hover:bg-[#F3EEE7] hover:text-[#14243A] focus-visible:ring-2 focus-visible:ring-[#D49A52]/40"
            >
              <ExternalLink className="h-4 w-4 text-sky-600" />
              Copy link
            </button>
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-[#E6D8C7] bg-[#FFFDF9] p-5 shadow-[0_18px_45px_rgba(20,36,58,0.06)] sm:p-7">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight text-[#14243A]">
              Ask your own China travel question
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#756A60]">
              Start a new chat with ChinaTrip AI and get practical answers for
              your itinerary, apps, payments, transport, and food.
            </p>
          </div>

          <ChatInput
            value={question}
            onChange={setQuestion}
            onSubmit={handleSubmit}
            disabled={isSubmitting}
          />
        </section>
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#172033] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#172033]/20">
          <Check className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      ) : null}

      <ImagePreviewOverlay
        assets={previewState?.assets ?? []}
        currentIndex={previewState?.index ?? 0}
        onClose={() => setPreviewState(null)}
        onNext={handlePreviewNext}
        onPrevious={handlePreviewPrevious}
      />
    </main>
  );
}
