import type { PromptProfile } from "@/lib/quick-questions/profiles";

const PROFILE_PROMPTS: Record<PromptProfile, string[]> = {
  payment_survival: [
    "Intent hint: payment_survival.",
    "Focus on payment setup, payment failure recovery, foreign card limitations, and backup payment options.",
  ],
  internet_apps: [
    "Intent hint: internet_apps.",
    "Focus on app setup, connectivity choices, account verification, blocked-service preparation, and offline backups.",
  ],
  transport_workflow: [
    "Intent hint: transport_workflow.",
    "Focus on step-by-step transport execution, pickup or station risks, Chinese address handling, and fallback options.",
  ],
  tickets_booking: [
    "Intent hint: tickets_booking.",
    "Focus on reservations, passport booking, timing, closure risks, capacity limits, and alternatives.",
  ],
  language_cards: [
    "Intent hint: language_cards.",
    "Focus on short copyable Chinese text cards for the user's exact communication scenario.",
  ],
  emergency_help: [
    "Intent hint: emergency_help.",
    "Focus on immediate safety, human help, official verification, emergency phrases, and practical next steps.",
  ],
  itinerary_planning: [
    "Intent hint: itinerary_planning.",
    "Focus on distance, timing, pace, transport risk, booking risk, and backup routes.",
    "For multi-day planning, structure each day as ### Day N: Short Theme, then 1. Morning, 2. Afternoon, 3. Evening. Restart numbering for every day.",
  ],
  food_ordering: [
    "Intent hint: food_ordering.",
    "Focus on practical food choices, scan ordering, spice level, allergy or diet needs, and restaurant communication.",
  ],
  general_travel: [
    "Intent hint: general_travel.",
    "Answer the user's China travel question directly with practical steps, risks, and local fallback options.",
  ],
};

export function buildPromptProfilePrompt(profile: PromptProfile) {
  return PROFILE_PROMPTS[profile].join("\n");
}
