import "server-only";

import { getConfiguredProvider } from "../config";
import { AiProviderError } from "../errors";
import { deepseekProvider } from "../providers/deepseek";
import { doubaoProvider } from "../providers/doubao";
import { mockProvider } from "../providers/mock";
import type { AiProvider, AiProviderAdapter, TravelAnswerLanguage } from "../types";
import {
  CLARIFICATION_PROMPT_VERSION,
  clarificationFlowSchema,
  createFallbackClarificationFlow,
  type ClarificationFlow,
} from "./schema";
import { extractClarifiedTripContext } from "./context-extractor";
import { buildClarificationMessages } from "./prompt";
import { normalizeClarificationFlow } from "./question-filter";
import type { PromptProfile } from "@/lib/quick-questions/profiles";

const PROVIDERS: Record<AiProvider, AiProviderAdapter> = {
  mock: mockProvider,
  doubao: doubaoProvider,
  deepseek: deepseekProvider,
};

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error("Clarification response did not contain a JSON object.");
  }

  return candidate.slice(startIndex, endIndex + 1);
}

export function parseClarificationContent(content: string): ClarificationFlow {
  const parsedJson = JSON.parse(extractJsonObject(content)) as unknown;
  const parsedFlow = clarificationFlowSchema.safeParse(parsedJson);

  if (!parsedFlow.success) {
    throw new Error(parsedFlow.error.message);
  }

  return parsedFlow.data;
}

export async function generateTripClarification(input: {
  chatId: string;
  userMessage: string;
  language: TravelAnswerLanguage;
  promptProfile?: PromptProfile;
  signal?: AbortSignal;
}): Promise<ClarificationFlow> {
  const providerName = getConfiguredProvider();
  const provider = PROVIDERS[providerName];
  const knownContext = extractClarifiedTripContext(input.userMessage);

  if (providerName === "mock") {
    return createFallbackClarificationFlow(knownContext);
  }

  try {
    const result = await provider.generateAnswer({
      chatId: input.chatId,
      language: input.language,
      messages: buildClarificationMessages({
        ...input,
        knownContext,
      }),
      promptVersion: CLARIFICATION_PROMPT_VERSION,
      signal: input.signal,
    });

    return normalizeClarificationFlow(
      parseClarificationContent(result.content),
      knownContext,
    );
  } catch (error) {
    console.warn("trip_clarification_failed", {
      chatId: input.chatId,
      provider: providerName,
      code: error instanceof AiProviderError ? error.code : undefined,
      reason: error instanceof Error ? error.message : String(error),
    });

    return createFallbackClarificationFlow(knownContext);
  }
}
