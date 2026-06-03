"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import type { AnswerAsset } from "@/lib/answer-assets/registry";

export function ImagePreviewOverlay({
  assets,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  scope = "page",
}: {
  assets: AnswerAsset[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  scope?: "chat" | "page";
}) {
  const asset = assets[currentIndex] ?? null;
  const hasMultipleImages = assets.length > 1;

  useEffect(() => {
    if (!asset) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!hasMultipleImages) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [asset, hasMultipleImages, onClose, onNext, onPrevious]);

  if (!asset) {
    return null;
  }

  const overlayClass =
    scope === "chat"
      ? "absolute inset-0"
      : "fixed inset-0";

  return (
    <div
      className={`${overlayClass} z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md sm:p-6 lg:p-8`}
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/25 hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-white/50 sm:right-6 sm:top-6 lg:right-8 lg:top-8"
        aria-label="Close image preview"
      >
        <X className="h-5 w-5" strokeWidth={1.5} />
      </button>
      {hasMultipleImages ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrevious();
            }}
            className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white/80 shadow-[0_10px_26px_rgba(15,23,42,0.2)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/22 hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-white/55 sm:left-[max(1.5rem,calc(50%-30.5rem))] sm:h-11 sm:w-11"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white/80 shadow-[0_10px_26px_rgba(15,23,42,0.2)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/22 hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-white/55 sm:right-[max(1.5rem,calc(50%-30.5rem))] sm:h-11 sm:w-11"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white/90 shadow-[0_12px_28px_rgba(15,23,42,0.2)] backdrop-blur-md sm:bottom-6">
            {currentIndex + 1} / {assets.length}
          </div>
        </>
      ) : null}
      <div
        className="relative h-[min(66dvh,30rem)] w-[min(88vw,38rem)] overflow-hidden rounded-2xl shadow-[0_24px_68px_rgba(15,23,42,0.4),0_8px_24px_rgba(15,23,42,0.24)] sm:h-[min(72dvh,38rem)] sm:w-[min(70vw,54rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          sizes="(max-width: 640px) 88vw, (max-width: 1280px) 70vw, 864px"
          className="object-cover"
        />
      </div>
    </div>
  );
}
