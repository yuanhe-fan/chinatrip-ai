export const PROMPT_PROFILES = [
  "payment_survival",
  "internet_apps",
  "transport_workflow",
  "tickets_booking",
  "language_cards",
  "emergency_help",
  "itinerary_planning",
  "food_ordering",
  "general_travel",
] as const;

export type PromptProfile = (typeof PROMPT_PROFILES)[number];

const PROMPT_PROFILE_SET = new Set<string>(PROMPT_PROFILES);

export function isPromptProfile(value: unknown): value is PromptProfile {
  return typeof value === "string" && PROMPT_PROFILE_SET.has(value);
}

export function classifyPromptProfile(question: string): PromptProfile {
  const normalized = question.toLowerCase();

  if (
    /\b(alipay|wechat pay|pay|payment|card|cash|qr|deposit|wallet|visa|mastercard)\b/.test(
      normalized,
    )
  ) {
    return "payment_survival";
  }

  if (
    /\b(app|apps|sim|esim|vpn|roaming|internet|data|wifi|google|sms|phone number|translate|translation)\b/.test(
      normalized,
    )
  ) {
    return "internet_apps";
  }

  if (
    /\b(airport|metro|subway|taxi|didi|train|rail|station|transport|high-speed|high speed|pickup|transfer)\b/.test(
      normalized,
    )
  ) {
    return "transport_workflow";
  }

  if (
    /\b(ticket|booking|reservation|reserve|passport booking|attraction|museum|forbidden city|closed|entry|visit directly)\b/.test(
      normalized,
    )
  ) {
    return "tickets_booking";
  }

  if (
    /\b(chinese phrase|phrase|say|show|address card|driver|shop staff|hotel staff|communicate|language|mandarin)\b/.test(
      normalized,
    )
  ) {
    return "language_cards";
  }

  if (
    /\b(emergency|passport lost|lost passport|hospital|police|embassy|consulate|ill|sick|medicine|pharmacy|lost phone|stolen)\b/.test(
      normalized,
    )
  ) {
    return "emergency_help";
  }

  if (
    /\b(itinerary|plan my|travel plan|route|schedule|day trip|one-day|1-day|3-day|three-day|hours in|pace|distance)\b/.test(
      normalized,
    ) ||
    /\b(beijing|shanghai|chengdu|xi'?an|xian)\b.*\b(one day|1 day|one-day|1-day|day itinerary)\b/.test(
      normalized,
    )
  ) {
    return "itinerary_planning";
  }

  if (
    /\b(food|eat|restaurant|menu|spicy|order|allergy|vegetarian|vegan|halal|dish|cuisine)\b/.test(
      normalized,
    )
  ) {
    return "food_ordering";
  }

  return "general_travel";
}
