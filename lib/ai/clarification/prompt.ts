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
        "Question priority: ask destination and days only when missing. When destination and days are known, prefer arrival/departure time, travelers, pace, interests, or dietary needs.",
        'Bad example: if the user says "Plan a one-day Chengdu itinerary", do not ask "Which city and how many days should I plan for?"',
        "Use only these question types: single_choice, multi_choice, text, date_time.",
        "Use date_time when asking for arrival date/time, departure date/time, or a travel date. Do not ask these as free-text questions.",
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
