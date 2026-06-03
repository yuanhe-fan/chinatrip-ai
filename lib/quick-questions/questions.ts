import type { PromptProfile } from "./profiles";

export type QuickQuestionId =
  | "payment"
  | "itinerary_planning"
  | "internet_apps"
  | "transport"
  | "tickets_booking"
  | "emergency";

export type QuickQuestion = {
  id: QuickQuestionId;
  label: string;
  question: string;
  subtitle: string;
  promptProfile: PromptProfile;
};

export const HOME_QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: "payment",
    label: "Payment",
    question: "What should I do if I cannot pay after arriving in China?",
    subtitle: "Alipay, WeChat Pay, cards, cash backup",
    promptProfile: "payment_survival",
  },
  {
    id: "itinerary_planning",
    label: "Itinerary Planning",
    question: "Can you help me plan a simple one-day China itinerary?",
    subtitle: "Beijing, Shanghai, Chengdu, Xi'an, custom plan",
    promptProfile: "itinerary_planning",
  },
  {
    id: "internet_apps",
    label: "Internet & Apps",
    question: "Which apps, SIM, eSIM, and VPN setup do I need before going to China?",
    subtitle: "Apps, mobile data, blocked services",
    promptProfile: "internet_apps",
  },
  {
    id: "transport",
    label: "Transport",
    question: "How do I use airports, metro, taxis, Didi, and high-speed trains in China?",
    subtitle: "Airport, metro, taxi, Didi, rail",
    promptProfile: "transport_workflow",
  },
  {
    id: "tickets_booking",
    label: "Tickets & Booking",
    question: "Can I visit attractions directly, or do I need reservations and passport booking?",
    subtitle: "Reservations, passport, closed days",
    promptProfile: "tickets_booking",
  },
  {
    id: "emergency",
    label: "Emergency",
    question: "What should I do if I lose my passport, phone, payment access, or need medical help in China?",
    subtitle: "Passport, phone, hospital, emergency phrases",
    promptProfile: "emergency_help",
  },
];

export function findQuickQuestionByExactQuestion(question: string) {
  const normalized = question.trim();

  return HOME_QUICK_QUESTIONS.find((item) => item.question === normalized) ?? null;
}

export function findQuickQuestionById(id: unknown) {
  if (typeof id !== "string") {
    return null;
  }

  return HOME_QUICK_QUESTIONS.find((item) => item.id === id) ?? null;
}
