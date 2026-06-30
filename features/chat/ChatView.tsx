"use client";

import { ChatInput } from "@/components/ChatInput";
import { AnswerContent } from "@/components/AnswerContent";
import { AnswerSources } from "@/components/AnswerSources";
import { ImagePreviewOverlay } from "@/components/ImagePreviewOverlay";
import { LoginModal } from "@/components/LoginModal";
import { UserProfileAvatar } from "@/components/UserProfileAvatar";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useCurrentUser } from "@/features/auth/use-current-user";
import {
  ChatDetailMessage,
  ChatDetailResponse,
  ChatHistoryItem,
  ChatHistoryResponse,
  CreateClarificationResponse,
  CreateSharedAnswerResponse,
  LogoutResponse,
  MeResponse,
  SendMessageRequest,
  SendMessageResponse,
  StreamMessageEvent,
} from "@/lib/api/types";
import {
  getPoiAssetGroup,
  type AnswerAsset,
} from "@/lib/answer-assets/registry";
import { DayPicker, type ClassNames } from "@daypicker/react";
import { zhCN } from "@daypicker/react/locale/zh-CN";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CirclePlus,
  Copy,
  History,
  LogOut,
  Menu,
  MoreHorizontal,
  Share2,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ComponentType,
  KeyboardEvent,
  MouseEvent,
  SVGProps,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChatMessage,
  MockChat,
  ActiveClarificationFlow,
  ClarificationSubmission,
  createChatTitle,
  createMessage,
} from "./mock-chat";

const CHAT_DETAIL_LOADING_AFTER_RESPONSE_MS = 1000;
const GENERATION_DONE_HOLD_MS = 250;
const GENERATION_PROGRESS_INTERVAL_MS = 180;
const STREAM_TYPEWRITER_INTERVAL_MS = 34;
const STREAM_SCROLL_THROTTLE_MS = 120;
const STREAM_BOTTOM_THRESHOLD_PX = 96;
const FORCE_BOTTOM_SECOND_PASS_DELAY_MS = 100;
const AI_QUOTA_EXHAUSTED_CODE = "AI_QUOTA_EXHAUSTED";
const AI_QUOTA_EXHAUSTED_MESSAGE =
  "Today's AI usage has been used up. Please come back tomorrow.";
const CHAT_NOT_FOUND_CODE = "CHAT_NOT_FOUND";
const CHAT_NOT_FOUND_STREAM_MESSAGE =
  "This chat is no longer available in this browser session. Please start a new chat.";
const CONTINUE_TRUNCATED_ANSWER_PROMPT =
  "Continue the previous answer from where it stopped.";
const HOME_INPUT_EMPTY_ONCE_KEY = "chinatrip:home-empty-once";

const USER_MESSAGE_SURFACE_CLASS =
  "border border-white bg-[linear-gradient(135deg,#8A552B,#14243A)] shadow-[0_30px_68px_rgba(2,8,23,0.5),0_8px_18px_rgba(2,8,23,0.24),0_0_0_1px_rgba(255,255,255,0.22),0_0_40px_rgba(255,248,239,0.28),0_1px_0_rgba(255,255,255,0.62)_inset,0_-10px_22px_rgba(2,8,23,0.16)_inset] backdrop-blur-[3px] backdrop-saturate-125";
const USER_AVATAR_SURFACE_CLASS =
  "border border-white bg-[linear-gradient(135deg,#8A552B,#14243A)] shadow-[0_20px_38px_rgba(2,8,23,0.42),0_8px_18px_rgba(2,8,23,0.18),0_0_0_1px_rgba(255,255,255,0.24),0_0_30px_rgba(255,248,239,0.30),0_1px_0_rgba(255,255,255,0.68)_inset]";
const ASSISTANT_SURFACE_CLASS =
  "border border-white/80 bg-white shadow-[0_28px_70px_rgba(10,18,30,0.22),0_8px_18px_rgba(10,18,30,0.08),0_1px_0_rgba(255,255,255,0.95)_inset] ring-1 ring-[#E6D8C7]/60";
const ASSISTANT_AVATAR_SURFACE_CLASS =
  "border border-white/80 bg-[#FFFDF9] shadow-[0_18px_38px_rgba(10,18,30,0.16),0_8px_18px_rgba(10,18,30,0.07),0_1px_0_rgba(255,255,255,0.95)_inset] ring-1 ring-[#E6D8C7]/60";

type DetailLoadingReason = "initial" | "history" | null;

type StreamBuffer = {
  targetChatId: string;
  text: string;
};

type ImagePreviewState = {
  assets: AnswerAsset[];
  index: number;
};

function toChatMessage(message: ChatDetailMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content:
      message.status === "failed"
        ? message.errorMessage || "Message failed."
        : message.content,
    createdAt: message.createdAt,
    status:
      message.status === "pending"
        ? "loading"
        : message.status === "failed"
        ? "failed"
        : "complete",
    errorCode: message.errorCode,
    visuals: message.visuals,
    sources: message.sources,
    quickQuestionMenu: message.quickQuestionMenu,
    truncated: message.truncated,
    maybeTruncated: message.maybeTruncated,
    finishReason: message.finishReason,
  };
}

function toUserChatMessage(
  message: SendMessageResponse["userMessage"],
): ChatMessage {
  return {
    id: message.id,
    role: "user",
    content: message.content,
    createdAt: message.createdAt,
    status: "complete",
  };
}

function toAssistantChatMessage(
  message: SendMessageResponse["assistantMessage"],
): ChatMessage {
  return {
    id: message.id,
    role: "assistant",
    content:
      message.status === "failed"
        ? message.errorMessage || "Message failed."
        : message.content,
    createdAt: message.createdAt,
    status: message.status,
    errorCode: message.errorCode,
    visuals: message.visuals,
    sources: message.sources,
    quickQuestionMenu: message.quickQuestionMenu,
    truncated: message.truncated,
    maybeTruncated: message.maybeTruncated,
    finishReason: message.finishReason,
  };
}

function toPendingAssistantChatMessage(
  message: Extract<StreamMessageEvent, { type: "created" }>["assistantMessage"],
): ChatMessage {
  return {
    id: message.id,
    role: "assistant",
    content: "",
    createdAt: message.createdAt,
    status: "loading",
    progress: 1,
  };
}

function parseStreamEvent(rawEvent: string): StreamMessageEvent | null {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join("\n")) as StreamMessageEvent;
}

function UserAvatar({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "default" | "message";
}) {
  const avatarSize = size === "message" ? "h-10 w-10" : "h-9 w-9";
  const iconSize = size === "message" ? "h-5 w-5" : "h-[1.125rem] w-[1.125rem]";

  return (
    <div
      className={`${avatarSize} ${USER_AVATAR_SURFACE_CLASS} flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[#FFF8EF] ${className}`}
    >
      <UserRound className={`${iconSize} stroke-[2.25]`} />
    </div>
  );
}

function BotBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ${ASSISTANT_AVATAR_SURFACE_CLASS} ${className}`}
    >
      <Image
        src="/logo-img.png"
        alt="ChinaTrip AI"
        width={36}
        height={36}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function Sidebar({
  currentChatId,
  chatHistory,
  isLoadingHistory,
  onNewChat,
  onSelectChat,
  onClose,
  onOpenLogin,
  user,
  isLoadingUser,
  onLogout,
}: {
  currentChatId: string;
  chatHistory: ChatHistoryItem[];
  isLoadingHistory: boolean;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onClose?: () => void;
  onOpenLogin: () => void;
  user: MeResponse["user"];
  isLoadingUser: boolean;
  onLogout: () => void;
}) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  function markHomeInputEmptyOnce() {
    window.sessionStorage.setItem(HOME_INPUT_EMPTY_ONCE_KEY, "1");
  }

  return (
    <aside className="flex h-full w-[17.125rem] max-w-[86vw] shrink-0 flex-col border-r border-[#E6D8C7] bg-white/82 text-[#172033] shadow-[12px_0_36px_rgba(20,36,58,0.05)] backdrop-blur-xl">
      <div className="flex h-[4.25rem] shrink-0 items-center justify-between gap-3 px-5">
        <Link
          href="/"
          onClick={markHomeInputEmptyOnce}
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
          <span className="truncate text-xl font-semibold tracking-tight">
            ChinaTrip AI
          </span>
        </Link>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#74685C] transition hover:bg-[#EEF4F6] hover:text-[#14243A] focus-visible:ring-2 focus-visible:ring-[#D49A52]/40 lg:hidden"
            aria-label="Close chat history"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-11 w-full items-center justify-between rounded-xl bg-[linear-gradient(135deg,#8A552B,#14243A)] px-4 text-left text-sm font-semibold text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.10)] transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#D49A52]/45"
        >
          <span className="inline-flex items-center gap-2">
            <CirclePlus className="h-4.5 w-4.5" />
            New Chat
          </span>
        </button>

        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pb-3 pr-1">
          {isLoadingHistory ? (
            <div className="rounded-xl px-3 py-3 text-sm font-medium text-[#74685C]">
              Loading chats...
            </div>
          ) : chatHistory.length === 0 ? (
            <div className="rounded-xl px-3 py-3 text-sm font-medium text-[#74685C]">
              No chats yet
            </div>
          ) : (
            chatHistory.map((chat) => {
              const isActive = chat.id === currentChatId;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-[#D49A52]/40 ${
                    isActive
                      ? "bg-[linear-gradient(135deg,#8A552B,#14243A)] text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.10)]"
                      : "hover:bg-[#F4F7F7]"
                  }`}
                >
                  <History
                    className={`h-4.5 w-4.5 shrink-0 ${
                      isActive ? "text-[#FFF8EF]" : "text-[#9A8D80]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${
                        isActive ? "text-[#FFF8EF]" : "text-[#3F4C5F]"
                      }`}
                    >
                      {chat.title}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-xs ${
                        isActive ? "text-[#FFF8EF]/70" : "text-[#74685C]"
                      }`}
                    >
                      {chat.preview ?? "No messages yet"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </div>

      <div className="relative z-30 shrink-0 border-t border-[#E6D8C7]/70 px-5 py-4">
        {!isLoadingUser && user && isAccountMenuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setIsAccountMenuOpen(false)}
              aria-label="Close account menu"
            />
            <div className="absolute bottom-[4.6rem] right-5 z-20 w-44 rounded-2xl border border-[#E6D8C7]/90 bg-[#FFFDF9] p-1.5 shadow-[0_18px_40px_rgba(20,36,58,0.14),0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-white/70">
              <span
                className="absolute -bottom-1.5 right-3 h-3 w-3 rotate-45 border-b border-r border-[#E6D8C7]/90 bg-[#FFFDF9]"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onLogout();
                }}
                className="relative z-10 flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-[#6F6258] transition hover:bg-[#FFF8EF] hover:text-[#14243A] focus-visible:ring-2 focus-visible:ring-[#D49A52]/40"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EEF4F6] text-[#9A8D80]">
                  <LogOut className="h-4 w-4" />
                </span>
                Log out
              </button>
            </div>
          </>
        ) : null}

        <div className="flex items-center gap-3">
          <div
            onClick={user || isLoadingUser ? undefined : onOpenLogin}
            onKeyDown={(event) => {
              if (user || isLoadingUser) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenLogin();
              }
            }}
            role="button"
            tabIndex={0}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition focus-visible:ring-2 focus-visible:ring-[#D49A52]/40 ${
              user || isLoadingUser ? "" : "cursor-pointer hover:bg-[#EEF4F6]"
            }`}
          >
            {isLoadingUser ? (
              <>
                <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[#E6D8C7]" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3 w-24 animate-pulse rounded-full bg-[#E6D8C7]" />
                  <span className="block h-2.5 w-32 animate-pulse rounded-full bg-[#EEF4F6]" />
                </span>
              </>
            ) : user ? (
              <UserProfileAvatar
                avatarUrl={user.avatarUrl}
                name={user.name}
                email={user.email}
                size={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[#E6D8C7]"
                fallbackClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8A552B,#14243A)] text-sm font-bold text-[#FFF8EF] ring-1 ring-[#E6D8C7]"
              />
            ) : (
              <UserAvatar />
            )}
            {!isLoadingUser ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#172033]">
                  {user?.name ?? user?.email ?? "Guest User"}
                </p>
                <p className="truncate text-xs text-[#74685C]">
                  {user ? user.email ?? "Signed in" : "Sign in to save"}
                </p>
              </div>
            ) : null}
          </div>
          {!isLoadingUser && user ? (
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((value) => !value)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9A8D80] transition hover:bg-[#EEF4F6] hover:text-[#14243A] focus-visible:ring-2 focus-visible:ring-[#D49A52]/40"
              aria-label="Account options"
              aria-expanded={isAccountMenuOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function UserMessageBubble({
  content,
  user,
}: {
  content: string;
  user: MeResponse["user"];
}) {
  return (
    <div className="flex items-start justify-end gap-0 sm:gap-3">
      <div className={`max-w-[36rem] whitespace-pre-line rounded-[1.25rem] rounded-tr-sm px-4 py-3 text-[0.94rem] leading-7 text-[#FFF8EF] sm:px-6 sm:py-4 ${USER_MESSAGE_SURFACE_CLASS}`}>
        {content}
      </div>
      {user ? (
        <UserProfileAvatar
          avatarUrl={user.avatarUrl}
          name={user.name}
          email={user.email}
          size={40}
          className={`hidden h-10 w-10 shrink-0 rounded-full object-cover sm:mt-1 sm:block ${USER_AVATAR_SURFACE_CLASS}`}
          fallbackClassName={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#FFF8EF] sm:mt-1 sm:flex ${USER_AVATAR_SURFACE_CLASS}`}
        />
      ) : (
        <UserAvatar className="hidden sm:mt-1 sm:flex" size="message" />
      )}
    </div>
  );
}

type MessageActionTone = "save" | "share" | "copy";

const actionToneClasses: Record<
  MessageActionTone,
  { iconWrap: string; icon: string }
> = {
  save: {
    iconWrap: "bg-emerald-50",
    icon: "text-emerald-600",
  },
  share: {
    iconWrap: "bg-sky-50",
    icon: "text-sky-600",
  },
  copy: {
    iconWrap: "bg-amber-50",
    icon: "text-amber-600",
  },
};

function MessageActionButton({
  Icon,
  label,
  tone,
  onClick,
  disabled = false,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  tone: MessageActionTone;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  const toneClasses = actionToneClasses[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex h-9 items-center gap-2 rounded-xl border border-white/80 bg-transparent px-2.5 pr-3 text-sm font-semibold text-[#5E5148] shadow-[0_8px_18px_rgba(20,36,58,0.08),0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-[#E6D8C7]/60 transition duration-200 hover:-translate-y-0.5 hover:border-[#D49A52]/45 hover:bg-white/35 hover:text-[#14243A] hover:shadow-[0_14px_28px_rgba(20,36,58,0.13),0_1px_0_rgba(255,255,255,0.95)_inset] focus-visible:ring-2 focus-visible:ring-[#D49A52]/45 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-white/80 disabled:hover:bg-transparent"
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full shadow-[0_4px_10px_rgba(20,36,58,0.08)] transition duration-200 group-hover:scale-105 ${toneClasses.iconWrap}`}
      >
        <Icon className={`h-3.5 w-3.5 ${toneClasses.icon}`} />
      </span>
      {label}
    </button>
  );
}

function QuickQuestionMenuPanel({
  menu,
  onSelect,
}: {
  menu: NonNullable<ChatMessage["quickQuestionMenu"]>;
  onSelect: (
    subQuestion: NonNullable<ChatMessage["quickQuestionMenu"]>["subQuestions"][number],
    menu: NonNullable<ChatMessage["quickQuestionMenu"]>,
  ) => void;
}) {
  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-[#E6D8C7]/80 bg-[#FFF8EF]/72 p-3 shadow-[0_14px_34px_rgba(20,36,58,0.06),0_1px_0_rgba(255,255,255,0.86)_inset] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8A552B]">
          Pick a specific question
        </p>
        <span className="shrink-0 rounded-full border border-[#E6D8C7] bg-white/70 px-2.5 py-1 text-xs font-bold text-[#74685C]">
          {menu.subQuestions.length}
        </span>
      </div>
      <div className="grid gap-2">
        {menu.subQuestions.map((subQuestion) => (
          <button
            key={subQuestion.id}
            type="button"
            onClick={() => onSelect(subQuestion, menu)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/85 bg-white/78 px-3.5 py-3 text-left text-sm font-semibold leading-5 text-[#26384D] shadow-[0_8px_18px_rgba(20,36,58,0.06),0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-[#E6D8C7]/50 transition hover:-translate-y-0.5 hover:border-[#D49A52]/55 hover:bg-white hover:text-[#14243A] hover:shadow-[0_14px_28px_rgba(20,36,58,0.11)] focus-visible:ring-2 focus-visible:ring-[#D49A52]/45"
          >
            <span className="min-w-0">
              <span className="block text-xs font-extrabold uppercase tracking-[0.08em] text-[#8A552B]">
                {subQuestion.label}
              </span>
              <span className="mt-0.5 block break-words [overflow-wrap:anywhere]">
                {subQuestion.question}
              </span>
            </span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8A552B,#14243A)] text-[#FFF8EF] shadow-[0_8px_18px_rgba(20,36,58,0.12)] transition group-hover:scale-105">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
      <p className="border-t border-[#E6D8C7]/70 pt-3 text-xs font-semibold leading-5 text-[#74685C]">
        If your question is different, type it below and I&apos;ll answer it
        directly.
      </p>
    </div>
  );
}

function isItineraryPlanningRequest(value: string) {
  const normalized = value.toLowerCase();

  return (
    /\b(itinerary|plan a trip|travel plan|trip plan|route|schedule|day trip|one-day|1-day|2-day|3-day|4-day|5-day|five-day|hours in)\b/.test(
      normalized,
    ) ||
    /(行程|旅游计划|旅行计划|几日游|日游|攻略|路线安排|制定.*游|北京.*游|上海.*游|成都.*游|西安.*游|中国.*游)/.test(
      value,
    )
  );
}

function mergeClarifiedTripContext(
  flow: ActiveClarificationFlow,
): ClarificationSubmission {
  const context = { ...flow.flow.extractedContext };

  for (const question of flow.flow.questions) {
    const answer = flow.answers[question.id];
    const otherAnswer = flow.otherAnswers[question.id]?.trim();
    const normalizedAnswer = Array.isArray(answer)
      ? [...answer, ...(otherAnswer ? [otherAnswer] : [])]
      : otherAnswer || answer;

    if (!normalizedAnswer || (Array.isArray(normalizedAnswer) && normalizedAnswer.length === 0)) {
      continue;
    }

    if (/city|destination|where/i.test(question.id + question.title)) {
      context.destination = Array.isArray(normalizedAnswer)
        ? normalizedAnswer.join(", ")
        : normalizedAnswer;
      continue;
    }

    if (/day|duration|how many/i.test(question.id + question.title)) {
      const rawValue = Array.isArray(normalizedAnswer)
        ? normalizedAnswer[0]
        : normalizedAnswer;
      const dayMatch = rawValue.match(/\d+/);

      if (dayMatch) {
        context.days = Number(dayMatch[0]);
      } else {
        context.notes = [context.notes, `Days: ${rawValue}`]
          .filter(Boolean)
          .join("\n");
      }
      continue;
    }

    if (/arrival|arrive|抵达|到达/i.test(question.id + question.title)) {
      context.arrivalTime = Array.isArray(normalizedAnswer)
        ? normalizedAnswer.join(", ")
        : normalizedAnswer;
      continue;
    }

    if (/departure|depart|leave|leaving|离开|返程/i.test(question.id + question.title)) {
      context.departureTime = Array.isArray(normalizedAnswer)
        ? normalizedAnswer.join(", ")
        : normalizedAnswer;
      continue;
    }

    if (/traveler|people|companion|同行|老人|kid|family/i.test(question.id + question.title)) {
      context.travelers = Array.isArray(normalizedAnswer)
        ? normalizedAnswer.join(", ")
        : normalizedAnswer;
      continue;
    }

    if (/pace|speed|relaxed|节奏|walking|walk/i.test(question.id + question.title)) {
      context.pace = Array.isArray(normalizedAnswer)
        ? normalizedAnswer.join(", ")
        : normalizedAnswer;
      continue;
    }

    if (/budget|cost|预算/i.test(question.id + question.title)) {
      context.budget = Array.isArray(normalizedAnswer)
        ? normalizedAnswer.join(", ")
        : normalizedAnswer;
      continue;
    }

    if (/interest|like|prefer|兴趣|museum|food|history|shopping/i.test(question.id + question.title)) {
      context.interests = Array.isArray(normalizedAnswer)
        ? normalizedAnswer
        : [normalizedAnswer];
      continue;
    }

    if (/diet|food|allergy|spicy|halal|vegetarian|饮食|忌口|过敏/i.test(question.id + question.title)) {
      context.dietaryNeeds = Array.isArray(normalizedAnswer)
        ? normalizedAnswer
        : [normalizedAnswer];
      continue;
    }

    context.notes = [
      context.notes,
      `${question.title}: ${
        Array.isArray(normalizedAnswer)
          ? normalizedAnswer.join(", ")
          : normalizedAnswer
      }`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return {
    sourceQuestion: flow.sourceQuestion,
    context,
  };
}

function hasCjkText(value: string) {
  return /[\u3400-\u9FFF]/.test(value);
}

const COMPACT_DAY_PICKER_CLASS_NAMES: Partial<ClassNames> = {
  root: "relative w-full",
  months: "flex justify-center",
  month: "w-full",
  month_caption: "mb-2 flex h-8 items-center justify-center text-sm font-extrabold text-[#26384D]",
  caption_label: "text-sm font-extrabold text-[#26384D]",
  nav: "absolute left-3 right-3 top-3 flex items-center justify-between",
  button_previous:
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#E6D8C7] bg-white/76 text-[#8A552B] transition hover:border-[#D49A52] hover:bg-[#FFF8EF]",
  button_next:
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#E6D8C7] bg-white/76 text-[#8A552B] transition hover:border-[#D49A52] hover:bg-[#FFF8EF]",
  chevron: "h-4 w-4 fill-current",
  month_grid: "w-full border-collapse",
  weekdays: "grid grid-cols-7",
  weekday: "py-1 text-center text-[0.68rem] font-bold text-[#9A8D80]",
  week: "grid grid-cols-7 gap-1",
  day: "aspect-square p-0 text-center",
  day_button:
    "h-8 w-8 rounded-xl text-sm font-bold text-[#26384D] transition hover:bg-[#FFF8EF] hover:text-[#8A552B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A52]/30",
  today:
    "[&>button]:border [&>button]:border-[#D49A52] [&>button]:bg-[#FFF8EF] [&>button]:text-[#8A552B]",
  selected:
    "[&>button]:bg-[linear-gradient(135deg,#8A552B,#14243A)] [&>button]:text-[#FFF8EF] [&>button]:shadow-[0_10px_22px_rgba(20,36,58,0.14)]",
  outside: "opacity-35",
};

function formatDateAnswer(value: string, language: "en" | "zh") {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return value;
  }

  const [, year, month, day] = match;

  if (language === "zh") {
    return `${year}年${month}月${day}日`;
  }

  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(
    date,
  );

  return `${monthLabel} ${Number(day)}, ${year}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateValue(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

function parseDateDraft(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;

    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return undefined;
}

function DateTimeAnswerInput({
  value,
  questionTitle,
  sourceQuestion,
  onConfirm,
}: {
  value: string;
  questionTitle: string;
  sourceQuestion: string;
  onConfirm: (value: string) => void;
}) {
  const language =
    hasCjkText(questionTitle) || hasCjkText(sourceQuestion) ? "zh" : "en";
  const placeholder = language === "zh" ? "选择日期" : "Select date";
  const confirmLabel = language === "zh" ? "确定" : "Confirm";
  const cancelLabel = language === "zh" ? "取消" : "Cancel";
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(() =>
    parseDateDraft(value),
  );
  const pickerRootRef = useRef<HTMLDivElement>(null);
  const selectedValue = value;
  const displayValue = selectedValue
    ? formatDateAnswer(selectedValue, language)
    : placeholder;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!pickerRootRef.current?.contains(target)) {
        setIsOpen(false);
        setDraftDate(parseDateDraft(value));
      }
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setDraftDate(parseDateDraft(value));
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isOpen, value]);

  function openPicker() {
    setDraftDate(parseDateDraft(value));
    setIsOpen(true);
  }

  function closePicker() {
    setIsOpen(false);
    setDraftDate(parseDateDraft(value));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openPicker();
  }

  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (!draftDate) {
      return;
    }

    setIsOpen(false);
    onConfirm(formatDateValue(draftDate));
  }

  return (
    <div ref={pickerRootRef} className="relative z-30">
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        className="group relative flex min-h-11 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-[#E6D8C7] bg-white/82 px-3.5 text-left text-sm shadow-[0_8px_18px_rgba(20,36,58,0.06),0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-[#E6D8C7]/45 transition duration-200 hover:-translate-y-0.5 hover:border-[#D49A52] hover:bg-[#FFF8EF] hover:shadow-[0_16px_32px_rgba(20,36,58,0.12)] focus-visible:border-[#D49A52] focus-visible:ring-2 focus-visible:ring-[#D49A52]/25"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#E6D8C7] bg-[#FFF8EF] text-[#8A552B] shadow-[0_6px_14px_rgba(20,36,58,0.06)] transition group-hover:border-[#D49A52]">
          <CalendarClock className="h-3.5 w-3.5" />
        </span>
        <span
          className={`min-w-0 flex-1 truncate font-semibold ${
            selectedValue ? "text-[#172033]" : "text-[#8E9AB0]"
          }`}
        >
          {displayValue}
        </span>
      </div>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          className="relative z-50 mt-2 w-full rounded-2xl border border-[#E6D8C7] bg-[linear-gradient(145deg,#FFFFFF_0%,#FFFDF9_55%,#F7EFE5_100%)] p-3 text-[#172033] shadow-[0_18px_38px_rgba(10,18,30,0.16),0_1px_0_rgba(255,255,255,0.95)_inset] ring-1 ring-[#E6D8C7]/55 sm:absolute sm:top-[calc(100%+0.45rem)] sm:left-0 sm:mt-0 sm:w-[20rem] sm:shadow-[0_30px_70px_rgba(10,18,30,0.26),0_1px_0_rgba(255,255,255,0.95)_inset]"
        >
          <DayPicker
            mode="single"
            selected={draftDate}
            onSelect={setDraftDate}
            locale={language === "zh" ? zhCN : undefined}
            classNames={COMPACT_DAY_PICKER_CLASS_NAMES}
            showOutsideDays
          />

          <div className="mt-3 flex justify-end gap-2 border-t border-[#E6D8C7]/70 pt-3">
            <button
              type="button"
              onClick={closePicker}
              className="h-9 rounded-xl border border-[#E6D8C7] bg-white/78 px-3.5 text-sm font-bold text-[#74685C] transition hover:border-[#D49A52] hover:bg-[#FFF8EF] hover:text-[#172033]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!draftDate}
              className="h-9 rounded-xl bg-[linear-gradient(135deg,#8A552B,#14243A)] px-3.5 text-sm font-bold text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClarificationFlowPanel({
  flow,
  isGenerating,
  onAnswer,
  onAnswerAndAdvance,
  onOtherAnswer,
  onBack,
  onNext,
  onCancel,
  onGenerate,
}: {
  flow: ActiveClarificationFlow;
  isGenerating: boolean;
  onAnswer: (questionId: string, value: string | string[]) => void;
  onAnswerAndAdvance: (questionId: string, value: string) => void;
  onOtherAnswer: (questionId: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  const questions = flow.flow.questions;
  const question = questions[flow.currentStepIndex];
  const isLastQuestion = flow.currentStepIndex >= questions.length - 1;
  const isFirstStep = flow.currentStepIndex === 0;
  const answer = question ? flow.answers[question.id] : undefined;
  const otherAnswer = question ? flow.otherAnswers[question.id] ?? "" : "";
  const questionLanguage =
    question && (hasCjkText(question.title) || hasCjkText(flow.sourceQuestion))
      ? "zh"
      : "en";
  const multiChoiceHint =
    questionLanguage === "zh"
      ? "可选择一个或多个选项"
      : "Select one or more options";
  const otherPlaceholder =
    questionLanguage === "zh" ? "请输入其他答案" : "Type your own answer";
  const hasAnswer = Boolean(
    question &&
      (!question.required ||
        (Array.isArray(answer) ? answer.length > 0 : answer) ||
        otherAnswer.trim()),
  );

  if (!question) {
    return null;
  }

  function toggleMultiChoice(value: string) {
    const current = Array.isArray(answer) ? answer : [];

    if (isFirstStep && !isLastQuestion) {
      onAnswer(question.id, [value]);
      onNext();
      return;
    }

    onAnswer(
      question.id,
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function handleDateTimeConfirm(value: string) {
    onAnswerAndAdvance(question.id, value);
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return;
    }

    event.preventDefault();

    if (!hasAnswer || isGenerating) {
      return;
    }

    onNext();
  }

  return (
    <div className="mx-auto w-full max-w-[52rem] pb-8">
      <div className="flex items-start gap-0 sm:gap-3">
        <BotBadge className="hidden sm:mt-1 sm:flex sm:h-10 sm:w-10" />
        <article className={`relative w-full overflow-visible rounded-[1.25rem] rounded-tl-sm p-5 text-[0.94rem] leading-7 text-[#26384D] sm:p-7 ${ASSISTANT_SURFACE_CLASS}`}>
          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8A552B]">
                  Trip setup
                </p>
                <h2 className="mt-1 text-lg font-extrabold leading-snug text-[#172033]">
                  {question.title}
                </h2>
              </div>
              <span className="shrink-0 rounded-full border border-[#E6D8C7] bg-[#FFF8EF] px-3 py-1 text-xs font-bold text-[#8A552B]">
                {flow.currentStepIndex + 1}/{flow.flow.questions.length}
              </span>
            </div>

            {question.description ? (
              <p className="text-sm font-medium leading-6 text-[#74685C]">
                {question.description}
              </p>
            ) : null}

            {question.type === "date_time" ? (
              <DateTimeAnswerInput
                key={question.id}
                value={typeof answer === "string" ? answer : ""}
                questionTitle={question.title}
                sourceQuestion={flow.sourceQuestion}
                onConfirm={handleDateTimeConfirm}
              />
            ) : question.type === "text" ? (
              <textarea
                value={typeof answer === "string" ? answer : ""}
                onChange={(event) => onAnswer(question.id, event.target.value)}
                onKeyDown={handleTextKeyDown}
                className="min-h-24 w-full resize-none rounded-2xl border border-[#E6D8C7] bg-white/80 px-4 py-3 text-sm font-medium text-[#172033] outline-none shadow-[0_8px_18px_rgba(20,36,58,0.06)] transition focus:border-[#D49A52] focus:ring-2 focus:ring-[#D49A52]/25"
                placeholder="Type your answer..."
              />
            ) : (
              <div className="space-y-2">
                {question.type === "multi_choice" ? (
                  <p className="text-xs font-bold text-[#8A552B]">
                    {multiChoiceHint}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options?.map((option) => {
                    const selected =
                      question.type === "multi_choice"
                        ? Array.isArray(answer) && answer.includes(option.value)
                        : answer === option.value;
                    const isMultiChoice = question.type === "multi_choice";

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          isMultiChoice
                            ? toggleMultiChoice(option.value)
                            : onAnswerAndAdvance(question.id, option.value)
                        }
                        className={`flex min-h-11 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold shadow-[0_8px_18px_rgba(20,36,58,0.06)] transition duration-200 focus-visible:ring-2 focus-visible:ring-[#D49A52]/40 ${
                          selected
                            ? "border-[#D49A52] bg-white/76 text-[#172033] shadow-[0_10px_22px_rgba(20,36,58,0.08)] ring-1 ring-[#D49A52]/35 hover:-translate-y-0.5 hover:border-[#C78335] hover:shadow-[0_14px_28px_rgba(20,36,58,0.11)]"
                            : "border-[#E6D8C7] bg-white/76 text-[#26384D] hover:-translate-y-0.5 hover:border-[#D49A52] hover:bg-[#FFF8EF] hover:text-[#14243A] hover:shadow-[0_16px_32px_rgba(20,36,58,0.14)]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center border transition ${
                            isMultiChoice ? "rounded-md" : "rounded-full"
                          } ${
                            selected
                              ? "border-[#D49A52] bg-white text-[#8A552B] shadow-[0_3px_8px_rgba(138,85,43,0.12)]"
                              : "border-[#D9C7B3] bg-white/72 text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          {isMultiChoice ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span
                              className={`h-2 w-2 rounded-full ${
                                selected ? "bg-[#8A552B]" : "bg-transparent"
                              }`}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 leading-5">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {question.allowOther ? (
              <input
                value={otherAnswer}
                onChange={(event) => onOtherAnswer(question.id, event.target.value)}
                className="h-11 w-full rounded-xl border border-[#E6D8C7] bg-white/80 px-4 text-sm font-medium text-[#172033] outline-none focus:border-[#D49A52] focus:ring-2 focus:ring-[#D49A52]/25"
                placeholder={otherPlaceholder}
              />
            ) : null}

            <div className="flex flex-col gap-2 border-t border-[#E6D8C7]/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onCancel}
                disabled={isGenerating}
                className="h-10 rounded-xl border border-[#E6D8C7] bg-white/60 px-4 text-sm font-bold text-[#74685C] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={flow.currentStepIndex === 0 || isGenerating}
                  className="h-10 rounded-xl border border-[#E6D8C7] bg-white/60 px-4 text-sm font-bold text-[#74685C] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={isLastQuestion ? onGenerate : onNext}
                  disabled={!hasAnswer || isGenerating}
                  className="h-10 rounded-xl bg-[linear-gradient(135deg,#8A552B,#14243A)] px-4 text-sm font-bold text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isLastQuestion ? "Generate itinerary" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function AssistantMessageBubble({
  status,
  content,
  visuals,
  sources,
  quickQuestionMenu,
  truncated,
  maybeTruncated,
  errorCode,
  progress,
  onCopy,
  onShare,
  onContinueAnswer,
  onQuickSubQuestion,
  onOpenImage,
  isSharing,
}: {
  status?: ChatMessage["status"];
  content: string;
  visuals?: ChatMessage["visuals"];
  sources?: ChatMessage["sources"];
  quickQuestionMenu?: ChatMessage["quickQuestionMenu"];
  truncated?: boolean;
  maybeTruncated?: boolean;
  errorCode?: string | null;
  progress?: number;
  onCopy: (content: string, event: MouseEvent<HTMLButtonElement>) => void;
  onShare: (event: MouseEvent<HTMLButtonElement>) => void;
  onContinueAnswer: () => void;
  onQuickSubQuestion: (
    subQuestion: NonNullable<ChatMessage["quickQuestionMenu"]>["subQuestions"][number],
    menu: NonNullable<ChatMessage["quickQuestionMenu"]>,
  ) => void;
  onOpenImage: (asset: AnswerAsset) => void;
  isSharing: boolean;
}) {
  const isLoading = status === "loading";
  const isFailed = status === "failed";
  const isQuotaExhausted =
    errorCode === AI_QUOTA_EXHAUSTED_CODE ||
    content === AI_QUOTA_EXHAUSTED_MESSAGE;
  const isStreaming = isLoading && content.trim().length > 0;
  const progressValue = Math.max(1, Math.min(100, Math.round(progress ?? 1)));
  const shouldShowContinue = truncated || maybeTruncated;
  const continuePromptText = truncated
    ? "This answer hit the output limit. Continue to get the rest."
    : "This answer may not be complete. Continue if you want more.";

  function renderProgress(label: string) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#8A552B]">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D49A52] [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D49A52] [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D49A52]" />
            </span>
            {label}
          </div>
          <span className="shrink-0 rounded-full border border-[#E6D8C7]/70 bg-[#FFF8EF] px-2.5 py-1 text-xs font-bold text-[#8A552B] shadow-[0_6px_14px_rgba(20,36,58,0.06)]">
            {progressValue}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF4F6] shadow-[inset_0_1px_2px_rgba(20,36,58,0.08)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#D49A52,#8A552B,#14243A)] shadow-[0_0_14px_rgba(212,154,82,0.34)] transition-all duration-500 ease-out"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0 sm:gap-3">
      <BotBadge className="hidden sm:mt-1 sm:flex sm:h-10 sm:w-10" />
      <article className={`relative w-full overflow-hidden rounded-[1.25rem] rounded-tl-sm p-5 text-[0.94rem] leading-7 text-[#26384D] sm:p-7 ${ASSISTANT_SURFACE_CLASS}`}>
        <div
          className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10">
          {isStreaming ? (
            <div className="space-y-5">
              <AnswerContent
                content={content}
                visuals={visuals}
                showCursor
                onOpenImage={onOpenImage}
              />
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E6D8C7]/70 bg-[#FFF8EF]/76 px-3 py-1.5 text-xs font-semibold text-[#8A552B] shadow-[0_8px_18px_rgba(20,36,58,0.06)]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D49A52] [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D49A52] [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D49A52]" />
                </span>
                Writing answer
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-5 text-[#74685C]">
              {renderProgress("Drafting response")}

              <div className="space-y-5 rounded-2xl border border-[#E6D8C7]/55 bg-[#FFFDF9]/72 p-4 shadow-[0_10px_24px_rgba(20,36,58,0.05)_inset]">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-[#D49A52]" />
                    <div className="h-3 w-36 animate-pulse rounded-full bg-[#E6D8C7]" />
                    <div className="h-px flex-1 bg-gradient-to-r from-[#E6D8C7] to-transparent" />
                  </div>
                  <div className="space-y-2.5">
                    <div className="h-3 w-full animate-pulse rounded-full bg-[#E6D8C7]" />
                    <div className="h-3 w-11/12 animate-pulse rounded-full bg-[#EEF4F6]" />
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-[#EEF4F6]" />
                  </div>
                </div>

                <div className="space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="h-6.5 w-6.5 shrink-0 animate-pulse rounded-full border border-[#E6D8C7] bg-[#FFF8EF]" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-32 animate-pulse rounded-full bg-[#E6D8C7]" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-[#EEF4F6]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : isFailed ? (
            isQuotaExhausted ? (
              <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-amber-950 shadow-[0_14px_34px_rgba(146,64,14,0.10),0_1px_0_rgba(255,255,255,0.82)_inset]">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-600 shadow-[0_8px_18px_rgba(146,64,14,0.10)]">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-amber-950">
                      AI usage limit reached
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">
                      {AI_QUOTA_EXHAUSTED_MESSAGE}
                    </p>
                  </div>
                </div>
                <p className="border-t border-amber-200/70 pt-3 text-xs font-medium leading-5 text-amber-800">
                  Your question was saved, but ChinaTrip AI cannot generate a
                  new answer right now.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                  Generation failed
                </div>
                <div className="whitespace-pre-line text-[#6F3E36]">
                  {content || "Failed to generate answer. Please try again."}
                </div>
              </div>
            )
          ) : (
            <>
              <AnswerContent
                content={content}
                visuals={visuals}
                onOpenImage={onOpenImage}
              />
              {sources?.length ? (
                <div className="mt-5">
                  <AnswerSources sources={sources} />
                </div>
              ) : null}
              {quickQuestionMenu ? (
                <QuickQuestionMenuPanel
                  menu={quickQuestionMenu}
                  onSelect={onQuickSubQuestion}
                />
              ) : shouldShowContinue ? (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-[#FFF8EF] p-4 text-[#523719] shadow-[0_14px_34px_rgba(146,64,14,0.08),0_1px_0_rgba(255,255,255,0.82)_inset] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-100 text-red-700 shadow-[0_8px_18px_rgba(185,28,28,0.14)]">
                      <AlertTriangle className="h-4.5 w-4.5" />
                    </span>
                    <p className="min-w-0 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">
                      {continuePromptText}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onContinueAnswer}
                    className="inline-flex h-11 shrink-0 animate-pulse items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8A552B,#14243A)] px-4 text-sm font-semibold text-[#FFF8EF] shadow-[0_10px_22px_rgba(20,36,58,0.10),0_0_0_1px_rgba(255,255,255,0.14)_inset] transition hover:animate-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#D49A52]/45 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue answer
                  </button>
                </div>
              ) : null}
              {quickQuestionMenu ? null : (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E6D8C7]/70 pt-4">
                  <MessageActionButton
                    Icon={Share2}
                    label={isSharing ? "Sharing..." : "Share"}
                    tone="share"
                    onClick={onShare}
                    disabled={isSharing}
                  />
                  <MessageActionButton
                    Icon={Copy}
                    label="Copy"
                    tone="copy"
                    onClick={(event) => onCopy(content, event)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function MessageItem({
  message,
  user,
  onCopy,
  onShare,
  onContinueAnswer,
  onQuickSubQuestion,
  onOpenImage,
  sharingMessageId,
}: {
  message: ChatMessage;
  user: MeResponse["user"];
  onCopy: (content: string, event: MouseEvent<HTMLButtonElement>) => void;
  onShare: (
    message: ChatMessage,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onContinueAnswer: () => void;
  onQuickSubQuestion: (
    subQuestion: NonNullable<ChatMessage["quickQuestionMenu"]>["subQuestions"][number],
    menu: NonNullable<ChatMessage["quickQuestionMenu"]>,
  ) => void;
  onOpenImage: (asset: AnswerAsset) => void;
  sharingMessageId: string | null;
}) {
  if (message.role === "user") {
    return <UserMessageBubble content={message.content} user={user} />;
  }

  return (
    <AssistantMessageBubble
      status={message.status}
      content={message.content}
      visuals={message.visuals}
      sources={message.sources}
      quickQuestionMenu={message.quickQuestionMenu}
      truncated={message.truncated}
      maybeTruncated={message.maybeTruncated}
      errorCode={message.errorCode}
      progress={message.progress}
      onCopy={onCopy}
      onShare={(event) => onShare(message, event)}
      onContinueAnswer={onContinueAnswer}
      onQuickSubQuestion={onQuickSubQuestion}
      onOpenImage={onOpenImage}
      isSharing={sharingMessageId === message.id}
    />
  );
}

function waitForChatDetailLoadingAfterResponse() {
  return new Promise((resolve) => {
    setTimeout(resolve, CHAT_DETAIL_LOADING_AFTER_RESPONSE_MS);
  });
}

function ConversationSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[52rem] space-y-7">
      <div className="flex items-start justify-end gap-0 sm:gap-3">
        <div
          className={`w-full max-w-[36rem] rounded-[1.25rem] rounded-tr-sm px-4 py-3 sm:px-6 sm:py-4 ${USER_MESSAGE_SURFACE_CLASS}`}
        >
          <div className="space-y-2.5">
            <div className="h-3 w-11/12 animate-pulse rounded-full bg-white/36" />
            <div className="h-3 w-7/12 animate-pulse rounded-full bg-white/24" />
          </div>
        </div>
        <span
          className={`hidden h-10 w-10 shrink-0 animate-pulse rounded-full sm:mt-1 sm:block ${USER_AVATAR_SURFACE_CLASS}`}
        />
      </div>

      <div className="flex items-start gap-0 sm:gap-3">
        <span
          className={`hidden h-10 w-10 shrink-0 animate-pulse rounded-full sm:mt-1 sm:block ${ASSISTANT_AVATAR_SURFACE_CLASS}`}
        />
        <div
          className={`relative w-full overflow-hidden rounded-[1.25rem] rounded-tl-sm p-5 sm:p-7 ${ASSISTANT_SURFACE_CLASS}`}
        >
          <div
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
            aria-hidden="true"
          />
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#D49A52]" />
              <span className="h-3 w-36 animate-pulse rounded-full bg-[#D49A52]/45" />
              <span className="h-px min-w-6 flex-1 bg-gradient-to-r from-[#D49A52]/25 to-transparent" />
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#D49A52] [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#D49A52] [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#D49A52]" />
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="h-3 w-full animate-pulse rounded-full bg-[#E6D8C7]" />
              <div className="h-3 w-11/12 animate-pulse rounded-full bg-[#EEF4F6]" />
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-[#EEF4F6]" />
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#EEF4F6]" />
            </div>
            <div className="space-y-4 border-t border-[#E6D8C7]/60 pt-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-start gap-3.5">
                  <span className="mt-0.5 inline-flex h-6.5 w-6.5 shrink-0 animate-pulse rounded-full border border-[#E6D8C7] bg-[#FFF8EF]" />
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="block h-3 w-40 animate-pulse rounded-full bg-[#D49A52]/30" />
                    <span className="block h-3 w-full animate-pulse rounded-full bg-[#EEF4F6]" />
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-[#E6D8C7]/70 pt-4">
              <span className="h-8 w-20 animate-pulse rounded-xl border border-white/80 bg-white/55 ring-1 ring-[#E6D8C7]/50" />
              <span className="h-8 w-20 animate-pulse rounded-xl border border-white/80 bg-white/55 ring-1 ring-[#E6D8C7]/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatView({ chatId }: { chatId: string }) {
  const router = useRouter();
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generationIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const streamTypewriterIntervalsRef = useRef<
    ReturnType<typeof setInterval>[]
  >([]);
  const streamBuffersRef = useRef(new Map<string, StreamBuffer>());
  const lastAutoScrollAtRef = useRef(0);
  const loadedChatDetailsRef = useRef(new Map<string, MockChat>());
  const detailLoadingReasonRef = useRef<DetailLoadingReason>("initial");
  const lastCompletedDetailReasonRef = useRef<DetailLoadingReason>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoadingChatDetail, setIsLoadingChatDetail] = useState(true);
  const [detailLoadingReason, setDetailLoadingReason] =
    useState<DetailLoadingReason>("initial");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [sharingMessageId, setSharingMessageId] = useState<string | null>(null);
  const [activeClarificationFlow, setActiveClarificationFlow] =
    useState<ActiveClarificationFlow | null>(null);
  const [isLoadingClarification, setIsLoadingClarification] = useState(false);
  const [previewState, setPreviewState] = useState<ImagePreviewState | null>(
    null,
  );
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [toast, setToast] = useState<{
    message: string;
    x: number;
    y: number;
  } | null>(null);
  const [chat, setChat] = useState<MockChat | null>(null);
  const { user, isLoadingUser, refreshUser } = useCurrentUser();
  const currentTitle = chat?.title;
  const shouldShowHistorySkeleton =
    isLoadingChatDetail && detailLoadingReason === "history";
  const shouldShowConversationSkeleton =
    shouldShowHistorySkeleton || isLoadingChatDetail || isLoadingUser;
  const rowVirtualizer = useVirtualizer({
    count: chat?.messages.length ?? 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 220,
    getItemKey: (index) => chat?.messages[index]?.id ?? index,
    overscan: 6,
  });

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const scrollElement = scrollParentRef.current;

      if (!scrollElement) {
        return;
      }

      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior,
      });
    });
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

  function forceScrollToBottomAfterMessageInsert() {
    scrollToBottom("smooth");

    generationTimeoutsRef.current.push(
      setTimeout(() => {
        scrollToBottom("smooth");
      }, FORCE_BOTTOM_SECOND_PASS_DELAY_MS),
    );
  }

  function scrollToBottomIfNearBottom(behavior: ScrollBehavior = "smooth") {
    const scrollElement = scrollParentRef.current;

    if (!scrollElement) {
      return;
    }

    const distanceFromBottom =
      scrollElement.scrollHeight -
      scrollElement.scrollTop -
      scrollElement.clientHeight;

    if (distanceFromBottom > STREAM_BOTTOM_THRESHOLD_PX) {
      return;
    }

    const now = Date.now();

    if (now - lastAutoScrollAtRef.current < STREAM_SCROLL_THROTTLE_MS) {
      return;
    }

    lastAutoScrollAtRef.current = now;
    scrollToBottom(behavior);
  }

  function updateDetailLoadingReason(reason: DetailLoadingReason) {
    detailLoadingReasonRef.current = reason;
    setDetailLoadingReason(reason);
  }

  function clearGenerationTimers() {
    generationTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    generationTimeoutsRef.current = [];
    generationIntervalsRef.current.forEach((interval) => clearInterval(interval));
    generationIntervalsRef.current = [];
    streamTypewriterIntervalsRef.current.forEach((interval) =>
      clearInterval(interval),
    );
    streamTypewriterIntervalsRef.current = [];
    streamBuffersRef.current.clear();
  }

  function setChatAndCache(nextChat: MockChat) {
    loadedChatDetailsRef.current.set(nextChat.id, nextChat);
    setChat(nextChat);
  }

  function updateChatAndCache(updater: (currentChat: MockChat) => MockChat) {
    setChat((currentChat) => {
      if (!currentChat) {
        return currentChat;
      }

      const nextChat = updater(currentChat);
      loadedChatDetailsRef.current.set(nextChat.id, nextChat);
      return nextChat;
    });
  }

  function updateChatByIdAndCache(
    targetChatId: string,
    updater: (currentChat: MockChat) => MockChat,
  ) {
    const cachedChat = loadedChatDetailsRef.current.get(targetChatId);

    if (cachedChat) {
      loadedChatDetailsRef.current.set(targetChatId, updater(cachedChat));
    }

    setChat((currentChat) => {
      if (!currentChat || currentChat.id !== targetChatId) {
        return currentChat;
      }

      const nextChat = updater(currentChat);
      loadedChatDetailsRef.current.set(targetChatId, nextChat);
      return nextChat;
    });
  }

  function takeTypewriterChunk(text: string) {
    if (text.length <= 6) {
      return text;
    }

    const hasCjkText = /[\u3400-\u9FFF]/.test(text);
    const chunkSize = hasCjkText
      ? text.length > 240
        ? 16
        : text.length > 120
          ? 10
          : text.length > 48
            ? 6
            : 3
      : text.length > 300
        ? 22
        : text.length > 160
          ? 14
          : text.length > 72
            ? 8
            : 4;
    const candidate = text.slice(0, chunkSize);

    if (hasCjkText) {
      return candidate;
    }

    const nextCharacter = text.at(chunkSize);
    const lastSpaceIndex = candidate.lastIndexOf(" ");

    if (
      lastSpaceIndex >= 2 &&
      nextCharacter &&
      /[A-Za-z]/.test(nextCharacter)
    ) {
      return text.slice(0, lastSpaceIndex + 1);
    }

    if (
      nextCharacter &&
      /[A-Za-z]/.test(candidate.at(-1) ?? "") &&
      /[A-Za-z]/.test(nextCharacter)
    ) {
      const nextSpaceIndex = text.slice(chunkSize, chunkSize + 10).indexOf(" ");

      if (nextSpaceIndex >= 0) {
        return text.slice(0, chunkSize + nextSpaceIndex + 1);
      }
    }

    return candidate;
  }

  function appendStreamBuffer(assistantMessageId: string, content: string) {
    const buffer = streamBuffersRef.current.get(assistantMessageId);

    if (!buffer) {
      return;
    }

    streamBuffersRef.current.set(assistantMessageId, {
      ...buffer,
      text: `${buffer.text}${content}`,
    });
  }

  function flushStreamBuffer(targetChatId: string, assistantMessageId: string) {
    const buffer = streamBuffersRef.current.get(assistantMessageId);

    if (!buffer?.text) {
      return;
    }

    const remainingText = buffer.text;

    streamBuffersRef.current.set(assistantMessageId, {
      ...buffer,
      text: "",
    });

    updateChatByIdAndCache(targetChatId, (currentChat) => ({
      ...currentChat,
      messages: currentChat.messages.map((chatMessage) =>
        chatMessage.id === assistantMessageId
          ? {
              ...chatMessage,
              content: `${chatMessage.content}${remainingText}`,
              status: "loading",
              loadingLabel: undefined,
            }
          : chatMessage,
      ),
    }));
    scrollToBottomIfNearBottom("smooth");
  }

  function startStreamTypewriter(
    targetChatId: string,
    assistantMessageId: string,
  ) {
    if (streamBuffersRef.current.has(assistantMessageId)) {
      return;
    }

    streamBuffersRef.current.set(assistantMessageId, {
      targetChatId,
      text: "",
    });

    const interval = setInterval(() => {
      const buffer = streamBuffersRef.current.get(assistantMessageId);

      if (!buffer?.text) {
        return;
      }

      const nextChunk = takeTypewriterChunk(buffer.text);

      streamBuffersRef.current.set(assistantMessageId, {
        ...buffer,
        text: buffer.text.slice(nextChunk.length),
      });

      updateChatByIdAndCache(buffer.targetChatId, (currentChat) => ({
        ...currentChat,
        messages: currentChat.messages.map((chatMessage) =>
          chatMessage.id === assistantMessageId
            ? {
                ...chatMessage,
                content: `${chatMessage.content}${nextChunk}`,
                status: "loading",
                loadingLabel: undefined,
              }
            : chatMessage,
        ),
      }));
      scrollToBottomIfNearBottom("smooth");
    }, STREAM_TYPEWRITER_INTERVAL_MS);

    streamTypewriterIntervalsRef.current.push(interval);
  }

  function startGenerationProgress(targetChatId: string, loadingMessageId: string) {
    clearGenerationTimers();
    setIsGenerating(true);
    let hasDelta = false;
    let currentLoadingMessageId = loadingMessageId;

    updateChatByIdAndCache(targetChatId, (currentChat) => ({
      ...currentChat,
      messages: currentChat.messages.map((chatMessage) =>
        chatMessage.id === loadingMessageId
          ? { ...chatMessage, progress: 1 }
          : chatMessage,
      ),
    }));

    generationIntervalsRef.current.push(
      setInterval(() => {
        updateChatByIdAndCache(targetChatId, (currentChat) => ({
          ...currentChat,
          messages: currentChat.messages.map((chatMessage) => {
            if (
              chatMessage.id !== currentLoadingMessageId ||
              chatMessage.status !== "loading"
            ) {
              return chatMessage;
            }

            const currentProgress = chatMessage.progress ?? 1;
            const maxProgress = hasDelta ? 95 : 90;
            let increment = 1;

            if (hasDelta) {
              increment = 1;
            } else if (currentProgress < 35) {
              increment = 4;
            } else if (currentProgress < 70) {
              increment = 2;
            }

            return {
              ...chatMessage,
              progress: Math.min(maxProgress, currentProgress + increment),
            };
          }),
        }));
      }, GENERATION_PROGRESS_INTERVAL_MS),
    );

    generationTimeoutsRef.current.push(
      setTimeout(() => {
        updateChatByIdAndCache(targetChatId, (currentChat) => ({
          ...currentChat,
          messages: currentChat.messages.map((chatMessage) =>
            chatMessage.id === currentLoadingMessageId &&
            chatMessage.status === "loading" &&
            !chatMessage.content
              ? { ...chatMessage, loadingLabel: "Still working..." }
              : chatMessage,
          ),
        }));
      }, 3000),
    );

    return {
      setLoadingMessageId(nextLoadingMessageId: string) {
        currentLoadingMessageId = nextLoadingMessageId;
      },
      markDelta() {
        hasDelta = true;
      },
    };
  }

  function updateHistoryPreview(targetChatId: string, preview: string) {
    const now = new Date().toISOString();

    setChatHistory((currentHistory) =>
      currentHistory
        .map((historyItem) =>
          historyItem.id === targetChatId
            ? {
                ...historyItem,
                preview,
                updatedAt: now,
                lastMessageAt: now,
              }
            : historyItem,
        )
        .sort(
          (first, second) =>
            new Date(second.lastMessageAt).getTime() -
            new Date(first.lastMessageAt).getTime(),
        ),
    );
  }

  async function sendMessageToApi({
    targetChatId,
    requestBody,
    loadingMessageId,
    optimisticUserMessageId,
  }: {
    targetChatId: string;
    requestBody: SendMessageRequest;
    loadingMessageId: string;
    optimisticUserMessageId?: string;
  }) {
    const progressController = startGenerationProgress(
      targetChatId,
      loadingMessageId,
    );
    let activeAssistantMessageId = loadingMessageId;
    let streamedContent = "";

    try {
      const response = await fetch(`/api/chats/${targetChatId}/messages/stream`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok || !response.body) {
        let messageText = response.statusText || "Failed to generate answer.";
        let errorCode = "STREAM_REQUEST_FAILED";

        try {
          const body = await response.json() as {
            error?: { code?: string; message?: string };
          };
          messageText = body.error?.message ?? messageText;
          errorCode = body.error?.code ?? errorCode;
        } catch {
          // Keep the HTTP status text fallback.
        }

        throw new ApiClientError({
          status: response.status,
          code: errorCode,
          message: messageText,
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const rawEvents = buffer.split(/\r?\n\r?\n/);
        buffer = rawEvents.pop() ?? "";

        for (const rawEvent of rawEvents) {
          const event = parseStreamEvent(rawEvent);

          if (!event) {
            continue;
          }

          if (event.type === "created") {
            const userMessage = toUserChatMessage(event.userMessage);
            const assistantMessage = toPendingAssistantChatMessage(
              event.assistantMessage,
            );
            activeAssistantMessageId = assistantMessage.id;
            progressController.setLoadingMessageId(activeAssistantMessageId);
            startStreamTypewriter(targetChatId, activeAssistantMessageId);

            updateChatByIdAndCache(targetChatId, (currentChat) => {
              const messagesWithoutTemporary = currentChat.messages.filter(
                (chatMessage) =>
                  chatMessage.id !== loadingMessageId &&
                  chatMessage.id !== optimisticUserMessageId,
              );
              const hasPersistedUserMessage = messagesWithoutTemporary.some(
                (chatMessage) => chatMessage.id === userMessage.id,
              );

              return {
                ...currentChat,
                messages: [
                  ...messagesWithoutTemporary,
                  ...(hasPersistedUserMessage ? [] : [userMessage]),
                  {
                    ...assistantMessage,
                    progress:
                      currentChat.messages.find(
                        (chatMessage) => chatMessage.id === loadingMessageId,
                      )?.progress ?? 1,
                  },
                ],
              };
            });
          }

          if (event.type === "delta") {
            progressController.markDelta();
            streamedContent += event.content;
            startStreamTypewriter(targetChatId, activeAssistantMessageId);
            appendStreamBuffer(activeAssistantMessageId, event.content);
            const estimatedProgress = Math.min(
              95,
              Math.max(55, 55 + Math.floor(streamedContent.length / 24)),
            );

            updateChatByIdAndCache(targetChatId, (currentChat) => ({
              ...currentChat,
              messages: currentChat.messages.map((chatMessage) =>
                chatMessage.id === activeAssistantMessageId
                  ? {
                      ...chatMessage,
                      status: "loading",
                      progress: Math.max(
                        estimatedProgress,
                        chatMessage.progress ?? 1,
                      ),
                      loadingLabel: undefined,
                    }
                  : chatMessage,
              ),
            }));
          }

          if (event.type === "done") {
            const assistantMessage = toAssistantChatMessage(
              event.assistantMessage,
            );

            flushStreamBuffer(targetChatId, activeAssistantMessageId);
            updateChatByIdAndCache(targetChatId, (currentChat) => ({
              ...currentChat,
              messages: currentChat.messages.map((chatMessage) =>
                chatMessage.id === activeAssistantMessageId
                  ? {
                      ...chatMessage,
                      status: "loading",
                      progress: 100,
                      loadingLabel: undefined,
                    }
                  : chatMessage,
              ),
            }));
            await new Promise((resolve) =>
              setTimeout(resolve, GENERATION_DONE_HOLD_MS),
            );
            updateChatByIdAndCache(targetChatId, (currentChat) => ({
              ...currentChat,
              messages: currentChat.messages.map((chatMessage) =>
                chatMessage.id === activeAssistantMessageId
                  ? assistantMessage
                  : chatMessage,
              ),
            }));
            updateHistoryPreview(targetChatId, assistantMessage.content);
          }

          if (event.type === "error") {
            const errorMessage =
              event.assistantMessage
                ? toAssistantChatMessage(event.assistantMessage)
                : {
                    id: activeAssistantMessageId,
                    role: "assistant" as const,
                    content: event.error.message,
                    createdAt: new Date().toISOString(),
                    status: "failed" as const,
                    errorCode: event.error.code,
                  };

            updateChatByIdAndCache(targetChatId, (currentChat) => ({
              ...currentChat,
              messages: currentChat.messages.map((chatMessage) =>
                chatMessage.id === activeAssistantMessageId
                  ? {
                      ...errorMessage,
                      progress: undefined,
                      loadingLabel: undefined,
                    }
                  : chatMessage,
              ),
            }));
          }
        }
      }
    } catch (error) {
      let fallbackMessage =
        error instanceof ApiClientError
          ? error.message
          : "Failed to generate answer.";
      const fallbackCode =
        error instanceof ApiClientError ? error.code : undefined;

      if (fallbackCode === CHAT_NOT_FOUND_CODE) {
        try {
          await apiFetch<ChatDetailResponse>(`/chats/${targetChatId}`);
        } catch {
          // The stream and detail endpoints agree this chat is unavailable.
        }

        fallbackMessage = CHAT_NOT_FOUND_STREAM_MESSAGE;
      }

      updateChatByIdAndCache(targetChatId, (currentChat) => ({
        ...currentChat,
        messages: currentChat.messages.map((chatMessage) =>
          chatMessage.id === activeAssistantMessageId ||
          chatMessage.id === loadingMessageId
            ? {
                ...chatMessage,
                content: fallbackMessage,
                status: "failed",
                errorCode: fallbackCode,
                progress: undefined,
                loadingLabel: undefined,
              }
            : chatMessage,
        ),
      }));
    } finally {
      clearGenerationTimers();
      setIsGenerating(false);
      scrollToBottom("smooth");
    }
  }

  useEffect(() => {
    updateDetailLoadingReason("initial");
    setActiveChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    function syncActiveChatFromHistory() {
      const nextChatId = window.location.pathname.match(
        /^\/chat\/([^/?#]+)/,
      )?.[1];

      if (nextChatId) {
        updateDetailLoadingReason(
          loadedChatDetailsRef.current.has(decodeURIComponent(nextChatId))
            ? null
            : "history",
        );
        setActiveChatId(decodeURIComponent(nextChatId));
      }
    }

    window.addEventListener("popstate", syncActiveChatFromHistory);

    return () => {
      window.removeEventListener("popstate", syncActiveChatFromHistory);
    };
  }, []);

  useEffect(() => {
    if (hasInitialScrolledRef.current || !chat || chat.messages.length === 0) {
      return;
    }

    hasInitialScrolledRef.current = true;
    scrollToBottom("auto");
  }, [chat]);

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      setIsLoadingHistory(true);

      try {
        const historyResponse = await apiFetch<ChatHistoryResponse>("/chats");

        if (!isActive) {
          return;
        }

        setChatHistory(historyResponse.chats);
      } catch {
        if (!isActive) {
          return;
        }

        setChatHistory([]);
      } finally {
        if (isActive) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const cachedChat = loadedChatDetailsRef.current.get(activeChatId);

    setChatError(null);
    clearGenerationTimers();
    setIsGenerating(false);
    setActiveClarificationFlow(null);
    setIsLoadingClarification(false);
    hasInitialScrolledRef.current = false;

    if (cachedChat) {
      setChat(cachedChat);
      setIsLoadingChatDetail(false);
      updateDetailLoadingReason(null);
      return () => {
        isActive = false;
      };
    }

    async function loadChatDetail() {
      setIsLoadingChatDetail(true);
      setChat(null);
      const shouldHoldLoading = detailLoadingReasonRef.current === "history";

      try {
        const chatResponse = await apiFetch<ChatDetailResponse>(
          `/chats/${activeChatId}`,
        );

        if (shouldHoldLoading) {
          await waitForChatDetailLoadingAfterResponse();
        }

        if (!isActive) {
          return;
        }

        lastCompletedDetailReasonRef.current = detailLoadingReasonRef.current;
        setChatAndCache({
          id: chatResponse.chat.id,
          title: chatResponse.chat.title,
          messages: chatResponse.messages.map(toChatMessage),
        });
      } catch (error) {
        if (shouldHoldLoading) {
          await waitForChatDetailLoadingAfterResponse();
        }

        if (!isActive) {
          return;
        }

        setChat(null);
        setChatError(
          error instanceof ApiClientError
            ? error.message
            : "Failed to load chat.",
        );
      } finally {
        if (isActive) {
          setIsLoadingChatDetail(false);
          updateDetailLoadingReason(null);
        }
      }
    }

    void loadChatDetail();

    return () => {
      isActive = false;
    };
  }, [activeChatId]);

  useEffect(() => {
    if (
      isLoadingChatDetail ||
      chatError ||
      !chat ||
      isGenerating ||
      lastCompletedDetailReasonRef.current !== "initial"
    ) {
      return;
    }

    const firstUserMessage = chat.messages.find(
      (chatMessage) => chatMessage.role === "user",
    );
    const hasAssistantMessage = chat.messages.some(
      (chatMessage) => chatMessage.role === "assistant",
    );
    const hasOnlyOneUserMessage =
      chat.messages.length === 1 && chat.messages[0]?.role === "user";

    if (!firstUserMessage || hasAssistantMessage || !hasOnlyOneUserMessage) {
      lastCompletedDetailReasonRef.current = null;
      return;
    }

    lastCompletedDetailReasonRef.current = null;

    if (isItineraryPlanningRequest(firstUserMessage.content)) {
      void startClarificationFlow({
        targetChatId: chat.id,
        sourceQuestion: firstUserMessage.content,
        sourceUserMessageId: firstUserMessage.id,
        promptProfile: "itinerary_planning",
        generateDirectlyOnSkip: true,
      });
      return;
    }

    startInitialAnswerGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, chatError, isGenerating, isLoadingChatDetail]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      clearGenerationTimers();
    };
  }, []);

  function showToast(
    messageText: string,
    target: HTMLButtonElement,
  ) {
    const rect = target.getBoundingClientRect();

    setToast({
      message: messageText,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => setToast(null), 1800);
  }

  function submitMessage(
    value: string,
    metadata?: Pick<
      SendMessageRequest,
      "promptProfile" | "sourceQuestionId" | "sourceSubQuestionId"
    >,
  ) {
    const trimmedMessage = value.trim();

    if (!trimmedMessage || isGenerating || !chat) {
      return;
    }

    if (
      metadata?.promptProfile === "itinerary_planning" ||
      isItineraryPlanningRequest(trimmedMessage)
    ) {
      const optimisticUserMessage = createMessage("user", trimmedMessage);

      updateChatAndCache((currentChat) => ({
        ...currentChat,
        messages: [...currentChat.messages, optimisticUserMessage],
      }));
      void startClarificationFlow({
        targetChatId: chat.id,
        sourceQuestion: trimmedMessage,
        optimisticUserMessageId: optimisticUserMessage.id,
        promptProfile: metadata?.promptProfile ?? "itinerary_planning",
        generateDirectlyOnSkip: false,
      });
      setMessage((currentMessage) =>
        currentMessage.trim() === trimmedMessage ? "" : currentMessage,
      );
      return;
    }

    submitMessageDirect(trimmedMessage, metadata);
  }

  function submitMessageDirect(
    trimmedMessage: string,
    metadata?: Pick<
      SendMessageRequest,
      "promptProfile" | "sourceQuestionId" | "sourceSubQuestionId"
    >,
    existingOptimisticUserMessageId?: string,
  ) {
    if (!chat) {
      return;
    }

    const loadingMessageId = `assistant-loading-${Date.now()}`;
    const userMessage = existingOptimisticUserMessageId
      ? null
      : createMessage("user", trimmedMessage);
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "loading",
      progress: 1,
    };

    updateChatAndCache((currentChat) => ({
      ...currentChat,
      title:
        currentChat.messages.length === 0
          ? createChatTitle(trimmedMessage)
          : currentChat.title,
      messages: [
        ...currentChat.messages,
        ...(userMessage ? [userMessage] : []),
        loadingMessage,
      ],
    }));
    setMessage((currentMessage) =>
      currentMessage.trim() === trimmedMessage ? "" : currentMessage,
    );
    forceScrollToBottomAfterMessageInsert();
    void sendMessageToApi({
      targetChatId: chat.id,
      requestBody: {
        message: trimmedMessage,
        ...metadata,
      },
      loadingMessageId,
      optimisticUserMessageId:
        existingOptimisticUserMessageId ?? userMessage?.id,
    });
  }

  function handleSubmit() {
    submitMessage(message);
  }

  function handleContinueTruncatedAnswer() {
    submitMessage(CONTINUE_TRUNCATED_ANSWER_PROMPT);
  }

  function handleQuickSubQuestion(
    subQuestion: NonNullable<ChatMessage["quickQuestionMenu"]>["subQuestions"][number],
    menu: NonNullable<ChatMessage["quickQuestionMenu"]>,
  ) {
    submitMessage(subQuestion.question, {
      promptProfile: subQuestion.promptProfile,
      sourceQuestionId: menu.sourceQuestionId,
      sourceSubQuestionId: subQuestion.id,
    });
  }

  function startInitialAnswerGeneration() {
    if (!chat) {
      return;
    }

    const loadingMessage: ChatMessage = {
      id: `assistant-initial-loading-${chat.id}`,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "loading",
      progress: 1,
    };

    updateChatAndCache((currentChat) => ({
      ...currentChat,
      messages: [...currentChat.messages, loadingMessage],
    }));
    forceScrollToBottomAfterMessageInsert();
    void sendMessageToApi({
      targetChatId: chat.id,
      requestBody: {},
      loadingMessageId: loadingMessage.id,
    });
  }

  async function startClarificationFlow({
    targetChatId,
    sourceQuestion,
    sourceUserMessageId,
    optimisticUserMessageId,
    promptProfile,
    generateDirectlyOnSkip,
  }: {
    targetChatId: string;
    sourceQuestion: string;
    sourceUserMessageId?: string;
    optimisticUserMessageId?: string;
    promptProfile?: SendMessageRequest["promptProfile"];
    generateDirectlyOnSkip: boolean;
  }) {
    if (isLoadingClarification || isGenerating) {
      return;
    }

    setIsLoadingClarification(true);

    try {
      const response = await apiFetch<CreateClarificationResponse>(
        `/chats/${targetChatId}/clarifications`,
        {
          messageId: sourceUserMessageId,
          message: sourceQuestion,
          promptProfile,
        },
      );

      if (!response.needsClarification || response.questions.length === 0) {
        if (generateDirectlyOnSkip) {
          startInitialAnswerGeneration();
        } else {
          submitMessageDirect(sourceQuestion, { promptProfile }, optimisticUserMessageId);
        }
        return;
      }

      setActiveClarificationFlow({
        sourceUserMessageId,
        optimisticUserMessageId,
        sourceQuestion,
        flow: response,
        currentStepIndex: 0,
        answers: {},
        otherAnswers: {},
      });
      forceScrollToBottomAfterMessageInsert();
    } catch {
      if (generateDirectlyOnSkip) {
        startInitialAnswerGeneration();
      } else {
        submitMessageDirect(sourceQuestion, { promptProfile }, optimisticUserMessageId);
      }
    } finally {
      setIsLoadingClarification(false);
    }
  }

  function handleClarificationAnswer(
    questionId: string,
    value: string | string[],
  ) {
    setActiveClarificationFlow((current) =>
      current
        ? {
            ...current,
            answers: {
              ...current.answers,
              [questionId]: value,
            },
          }
        : current,
    );
  }

  function handleClarificationAnswerAndAdvance(
    questionId: string,
    value: string,
  ) {
    if (!activeClarificationFlow) {
      return;
    }

    const currentIndex = activeClarificationFlow.currentStepIndex;
    const isLastStep =
      currentIndex >= activeClarificationFlow.flow.questions.length - 1;
    const nextFlow = {
      ...activeClarificationFlow,
      answers: {
        ...activeClarificationFlow.answers,
        [questionId]: value,
      },
      currentStepIndex: isLastStep
        ? activeClarificationFlow.currentStepIndex
        : Math.min(
            activeClarificationFlow.flow.questions.length - 1,
            currentIndex + 1,
          ),
    };

    if (isLastStep) {
      startClarificationGeneration(nextFlow);
      return;
    }

    setActiveClarificationFlow(nextFlow);
  }

  function handleClarificationOtherAnswer(questionId: string, value: string) {
    setActiveClarificationFlow((current) =>
      current
        ? {
            ...current,
            otherAnswers: {
              ...current.otherAnswers,
              [questionId]: value,
            },
          }
        : current,
    );
  }

  function handleClarificationBack() {
    setActiveClarificationFlow((current) =>
      current
        ? {
            ...current,
            currentStepIndex: Math.max(0, current.currentStepIndex - 1),
          }
        : current,
    );
  }

  function handleClarificationNext() {
    if (!activeClarificationFlow) {
      return;
    }

    const currentIndex = activeClarificationFlow.currentStepIndex;
    const isLastStep =
      currentIndex >= activeClarificationFlow.flow.questions.length - 1;

    if (isLastStep) {
      startClarificationGeneration(activeClarificationFlow);
      return;
    }

    setActiveClarificationFlow({
      ...activeClarificationFlow,
      currentStepIndex: Math.min(
        activeClarificationFlow.flow.questions.length - 1,
        currentIndex + 1,
      ),
    });
  }

  function handleClarificationCancel() {
    const optimisticUserMessageId =
      activeClarificationFlow?.optimisticUserMessageId;

    setActiveClarificationFlow(null);

    if (optimisticUserMessageId) {
      updateChatAndCache((currentChat) => ({
        ...currentChat,
        messages: currentChat.messages.filter(
          (chatMessage) => chatMessage.id !== optimisticUserMessageId,
        ),
      }));
    }
  }

  function startClarificationGeneration(flow: ActiveClarificationFlow) {
    if (!chat || isGenerating) {
      return;
    }

    const submission = mergeClarifiedTripContext(flow);
    const loadingMessageId = `assistant-loading-${Date.now()}`;
    const shouldPersistSourceQuestion = !flow.sourceUserMessageId;
    const optimisticUserMessageId = flow.optimisticUserMessageId;
    const userMessage =
      shouldPersistSourceQuestion && !optimisticUserMessageId
        ? createMessage("user", submission.sourceQuestion)
        : null;
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "loading",
      progress: 1,
    };
    const messagesToAppend: ChatMessage[] = userMessage
      ? [userMessage, loadingMessage]
      : [loadingMessage];

    setActiveClarificationFlow(null);
    updateChatAndCache((currentChat) => ({
      ...currentChat,
      messages: [...currentChat.messages, ...messagesToAppend],
    }));
    forceScrollToBottomAfterMessageInsert();
    void sendMessageToApi({
      targetChatId: chat.id,
      requestBody: {
        ...(shouldPersistSourceQuestion
          ? { message: submission.sourceQuestion }
          : {}),
        promptProfile: "itinerary_planning",
        clarificationUsed: true,
        clarifiedTripContext: submission.context,
      },
      loadingMessageId,
      optimisticUserMessageId: shouldPersistSourceQuestion
        ? optimisticUserMessageId ?? userMessage?.id
        : undefined,
    });
  }

  function handleClarificationGenerate() {
    if (!activeClarificationFlow) {
      return;
    }

    startClarificationGeneration(activeClarificationFlow);
  }

  async function copyText(
    text: string,
    successMessage: string,
    target: HTMLButtonElement,
  ) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, target);
    } catch {
      showToast("Copy failed. Please try again.", target);
    }
  }

  function handleCopy(
    content: string,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    void copyText(content, "Copied", event.currentTarget);
  }

  async function handleShare(
    assistantMessage: ChatMessage,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    const target = event.currentTarget;

    if (sharingMessageId) {
      return;
    }

    if (!chat || assistantMessage.status !== "complete") {
      showToast("Only complete answers can be shared.", target);
      return;
    }

    const assistantIndex = chat.messages.findIndex(
      (message) => message.id === assistantMessage.id,
    );
    const userMessage = chat.messages[assistantIndex - 1];

    if (!userMessage || userMessage.role !== "user") {
      showToast("Question-answer pair not found.", target);
      return;
    }

    setSharingMessageId(assistantMessage.id);

    try {
      const response = await apiFetch<CreateSharedAnswerResponse>(
        "/shared-answers",
        {
          chatId: chat.id,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
      );

      await copyText(response.share.url, "Share link copied", target);
    } catch (error) {
      showToast(
        error instanceof ApiClientError
          ? error.message
          : "Failed to create share link.",
        target,
      );
    } finally {
      setSharingMessageId((currentId) =>
        currentId === assistantMessage.id ? null : currentId,
      );
    }
  }

  function handleNewChat() {
    window.sessionStorage.setItem(HOME_INPUT_EMPTY_ONCE_KEY, "1");
    router.push("/");
  }

  async function handleLogout() {
    try {
      await apiFetch<LogoutResponse>("/auth/logout", {
        method: "POST",
      });
      await refreshUser();
    } catch {
      // Keep the current UI state if logout fails.
    }
  }

  function handleSelectChat(selectedChatId: string) {
    updateDetailLoadingReason(
      loadedChatDetailsRef.current.has(selectedChatId) ? null : "history",
    );
    setActiveChatId(selectedChatId);

    if (window.location.pathname !== `/chat/${selectedChatId}`) {
      window.history.pushState(null, "", `/chat/${selectedChatId}`);
    }
  }

  function handleSelectChatFromDrawer(selectedChatId: string) {
    setIsDrawerOpen(false);
    handleSelectChat(selectedChatId);
  }

  return (
    <main className="app-viewport overflow-hidden bg-[#F8F5EF] bg-[linear-gradient(135deg,#F8F5EF_0%,#EEF4F6_52%,#F7F0E6_100%)] text-[#172033]">
      <div className="flex h-full">
        <div className="hidden lg:block">
          <Sidebar
            currentChatId={activeChatId}
            chatHistory={chatHistory}
            isLoadingHistory={isLoadingHistory}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            user={user}
            isLoadingUser={isLoadingUser}
            onLogout={() => {
              void handleLogout();
            }}
          />
        </div>

        {isDrawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-[#172033]/45 backdrop-blur-sm"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close chat history overlay"
            />
            <div className="relative h-full">
              <Sidebar
                currentChatId={activeChatId}
                chatHistory={chatHistory}
                isLoadingHistory={isLoadingHistory}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChatFromDrawer}
                onClose={() => setIsDrawerOpen(false)}
                onOpenLogin={() => setIsLoginModalOpen(true)}
                user={user}
                isLoadingUser={isLoadingUser}
                onLogout={() => {
                  void handleLogout();
                }}
              />
            </div>
          </div>
        ) : null}

        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url("/home-great-wall.png")',
              backgroundPosition: "center center",
              backgroundSize: "cover",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-black/34"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/68 via-black/18 to-black/68"
            aria-hidden="true"
          />

          <header className="relative z-10 flex min-h-[4.25rem] shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-7">
            <div className="flex w-full min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/14 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 lg:hidden"
                aria-label="Open chat history"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                {isLoadingChatDetail ? (
                  <div className="space-y-2">
                    <div className="h-5 w-52 max-w-full animate-pulse rounded-full bg-white/22 sm:h-6 sm:w-[26rem]" />
                    <div className="h-3 w-36 animate-pulse rounded-full bg-white/14" />
                  </div>
                ) : (
                  <>
                    <h1 className="text-lg font-bold leading-snug tracking-tight text-white max-sm:truncate sm:whitespace-normal sm:overflow-visible sm:break-words sm:text-xl sm:[overflow-wrap:anywhere]">
                      {currentTitle ?? "Chat"}
                    </h1>
                    <p className="truncate text-sm text-white/72">
                      ChinaTrip AI conversation
                    </p>
                  </>
                )}
              </div>
            </div>
          </header>

          <div
            ref={scrollParentRef}
            className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-12 sm:px-7 sm:pb-5 sm:pt-16"
          >
            {shouldShowConversationSkeleton ? (
              <ConversationSkeleton />
            ) : chatError ? (
              <div className="mx-auto w-full max-w-[52rem] rounded-[1.25rem] border border-white/70 bg-white/88 p-5 text-sm font-medium text-[#74685C] shadow-[0_18px_45px_rgba(20,36,58,0.12)]">
                {chatError}
              </div>
            ) : (
              <>
                <div
                  className="relative mx-auto w-full max-w-[52rem]"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const chatMessage = chat?.messages[virtualItem.index];

                    if (!chatMessage) {
                      return null;
                    }

                    return (
                      <div
                        key={virtualItem.key}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualItem.index}
                        className="absolute left-0 top-0 w-full pb-8"
                        style={{
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <MessageItem
                          message={chatMessage}
                          user={user}
                          onCopy={handleCopy}
                          onShare={handleShare}
                          onContinueAnswer={handleContinueTruncatedAnswer}
                          onQuickSubQuestion={handleQuickSubQuestion}
                          onOpenImage={handleOpenImagePreview}
                          sharingMessageId={sharingMessageId}
                        />
                      </div>
                    );
                  })}
                </div>
                {isLoadingClarification ? (
                  <div className="mx-auto w-full max-w-[52rem] pb-8">
                    <div className="flex items-start gap-0 sm:gap-3">
                      <BotBadge className="hidden sm:mt-1 sm:flex sm:h-10 sm:w-10" />
                      <div className={`w-full rounded-[1.25rem] rounded-tl-sm p-5 sm:p-7 ${ASSISTANT_SURFACE_CLASS}`}>
                        <div className="space-y-3">
                          <div className="h-3 w-40 animate-pulse rounded-full bg-[#D49A52]/45" />
                          <div className="h-3 w-full animate-pulse rounded-full bg-[#E6D8C7]" />
                          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#EEF4F6]" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {activeClarificationFlow ? (
                  <ClarificationFlowPanel
                    flow={activeClarificationFlow}
                    isGenerating={isGenerating}
                    onAnswer={handleClarificationAnswer}
                    onAnswerAndAdvance={handleClarificationAnswerAndAdvance}
                    onOtherAnswer={handleClarificationOtherAnswer}
                    onBack={handleClarificationBack}
                    onNext={handleClarificationNext}
                    onCancel={handleClarificationCancel}
                    onGenerate={handleClarificationGenerate}
                  />
                ) : null}
              </>
            )}
          </div>

          <div className="app-safe-bottom-comfort pointer-events-none relative z-10 shrink-0 px-4 pt-6 sm:px-7">
            <div className="pointer-events-auto mx-auto w-full max-w-[52rem]">
              <ChatInput
                value={message}
                onChange={setMessage}
                onSubmit={handleSubmit}
                placeholder={
                  isLoadingChatDetail || isLoadingUser
                    ? "Preparing conversation..."
                    : isGenerating
                    ? "Please wait..."
                    : activeClarificationFlow
                    ? "Finish the trip setup above..."
                    : "Ask about your China trip..."
                }
                disabled={
                  isLoadingChatDetail ||
                  isLoadingUser ||
                  Boolean(chatError) ||
                  isGenerating ||
                  Boolean(activeClarificationFlow)
                }
              />

              <p className="mt-4 text-center text-xs text-[#9A8D80]">
                AI can make mistakes. Verify important visa and travel
                advisories.
              </p>
            </div>
          </div>

          <ImagePreviewOverlay
            assets={previewState?.assets ?? []}
            currentIndex={previewState?.index ?? 0}
            onClose={() => setPreviewState(null)}
            onNext={handlePreviewNext}
            onPrevious={handlePreviewPrevious}
            scope="chat"
          />
        </section>
      </div>

      {toast ? (
        <div
          className="fixed z-50 inline-flex -translate-x-1/2 -translate-y-[calc(100%+0.625rem)] items-center gap-2 rounded-full bg-[#172033] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#172033]/20"
          style={{
            left: toast.x,
            top: toast.y,
          }}
        >
          <Check className="h-4 w-4 text-emerald-300" />
          {toast.message}
        </div>
      ) : null}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </main>
  );
}
