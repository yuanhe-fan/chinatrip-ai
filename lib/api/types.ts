import type { PromptProfile } from "@/lib/quick-questions/profiles";
import type { QuickSubQuestion } from "@/lib/quick-questions/menus";
import type {
  ClarificationFlow,
  ClarificationQuestion,
  ClarifiedTripContext,
} from "@/lib/ai/clarification/schema";

export type AnswerVisuals = {
  heroAssetId?: string;
  inlineAssetIds?: string[];
  embeddedAssetIds?: string[];
  cards?: Array<{
    type: "phrase" | "warning" | "backup" | "checklist";
    title: string;
    body: string;
  }>;
};

export type AnswerSource = {
  id: string;
  title: string;
  category: string;
  updatedAt: string | null;
};

export type AnswerFeedbackReaction = "up" | "down";
export type AnswerFeedbackReason =
  | "inaccurate"
  | "outdated"
  | "not_specific"
  | "not_helpful"
  | "hard_to_understand";

export type AnswerFeedback = {
  reaction: AnswerFeedbackReaction;
  reason: AnswerFeedbackReason | null;
  comment: string | null;
  updatedAt: string;
};

export type CreateChatRequest = {
  message: string;
  language?: "en" | "zh";
  source?: "home" | "share";
  shareId?: string;
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
};

export type CreateChatResponse = {
  chat: {
    id: string;
    title: string;
    language: "en" | "zh";
    status: "active";
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
  };
  firstMessage: {
    id: string;
    chatId: string;
    role: "user";
    status: "complete";
    sequence: number;
    content: string;
    createdAt: string;
  };
};

export type ChatDetailMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  status: "pending" | "complete" | "failed";
  sequence: number;
  content: string;
  errorCode: string | null;
  errorMessage: string | null;
  visuals?: AnswerVisuals;
  sources?: AnswerSource[];
  quickQuestionMenu?: {
    sourceQuestionId: string;
    promptProfile: PromptProfile;
    subQuestions: QuickSubQuestion[];
  };
  truncated?: boolean;
  maybeTruncated?: boolean;
  finishReason?: string | null;
  feedback?: AnswerFeedback;
  relatedQuestions?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ChatDetailResponse = {
  chat: {
    id: string;
    title: string;
    language: "en" | "zh";
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
  };
  messages: ChatDetailMessage[];
  /** Cursor for loading older messages; null when the oldest message is present. */
  nextCursor: string | null;
};

export type ChatHistoryItem = {
  id: string;
  title: string;
  language: "en" | "zh";
  status: "active" | "archived";
  updatedAt: string;
  lastMessageAt: string;
  preview: string | null;
};

export type ChatHistoryResponse = {
  chats: ChatHistoryItem[];
  nextCursor: string | null;
};

export type SendMessageRequest = {
  message?: string;
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
  sourceSubQuestionId?: string;
  clarificationUsed?: boolean;
  clarifiedTripContext?: ClarifiedTripContext;
};

export type SendMessageResponse = {
  userMessage: {
    id: string;
    chatId: string;
    role: "user";
    status: "complete";
    sequence: number;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
  assistantMessage: {
    id: string;
    chatId: string;
    role: "assistant";
    status: "complete" | "failed";
    sequence: number;
    content: string;
    errorCode: string | null;
    errorMessage: string | null;
    visuals?: AnswerVisuals;
    sources?: AnswerSource[];
    quickQuestionMenu?: ChatDetailMessage["quickQuestionMenu"];
    truncated?: boolean;
    maybeTruncated?: boolean;
    finishReason?: string | null;
    feedback?: AnswerFeedback;
    relatedQuestions?: string[];
    createdAt: string;
    updatedAt: string;
  };
  usage: {
    provider: "mock" | "doubao" | "deepseek";
    model: string;
    promptVersion: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number | null;
    fallbackUsed: boolean;
  };
};

export type StreamMessageCreatedEvent = {
  type: "created";
  userMessage: SendMessageResponse["userMessage"];
  assistantMessage: {
    id: string;
    chatId: string;
    role: "assistant";
    status: "pending";
    sequence: number;
    content: string;
    errorCode: null;
    errorMessage: null;
    createdAt: string;
    updatedAt: string;
  };
};

export type StreamMessageDeltaEvent = {
  type: "delta";
  content: string;
};

export type StreamMessageDoneEvent = {
  type: "done";
  assistantMessage: SendMessageResponse["assistantMessage"];
  usage: SendMessageResponse["usage"];
};

export type StreamMessageErrorEvent = {
  type: "error";
  assistantMessage?: SendMessageResponse["assistantMessage"];
  error: {
    code: string;
    message: string;
  };
};

export type StreamMessageEvent =
  | StreamMessageCreatedEvent
  | StreamMessageDeltaEvent
  | StreamMessageDoneEvent
  | StreamMessageErrorEvent;

export type CreateSharedAnswerRequest = {
  chatId: string;
  userMessageId: string;
  assistantMessageId: string;
};

export type CreateSharedAnswerResponse = {
  share: {
    id: string;
    shareId: string;
    url: string;
    question: string;
    answer: string;
    visuals?: AnswerVisuals;
    sources?: AnswerSource[];
    createdAt: string;
  };
};

export type SharedAnswerResponse = {
  share: {
    id: string;
    shareId: string;
    question: string;
    answer: string;
    visuals?: AnswerVisuals;
    sources?: AnswerSource[];
    createdAt: string;
    viewCount: number;
  };
};

export type CreateChatFromShareRequest = {
  message: string;
  language?: "en" | "zh";
};

export type CreateChatFromShareResponse = CreateChatResponse;

export type {
  ClarificationFlow,
  ClarificationQuestion,
  ClarifiedTripContext,
};

export type CreateClarificationRequest = {
  messageId?: string;
  message?: string;
  language?: "en" | "zh";
  promptProfile?: PromptProfile;
};

export type CreateClarificationResponse = ClarificationFlow;

export type UpdateAnswerFeedbackRequest = {
  reaction: AnswerFeedbackReaction;
  reason?: AnswerFeedbackReason;
  comment?: string;
};

export type UpdateAnswerFeedbackResponse = {
  feedback: AnswerFeedback;
};

export type RelatedQuestionsResponse = {
  relatedQuestions: string[];
};

export type MeResponse = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    locale: "en" | "zh";
  } | null;
  anonymous: {
    id: string;
  };
};

export type LogoutResponse = {
  status: "ok";
};
