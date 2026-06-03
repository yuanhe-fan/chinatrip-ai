import type { AnswerVisuals } from "@/lib/api/types";
import { findAnswerAssets, findItineraryPoiAssets } from "./registry";
import type { PromptProfile } from "@/lib/quick-questions/profiles";

const CARD_COPY: Record<PromptProfile, AnswerVisuals["cards"]> = {
  payment_survival: [],
  internet_apps: [],
  transport_workflow: [],
  tickets_booking: [],
  language_cards: [],
  emergency_help: [],
  itinerary_planning: [],
  food_ordering: [],
  general_travel: [],
};

function createTags(question: string, answer: string) {
  return `${question} ${answer}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function selectAnswerVisuals({
  profile,
  question,
  answer,
}: {
  profile: PromptProfile;
  question: string;
  answer: string;
}): AnswerVisuals | undefined {
  if (profile === "itinerary_planning") {
    const embeddedAssetIds = findItineraryPoiAssets({
      text: `${question} ${answer}`,
    }).map((asset) => asset.id);

    return embeddedAssetIds.length > 0 ? { embeddedAssetIds } : undefined;
  }

  const assets = findAnswerAssets({
    profile,
    tags: [profile, ...createTags(question, answer)],
  });
  const heroAssetId = assets[0]?.id;
  const inlineAssetIds = assets.slice(1).map((asset) => asset.id);
  const cards = CARD_COPY[profile] ?? [];

  if (!heroAssetId && inlineAssetIds.length === 0 && cards.length === 0) {
    return undefined;
  }

  return {
    heroAssetId,
    inlineAssetIds: inlineAssetIds.length > 0 ? inlineAssetIds : undefined,
    cards: cards.length > 0 ? cards : undefined,
  };
}
