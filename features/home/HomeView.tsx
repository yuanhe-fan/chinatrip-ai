"use client";

import {
  AlertTriangle,
  CarTaxiFront,
  Landmark,
  MapPinned,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { CreateChatResponse } from "@/lib/api/types";
import {
  HOME_QUICK_QUESTIONS,
  findQuickQuestionByExactQuestion,
  type QuickQuestionId,
} from "@/lib/quick-questions/questions";

const CHAT_START_DELAY_MS = 350;
const HOME_INPUT_EMPTY_ONCE_KEY = "chinatrip:home-empty-once";
const DEFAULT_HOME_QUESTION =
  "Plan a one-day Beijing itinerary for a first-time visitor.";

const questionStyles: Record<
  QuickQuestionId,
  { Icon: typeof WalletCards; colorClass: string }
> = {
  payment: { Icon: WalletCards, colorClass: "text-blue-300" },
  itinerary_planning: { Icon: MapPinned, colorClass: "text-cyan-300" },
  internet_apps: { Icon: Smartphone, colorClass: "text-purple-300" },
  transport: { Icon: CarTaxiFront, colorClass: "text-amber-300" },
  tickets_booking: { Icon: Landmark, colorClass: "text-emerald-300" },
  emergency: { Icon: AlertTriangle, colorClass: "text-red-300" },
};

function getInitialHomeQuestion() {
  if (typeof window === "undefined") {
    return DEFAULT_HOME_QUESTION;
  }

  if (window.sessionStorage.getItem(HOME_INPUT_EMPTY_ONCE_KEY)) {
    window.sessionStorage.removeItem(HOME_INPUT_EMPTY_ONCE_KEY);
    return "";
  }

  return DEFAULT_HOME_QUESTION;
}

export function HomeView() {
  const router = useRouter();
  const [question, setQuestion] = useState(getInitialHomeQuestion);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitQuestion(value: string) {
    const trimmedQuestion = value.trim();

    if (!trimmedQuestion || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const quickQuestion = findQuickQuestionByExactQuestion(trimmedQuestion);
      const response = await apiFetch<CreateChatResponse>("/chats", {
        message: trimmedQuestion,
        source: "home",
        ...(quickQuestion
          ? {
              promptProfile: quickQuestion.promptProfile,
              sourceQuestionId: quickQuestion.id,
            }
          : {}),
      });

      await new Promise((resolve) => setTimeout(resolve, CHAT_START_DELAY_MS));
      router.push(`/chat/${response.chat.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Failed to create chat. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ChatInput
        value={question}
        onChange={setQuestion}
        onSubmit={() => void submitQuestion(question)}
        disabled={isSubmitting}
        className="mt-8 w-full max-w-[45rem] sm:mt-12 lg:max-w-[49rem]"
      />

      {isSubmitting && !errorMessage ? (
        <div
          className="mt-4 flex w-full max-w-[45rem] items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/25 bg-black/35 px-4 py-2.5 text-white shadow-[0_16px_38px_rgba(0,0,0,0.22)] backdrop-blur-md sm:px-5">
            <span
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-amber-300"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-semibold text-white">
              Preparing your chat...
            </span>
          </div>
        </div>
      ) : errorMessage ? (
        <p className="mt-3 max-w-[45rem] text-sm font-medium text-red-100">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 flex w-full max-w-[22rem] flex-wrap items-center justify-center gap-x-1.5 gap-y-2 sm:mt-10 sm:max-w-[72rem] sm:gap-3.5">
        {HOME_QUICK_QUESTIONS.map((item, index) => {
          const { Icon, colorClass } = questionStyles[item.id];

          return (
            <button
              key={item.label}
              type="button"
              disabled={isSubmitting}
              onClick={() => !isSubmitting && setQuestion(item.question)}
              className={`inline-flex h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-white/16 bg-white/12 px-2.5 text-left text-[0.76rem] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.10)] backdrop-blur-md transition hover:bg-white/18 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/45 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-white/12 sm:min-h-[3.15rem] sm:gap-2.5 sm:rounded-2xl sm:border-white/18 sm:bg-white/10 sm:px-4 sm:py-2 sm:text-sm sm:font-medium sm:shadow-[0_10px_28px_rgba(0,0,0,0.12)] sm:hover:bg-white/18 ${
                index >= 4 ? "hidden sm:inline-flex" : ""
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 sm:h-[18px] sm:w-[18px] ${colorClass}`}
                strokeWidth={2.5}
              />
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span className="hidden max-w-52 truncate text-[0.72rem] font-medium text-white/68 sm:block">
                  {item.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
