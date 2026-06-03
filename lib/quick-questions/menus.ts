import type { PromptProfile } from "./profiles";
import type { QuickQuestionId } from "./questions";

export type QuickSubQuestion = {
  id: string;
  label: string;
  question: string;
  promptProfile: PromptProfile;
};

export type QuickQuestionMenu = {
  sourceQuestionId: QuickQuestionId;
  promptProfile: PromptProfile;
  title: string;
  intro: string;
  subQuestions: QuickSubQuestion[];
};

export const QUICK_QUESTION_MENUS: Record<QuickQuestionId, QuickQuestionMenu> = {
  payment: {
    sourceQuestionId: "payment",
    promptProfile: "payment_survival",
    title: "Payment questions travelers usually need first",
    intro:
      "Choose the payment issue that matches your situation. I will give you a focused step-by-step answer.",
    subQuestions: [
      {
        id: "alipay-card-setup",
        label: "Set up Alipay",
        question: "How do I set up Alipay with an international card?",
        promptProfile: "payment_survival",
      },
      {
        id: "payment-fails",
        label: "Payment fails",
        question: "What should I do if WeChat Pay or Alipay fails at checkout?",
        promptProfile: "payment_survival",
      },
      {
        id: "cards-cash",
        label: "Cards or cash",
        question: "Can I use Visa, Mastercard, or cash in China?",
        promptProfile: "payment_survival",
      },
      {
        id: "daily-payments",
        label: "Daily payments",
        question: "How can I pay taxis, restaurants, and small shops?",
        promptProfile: "payment_survival",
      },
      {
        id: "payment-backups",
        label: "Backup plan",
        question: "What payment backups should I prepare before arrival?",
        promptProfile: "payment_survival",
      },
    ],
  },
  itinerary_planning: {
    sourceQuestionId: "itinerary_planning",
    promptProfile: "itinerary_planning",
    title: "Choose a one-day itinerary to start",
    intro:
      "Pick a city or ask for a custom plan. I will build a practical route with timing, transport, booking risks, and backups.",
    subQuestions: [
      {
        id: "beijing-one-day",
        label: "Beijing 1 day",
        question: "Plan a one-day Beijing itinerary for a first-time visitor.",
        promptProfile: "itinerary_planning",
      },
      {
        id: "shanghai-one-day",
        label: "Shanghai 1 day",
        question: "Plan a one-day Shanghai itinerary for a first-time visitor.",
        promptProfile: "itinerary_planning",
      },
      {
        id: "chengdu-one-day",
        label: "Chengdu 1 day",
        question: "Plan a one-day Chengdu itinerary for a first-time visitor.",
        promptProfile: "itinerary_planning",
      },
      {
        id: "xian-one-day",
        label: "Xi'an 1 day",
        question: "Plan a one-day Xi'an itinerary for a first-time visitor.",
        promptProfile: "itinerary_planning",
      },
      {
        id: "custom-itinerary",
        label: "Custom plan",
        question: "Help me create a custom China travel plan.",
        promptProfile: "itinerary_planning",
      },
    ],
  },
  internet_apps: {
    sourceQuestionId: "internet_apps",
    promptProfile: "internet_apps",
    title: "Internet and app setup questions",
    intro:
      "Pick the setup problem you want to solve first. I will keep the answer practical and travel-focused.",
    subQuestions: [
      {
        id: "essential-apps",
        label: "Essential apps",
        question: "Which apps should I install before going to China?",
        promptProfile: "internet_apps",
      },
      {
        id: "connectivity-choice",
        label: "SIM or roaming",
        question: "Should I use roaming, SIM, eSIM, or airport Wi-Fi?",
        promptProfile: "internet_apps",
      },
      {
        id: "blocked-apps",
        label: "Blocked apps",
        question:
          "What should I prepare if Google, WhatsApp, or Instagram do not work?",
        promptProfile: "internet_apps",
      },
      {
        id: "sms-verification",
        label: "SMS codes",
        question: "How do I receive SMS verification codes in China?",
        promptProfile: "internet_apps",
      },
      {
        id: "offline-backups",
        label: "Offline backups",
        question: "What offline backups should I prepare before departure?",
        promptProfile: "internet_apps",
      },
    ],
  },
  transport: {
    sourceQuestionId: "transport",
    promptProfile: "transport_workflow",
    title: "Transport questions travelers ask most",
    intro:
      "Choose a transport scenario and I will give you the exact workflow, fallback, and Chinese text when useful.",
    subQuestions: [
      {
        id: "airport-to-hotel",
        label: "Airport to hotel",
        question: "How do I get from the airport to my hotel?",
        promptProfile: "transport_workflow",
      },
      {
        id: "didi-taxi",
        label: "Didi or taxi",
        question: "How do I use Didi or taxis without speaking Chinese?",
        promptProfile: "transport_workflow",
      },
      {
        id: "metro",
        label: "Metro",
        question: "How do I take the metro in Chinese cities?",
        promptProfile: "transport_workflow",
      },
      {
        id: "high-speed-rail",
        label: "High-speed rail",
        question: "How do I book and board high-speed trains with a passport?",
        promptProfile: "transport_workflow",
      },
      {
        id: "address-card",
        label: "Address card",
        question: "What Chinese address should I show drivers or station staff?",
        promptProfile: "transport_workflow",
      },
    ],
  },
  tickets_booking: {
    sourceQuestionId: "tickets_booking",
    promptProfile: "tickets_booking",
    title: "Tickets and reservation questions",
    intro:
      "Choose the booking problem you are facing. I will focus on passport rules, timing, and backup options.",
    subQuestions: [
      {
        id: "advance-reservation",
        label: "Need reservation?",
        question: "Do popular attractions require advance reservation?",
        promptProfile: "tickets_booking",
      },
      {
        id: "passport-booking",
        label: "Passport booking",
        question: "How do I book tickets with a foreign passport?",
        promptProfile: "tickets_booking",
      },
      {
        id: "before-visit-checks",
        label: "Before visiting",
        question: "What should I check before visiting museums or scenic spots?",
        promptProfile: "tickets_booking",
      },
      {
        id: "sold-out",
        label: "Sold out",
        question: "What can I do if tickets are sold out?",
        promptProfile: "tickets_booking",
      },
      {
        id: "booking-timing",
        label: "When to book",
        question:
          "How early should I book attractions in Beijing, Shanghai, Xi'an, or Chengdu?",
        promptProfile: "tickets_booking",
      },
    ],
  },
  emergency: {
    sourceQuestionId: "emergency",
    promptProfile: "emergency_help",
    title: "Emergency help topics",
    intro:
      "Choose the issue closest to your situation. I will prioritize immediate steps and getting human help.",
    subQuestions: [
      {
        id: "lost-passport",
        label: "Lost passport",
        question: "What should I do if I lose my passport?",
        promptProfile: "emergency_help",
      },
      {
        id: "lost-phone",
        label: "Lost phone",
        question: "What should I do if I lose my phone?",
        promptProfile: "emergency_help",
      },
      {
        id: "payment-lockout",
        label: "Cannot pay",
        question: "What should I do if I cannot pay or access my money?",
        promptProfile: "emergency_help",
      },
      {
        id: "medical-help",
        label: "Medical help",
        question: "How do I get medical help in China?",
        promptProfile: "emergency_help",
      },
      {
        id: "ask-for-help",
        label: "Ask for help",
        question:
          "What should I say when asking police, hotel staff, or locals for help?",
        promptProfile: "emergency_help",
      },
    ],
  },
};

export function getQuickQuestionMenu(id: QuickQuestionId) {
  return QUICK_QUESTION_MENUS[id];
}

export function findQuickSubQuestion({
  sourceQuestionId,
  sourceSubQuestionId,
}: {
  sourceQuestionId: unknown;
  sourceSubQuestionId: unknown;
}) {
  if (typeof sourceQuestionId !== "string" || typeof sourceSubQuestionId !== "string") {
    return null;
  }

  const menu = QUICK_QUESTION_MENUS[sourceQuestionId as QuickQuestionId];

  if (!menu) {
    return null;
  }

  const subQuestion =
    menu.subQuestions.find((item) => item.id === sourceSubQuestionId) ?? null;

  return subQuestion
    ? {
        menu,
        subQuestion,
      }
    : null;
}

export function createQuickQuestionMenuContent(menu: QuickQuestionMenu) {
  return `${menu.intro} Choose a specific question below, or type your own question if your situation is different.`;
}

export function createQuickQuestionMenuMetadata(menu: QuickQuestionMenu) {
  return {
    type: "quick_question_menu" as const,
    promptProfile: menu.promptProfile,
    sourceQuestionId: menu.sourceQuestionId,
    subQuestions: menu.subQuestions,
  };
}
