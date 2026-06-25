"use client";

import { Pencil, Send } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  variant?: "hero" | "chat";
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask about your China trip...",
  className = "",
  disabled = false,
  variant = "hero",
}: ChatInputProps) {
  const canSubmit = !disabled && value.trim().length > 0;
  const isChatVariant = variant === "chat";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight when text is deleted
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
      setIsOverflowing(scrollHeight > 120);
    }
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (canSubmit) {
        onSubmit();
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div
        className={`relative flex items-end gap-3 overflow-hidden rounded-2xl border p-3 backdrop-blur-md transition ${
          isChatVariant
            ? "border-white/70 bg-[linear-gradient(145deg,#FFFFFF_0%,#FFFDF9_48%,#F6EEE3_100%)] shadow-[0_24px_60px_rgba(10,18,30,0.18),0_1px_0_rgba(255,255,255,0.85)_inset] ring-1 ring-[#E6D8C7]/55"
            : "border-slate-200 bg-white shadow-lg shadow-slate-900/8"
        }`}
      >
        {isChatVariant ? (
          <div
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
            aria-hidden="true"
          />
        ) : null}
        <Pencil
          className={`relative z-10 mb-2.5 h-5 w-5 shrink-0 rotate-270 ${
            isChatVariant ? "text-[#9A8D80]" : "text-slate-400"
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
        <div className="relative z-10 mb-2 flex-1">
          {value.length === 0 && (
            <div
              className={`pointer-events-none absolute left-0 top-0 text-[0.95rem] leading-6 ${
                isChatVariant ? "text-[#9A8D80]" : "text-slate-400"
              }`}
            >
              <span className="truncate">{placeholder}</span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className={`block max-h-[120px] w-full resize-none bg-transparent py-0 text-[0.95rem] leading-6 outline-none disabled:cursor-not-allowed ${
              isChatVariant
                ? "text-[#26384D] disabled:text-[#9A8D80]"
                : "text-slate-900 disabled:text-slate-500"
            } ${
              isOverflowing ? "overflow-y-auto" : "overflow-hidden"
            }`}
            aria-label={placeholder}
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition focus-visible:ring-2 sm:h-10 sm:w-10 ${
            canSubmit
              ? "bg-[linear-gradient(135deg,#8A552B,#14243A)] text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.10)] hover:brightness-105 focus-visible:ring-[#D49A52]/45"
              : isChatVariant
                ? "cursor-not-allowed bg-[#B7ADA3] text-white focus-visible:ring-[#B7ADA3]/35"
                : "cursor-not-allowed bg-[#0006] text-white focus-visible:ring-slate-400"
          }`}
          aria-label="Send message"
        >
          <Send
            className="h-4.5 w-4.5 fill-current"
            strokeWidth={2.35}
          />
        </button>
      </div>
    </form>
  );
}
