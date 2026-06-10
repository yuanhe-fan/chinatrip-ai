export type AiProvider = "mock" | "doubao" | "deepseek";

export type TravelAnswerLanguage = "en" | "zh";

export type TravelAnswerMessageRole = "system" | "user" | "assistant";

export type TravelAnswerMessage = {
  role: TravelAnswerMessageRole;
  content: string;
};

export type GenerateTravelAnswerInput = {
  chatId: string;
  userMessage: string;
  language?: TravelAnswerLanguage;
  history?: TravelAnswerMessage[];
  metadata?: Record<string, unknown>;
  knowledgeContext?: string | null;
};

export type GenerateTravelAnswerResult = {
  content: string;
  provider: AiProvider;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  fallbackUsed: boolean;
  metadata?: unknown;
};

export type StreamTravelAnswerDelta = {
  type: "delta";
  content: string;
};

export type StreamTravelAnswerDone = {
  type: "done";
  result: GenerateTravelAnswerResult;
};

export type StreamTravelAnswerChunk =
  | StreamTravelAnswerDelta
  | StreamTravelAnswerDone;

export type AiProviderRequest = {
  chatId: string;
  messages: TravelAnswerMessage[];
  language: TravelAnswerLanguage;
  promptVersion: string;
  signal?: AbortSignal;
};

export type AiProviderAdapter = {
  provider: AiProvider;
  generateAnswer(request: AiProviderRequest): Promise<GenerateTravelAnswerResult>;
  streamAnswer?(
    request: AiProviderRequest,
  ): AsyncGenerator<StreamTravelAnswerChunk>;
};
