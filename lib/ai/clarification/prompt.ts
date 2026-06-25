import type { TravelAnswerLanguage, TravelAnswerMessage } from "../types";
import type { ClarifiedTripContext } from "./schema";
import type { PromptProfile } from "@/lib/quick-questions/profiles";

export function buildClarificationMessages({
  userMessage,
  language,
  promptProfile,
  knownContext,
}: {
  userMessage: string;
  language: TravelAnswerLanguage;
  promptProfile?: PromptProfile;
  knownContext?: ClarifiedTripContext;
}): TravelAnswerMessage[] {
  const serializedKnownContext =
    knownContext && Object.keys(knownContext).length > 0
      ? JSON.stringify(knownContext)
      : "{}";

  return [
    {
      role: "system",
      content: [
        "You generate temporary trip-planning clarification questions for ChinaTrip AI.",
        "Return JSON only. Do not wrap it in markdown. Do not answer the itinerary.",
        "The user is a foreign traveler visiting China.",
        "Decide whether the request needs clarification before creating an itinerary.",
        "Ask only useful missing questions. Do not ask for details already present in the user message.",
        `Known context extracted from the user message: ${serializedKnownContext}.`,
        "Never ask for a known field in knownContext. If destination is known, do not ask city/destination/where. If days is known, do not ask duration/how many days.",
        "China is a broad country scope, not a concrete itinerary destination. If the user only says China/中国 without a city, treat the concrete city or city combination as missing.",
        "Question priority: ask destination and days only when missing. For country-scope requests with known days, ask city/cities plus high-value preferences such as travel theme, travelers, and pace before arrival/departure date. Do not stop at only one city question. When destination and days are known, prefer arrival/departure date, travelers, pace, interests, or dietary needs.",
        'Bad example: if the user says "Plan a one-day Chengdu itinerary", do not ask "Which city and how many days should I plan for?"',
        'Bad example: if the user says "Can you help me plan a simple five-day China itinerary?", do not ask arrival/departure date first; ask which cities or themes they prefer.',
        "Use only these question types: single_choice, multi_choice, text, date_time.",
        "Use date_time when asking for an arrival date, departure date, or travel date. The frontend collects a calendar date only, not hour/minute. Do not ask these as free-text questions.",
        "Create at most 6 questions. Keep option labels short.",
        "If the user provided enough context, set needsClarification to false and questions to an empty array.",
        "If the request is not about trip or itinerary planning, set needsClarification to false.",
        `Answer language for question titles: ${language}.`,
        promptProfile ? `Requested promptProfile: ${promptProfile}.` : null,
        "",
        "Required JSON shape:",
        '{ "intent": "itinerary_planning", "needsClarification": boolean, "reason": string, "extractedContext": { "destination"?: string, "days"?: number, "arrivalTime"?: string, "departureTime"?: string, "travelers"?: string, "pace"?: string, "budget"?: string, "interests"?: string[], "dietaryNeeds"?: string[], "startArea"?: string, "avoidances"?: string[], "specialNeeds"?: string[], "notes"?: string }, "questions": [{ "id": string, "title": string, "description"?: string, "type": "single_choice" | "multi_choice" | "text" | "date_time", "required": boolean, "options"?: [{ "label": string, "value": string }], "allowOther"?: boolean }] }',
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}
