"use client";

import {
  AlertTriangle,
  CarTaxiFront,
  Landmark,
  MapPinned,
  Smartphone,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatInput } from "../../components/ChatInput";
import { LoginModal } from "../../components/LoginModal";
import { UserProfileAvatar } from "../../components/UserProfileAvatar";
import { useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { CreateChatResponse } from "@/lib/api/types";
import { useCurrentUser } from "@/features/auth/use-current-user";
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
  {
    Icon: typeof WalletCards;
    colorClass: string;
  }
> = {
  payment: {
    Icon: WalletCards,
    colorClass: "text-blue-300",
  },
  itinerary_planning: {
    Icon: MapPinned,
    colorClass: "text-cyan-300",
  },
  internet_apps: {
    Icon: Smartphone,
    colorClass: "text-purple-300",
  },
  transport: {
    Icon: CarTaxiFront,
    colorClass: "text-amber-300",
  },
  tickets_booking: {
    Icon: Landmark,
    colorClass: "text-emerald-300",
  },
  emergency: {
    Icon: AlertTriangle,
    colorClass: "text-red-300",
  },
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user, isLoadingUser } = useCurrentUser();

  function waitForChatStart() {
    return new Promise((resolve) => {
      setTimeout(resolve, CHAT_START_DELAY_MS);
    });
  }

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

      await waitForChatStart();
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

  function handleSubmit() {
    void submitQuestion(question);
  }

  return (
    <main className="relative min-h-[100svh] min-h-[100dvh] overflow-hidden bg-[#14243a] text-white">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url("/home-great-wall.png")',
          backgroundPosition: "center center",
          backgroundSize: "cover",
        }}
        aria-hidden="true"
      />
      {/* Darkened gradient overlays for better contrast */}
      <div
        className="fixed inset-0 z-0 bg-black/20"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-black/60 via-transparent to-black/60"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-[100svh] min-h-[100dvh] flex-col px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)] sm:px-8 sm:py-6 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl text-white outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/50 sm:gap-3"
            aria-label="ChinaTrip AI home"
          >
            <Image
              src="/logo-img.png"
              alt="ChinaTrip AI logo"
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0 rounded-full bg-white object-cover shadow-[0_0_15px_rgba(255,255,255,0.2)] sm:h-10 sm:w-10"
            />
            <span className="truncate text-xl font-medium tracking-tight text-white sm:text-[1.45rem] lg:text-[1.55rem]">
              ChinaTrip AI
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
            {isLoadingUser ? (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 p-1 ring-1 ring-white/25 backdrop-blur-md sm:w-[10.5rem] sm:justify-start sm:gap-2 sm:py-1.5 sm:pl-2 sm:pr-4"
                aria-label="Loading account"
              >
                <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/30" />
                <span className="hidden h-3 w-24 animate-pulse rounded-full bg-white/20 sm:block" />
              </div>
            ) : user ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 p-1 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-md sm:w-auto sm:justify-start sm:gap-2 sm:py-1.5 sm:pl-2 sm:pr-4">
                <UserProfileAvatar
                  avatarUrl={user.avatarUrl}
                  name={user.name}
                  email={user.email}
                  size={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/45"
                  fallbackClassName="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/18 text-xs font-bold text-white ring-1 ring-white/45"
                />
                <span className="hidden max-w-36 truncate sm:inline">
                  {user.name ?? user.email ?? "Signed in"}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 sm:px-5"
              >
                Log in
              </button>
            )}
          </nav>
        </header>

        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center pb-20 pt-10 text-center sm:pt-16 lg:-mt-8 lg:pb-24">
          <h1 className="max-w-5xl text-balance text-[2.5rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[4.45rem] lg:text-[5.5rem]">
            Your AI Travel Guide for China
          </h1>
          <p className="mt-4 max-w-3xl text-[0.95rem] font-normal leading-relaxed text-white/80 sm:mt-6 sm:text-xl sm:leading-8">
            Ask practical questions about China travel, payments, transport,
            apps, food, and local tips. Get answers you can save and share.
          </p>

          <ChatInput
            value={question}
            onChange={setQuestion}
            onSubmit={handleSubmit}
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

          <div className="mt-5 flex w-full max-w-[72rem] flex-wrap items-center justify-center gap-2 sm:mt-10 sm:gap-3.5">
            {HOME_QUICK_QUESTIONS.map((item, index) => {
              const { Icon, colorClass } = questionStyles[item.id];

              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (!isSubmitting) {
                      setQuestion(item.question);
                    }
                  }}
                  className={`inline-flex h-10 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-white/18 bg-white/14 px-3 text-left text-[0.78rem] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white/22 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/45 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-white/14 sm:min-h-[3.15rem] sm:gap-2.5 sm:rounded-2xl sm:bg-white/10 sm:px-4 sm:py-2 sm:text-sm sm:font-medium sm:hover:bg-white/18 ${
                    index >= 4 ? "hidden sm:inline-flex" : ""
                  }`}
                >
                  <Icon
                    className={`h-[15px] w-[15px] shrink-0 sm:h-[18px] sm:w-[18px] ${colorClass}`}
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
        </section>
      </div>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </main>
  );
}
