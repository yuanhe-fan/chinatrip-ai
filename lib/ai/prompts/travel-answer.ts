import type {
  GenerateTravelAnswerInput,
  TravelAnswerMessage,
} from "../types";
import { buildCorePrompt } from "./core";
import { buildIntentClassifierPrompt } from "./intent-classifier";
import { buildOutputContractPrompt } from "./output-contract";
import { buildPainPointsPrompt } from "./pain-points";
import { buildPromptProfilePrompt } from "./profiles";
import { buildTemplatesPrompt } from "./templates";
import {
  classifyPromptProfile,
  isPromptProfile,
  type PromptProfile,
} from "@/lib/quick-questions/profiles";

export const TRAVEL_ANSWER_PROMPT_VERSION =
  "travel-answer-v12-payment-failure-safety";

export function resolveTravelPromptProfile(input: {
  userMessage: string;
  metadata?: Record<string, unknown>;
}): PromptProfile {
  const requestedProfile = input.metadata?.promptProfile;

  if (isPromptProfile(requestedProfile)) {
    return requestedProfile;
  }

  return classifyPromptProfile(input.userMessage);
}

export function buildTravelAnswerMessages(
  input: GenerateTravelAnswerInput,
): TravelAnswerMessage[] {
  const language = input.language ?? "en";
  const history = input.history ?? [];
  const promptProfile = resolveTravelPromptProfile(input);

  return [
    {
      role: "system",
      content: [
        buildCorePrompt(language),
        buildPainPointsPrompt(),
        buildIntentClassifierPrompt(),
        buildPromptProfilePrompt(promptProfile),
        buildTemplatesPrompt(),
        input.knowledgeContext,
        buildOutputContractPrompt(),
      ].filter(Boolean).join("\n"),
    },
    ...history,
    {
      role: "user",
      content: input.userMessage,
    },
  ];
}
