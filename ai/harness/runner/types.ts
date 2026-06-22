import type { AnswerSource } from "../../../lib/api/types";
import type {
  AiProvider,
  TravelAnswerMessage,
} from "../../../lib/ai/types";
import type { PromptProfile } from "../../../lib/quick-questions/profiles";

export type HarnessStatus = "pass" | "warning" | "fail";

export type HarnessExpected = {
  mustMention?: string[];
  mustMentionAny?: string[][];
  mustNotMention?: string[];
  requiredHeadings?: string[];
  shouldIncludeChinesePhrase?: boolean;
  requiresActionSteps?: boolean;
  requiresSourcesWhenRagEnabled?: boolean;
  maxWords?: number;
};

export type HarnessCase = {
  id: string;
  profile: PromptProfile;
  language: "en" | "zh";
  question: string;
  history?: TravelAnswerMessage[];
  metadata?: {
    promptProfile?: PromptProfile;
    sourceQuestionId?: string;
    sourceSubQuestionId?: string;
  };
  expected: HarnessExpected;
  riskTags: string[];
};

export type HarnessGenerationResult = {
  content: string;
  provider: AiProvider;
  model: string;
  promptVersion: string;
  promptProfile: PromptProfile | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  fallbackUsed: boolean;
  finishReason: string | null;
  truncated: boolean;
  maybeTruncated: boolean;
  retrieval: {
    enabled: boolean;
    matchedChunkCount: number;
    failedReason?: string;
  };
  sources: AnswerSource[];
};

export type HarnessCheckResult = {
  ruleId: string;
  status: Exclude<HarnessStatus, "pass">;
  category:
    | "generation_error"
    | "contract_failure"
    | "retrieval_degraded"
    | "retrieval_contract_failure"
    | "truncated"
    | "maybe_truncated"
    | "judge_warning"
    | "harness_error";
  message: string;
};

export type HarnessCaseResult = {
  id: string;
  profile: PromptProfile;
  language: "en" | "zh";
  question: string;
  status: HarnessStatus;
  checks: HarnessCheckResult[];
  answer: string;
  answerSummary: string;
  generation: HarnessGenerationResult | null;
  error?: string;
};

export type HarnessRunMode = "smoke" | "full" | "profile" | "case";

export type HarnessReport = {
  schemaVersion: 1;
  generatedAt: string;
  mode: HarnessRunMode;
  filters: {
    profile?: PromptProfile;
    caseId?: string;
  };
  environment: {
    node: string;
    provider: string;
    allowMock: boolean;
    concurrency: number;
  };
  summary: {
    total: number;
    pass: number;
    warning: number;
    fail: number;
  };
  byProfile: Record<
    string,
    {
      total: number;
      pass: number;
      warning: number;
      fail: number;
    }
  >;
  models: Array<{
    provider: string;
    model: string;
    promptVersion: string;
  }>;
  comparison: {
    newFailures: string[];
    fixedFailures: string[];
    statusChanges: Array<{
      id: string;
      from: HarnessStatus;
      to: HarnessStatus;
    }>;
  };
  results: HarnessCaseResult[];
};
