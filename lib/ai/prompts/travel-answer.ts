import type {
  GenerateTravelAnswerInput,
  TravelAnswerMessage,
} from "../types";
import type { ClarifiedTripContext } from "@/lib/ai/clarification/schema";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildClarifiedTripContextPrompt(metadata: unknown) {
  if (!isRecord(metadata) || metadata.clarificationUsed !== true) {
    return null;
  }

  const context = metadata.clarifiedTripContext as Partial<ClarifiedTripContext>;
  const rows = [
    ["Destination", context.destination],
    ["Days", typeof context.days === "number" ? String(context.days) : undefined],
    ["Arrival time", context.arrivalTime],
    ["Departure time", context.departureTime],
    ["Travelers", context.travelers],
    ["Pace", context.pace],
    ["Budget", context.budget],
    ["Interests", toStringList(context.interests).join(", ")],
    ["Dietary needs", toStringList(context.dietaryNeeds).join(", ")],
    ["Start area", context.startArea],
    ["Avoid", toStringList(context.avoidances).join(", ")],
    ["Special needs", toStringList(context.specialNeeds).join(", ")],
    ["Notes", context.notes],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0) {
    return null;
  }

  return [
    "Clarified trip context:",
    "Use these traveler choices as requirements for the itinerary. Do not mention that they came from a clarification flow.",
    ...rows.map(([label, value]) => `- ${label}: ${value}`),
  ].join("\n");
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
        buildClarifiedTripContextPrompt(input.metadata),
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
