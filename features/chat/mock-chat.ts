import type { AnswerSource, AnswerVisuals } from "@/lib/api/types";
import type { PromptProfile } from "@/lib/quick-questions/profiles";
import type { QuickSubQuestion } from "@/lib/quick-questions/menus";

export const LAST_QUESTION_KEY = "chinatrip:lastQuestion";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "complete" | "loading" | "failed";
  errorCode?: string | null;
  visuals?: AnswerVisuals;
  sources?: AnswerSource[];
  quickQuestionMenu?: {
    sourceQuestionId: string;
    promptProfile: PromptProfile;
    subQuestions: QuickSubQuestion[];
  };
  truncated?: boolean;
  maybeTruncated?: boolean;
  finishReason?: string | null;
  progress?: number;
  loadingLabel?: string;
};

export type MockChat = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

export const DEFAULT_QUESTION =
  "How can foreigners use Alipay or WeChat Pay in China?";

export const mockHistoryItems = [
  {
    id: "apps-before-china",
    title: "Essential apps before China",
    preview: "Payments, maps, translation, transport...",
  },
  {
    id: "train-booking",
    title: "High-speed rail booking",
    preview: "How foreign tourists can book trains.",
  },
  {
    id: "taxi-didi",
    title: "Taxi and Didi in China",
    preview: "Getting around without speaking Chinese.",
  },
  {
    id: "ordering-food",
    title: "Ordering food without Chinese",
    preview: "Useful phrases and ordering tips.",
  },
];

export function createMessage(
  role: ChatMessage["role"],
  content: string,
  status: ChatMessage["status"] = "complete",
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    status,
  };
}

function createMockMessage(
  role: ChatMessage["role"],
  content: string,
  index: number,
): ChatMessage {
  return {
    id: `mock-${role}-${index}`,
    role,
    content,
    createdAt: new Date(Date.UTC(2026, 4, 21, 8, index)).toISOString(),
  };
}

export function createChatTitle(question: string): string {
  const normalized = question.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "New China travel question";
  }

  return normalized;
}

export function createInitialMockChat(question: string): MockChat {
  const firstQuestion = question.trim() || DEFAULT_QUESTION;

  return {
    id: "mock",
    title: createChatTitle(firstQuestion),
    messages: createLargeMockMessages(firstQuestion),
  };
}

export function createLargeMockMessages(
  seedQuestion: string,
  count = 120,
): ChatMessage[] {
  const questionPool = [
    seedQuestion.trim() || DEFAULT_QUESTION,
    "How can foreigners use Alipay or WeChat Pay in China?",
    "How do I take a taxi or use Didi in China?",
    "How can I order food in China if I don’t speak Chinese?",
    "Can foreign tourists use high-speed trains in China?",
    "What apps should I download before traveling to China?",
    "I have 10 hours in Shanghai. What can I do?",
    "Plan a 3-day Beijing trip for a first-time visitor.",
    "What should I prepare before my first trip to China?",
  ];
  const messages: ChatMessage[] = [];
  const pairCount = Math.ceil(count / 2);

  for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
    const question = questionPool[pairIndex % questionPool.length];
    const userIndex = pairIndex * 2;
    const assistantIndex = userIndex + 1;

    messages.push(createMockMessage("user", question, userIndex));

    if (messages.length < count) {
      messages.push(
        createMockMessage("assistant", generateMockAnswer(question), assistantIndex),
      );
    }
  }

  return messages;
}

export function generateMockAnswer(question: string): string {
  const normalized = question.toLowerCase();

  if (
    normalized.includes("alipay") ||
    normalized.includes("wechat") ||
    normalized.includes("pay") ||
    normalized.includes("card")
  ) {
    return `## Direct Answer
Foreign travelers can usually use Alipay and WeChat Pay in China by linking an international bank card, but it is best to set them up before arrival.

## Practical Steps
1. Download Alipay and WeChat before your trip.
2. Link a supported international Visa, Mastercard, or other bank card.
3. Complete identity verification if the app asks for it.
4. Test a small payment after arrival.
5. Keep one backup payment method, such as a physical card or some cash.

## Watch Outs
Some small vendors may not handle foreign-card-linked payments smoothly. Hotels and major stores are usually easier, but street vendors can vary.

## Useful Phrases
请问可以用支付宝吗？
Can I pay with Alipay?

可以刷外国银行卡吗？
Can I use a foreign bank card?`;
  }

  if (
    normalized.includes("didi") ||
    normalized.includes("taxi") ||
    normalized.includes("cab")
  ) {
    return `## Direct Answer
Foreign travelers can use taxis and Didi in China, but Didi is usually easier if you have mobile data and a payment method connected.

## Practical Steps
1. Install Didi or use Didi inside Alipay or WeChat.
2. Enter your destination in English or copy the Chinese address from your hotel or map app.
3. Check the license plate before getting in.
4. Keep the destination open on your phone during the ride.

## Watch Outs
Many taxi drivers do not speak English. Avoid relying only on spoken directions.

## Useful Phrases
请带我去这个地址。
Please take me to this address.

请问可以打表吗？
Can you use the meter?`;
  }

  if (
    normalized.includes("food") ||
    normalized.includes("order") ||
    normalized.includes("restaurant") ||
    normalized.includes("menu")
  ) {
    return `## Direct Answer
You can order food in China without speaking Chinese by using translation apps, picture menus, delivery apps, and a few simple phrases.

## Practical Steps
1. Use a translation app to scan menus.
2. Look for restaurants with picture menus if you are new to China.
3. Save dietary restrictions in Chinese before your trip.
4. Point to dishes politely when ordering in person.

## Watch Outs
Spicy levels and ingredients may not be obvious from photos. Ask directly if you have allergies.

## Useful Phrases
我不会说中文。
I do not speak Chinese.

这个辣吗？
Is this spicy?

不要辣，谢谢。
No spicy, thank you.`;
  }

  if (
    normalized.includes("train") ||
    normalized.includes("rail") ||
    normalized.includes("high-speed")
  ) {
    return `## Direct Answer
Foreign tourists can use high-speed trains in China. You usually need your passport for booking and station entry.

## Practical Steps
1. Book through an official or reputable travel app.
2. Enter your passport name and passport number carefully.
3. Arrive early at large stations, especially on your first trip.
4. Bring your passport because it is used as your ticket ID.

## Watch Outs
Station security and ticket checks can take time. Large stations may have multiple entrances and waiting halls.

## Useful Phrases
高铁站在哪里？
Where is the high-speed railway station?

请问这个检票口在哪里？
Where is this ticket gate?`;
  }

  if (
    normalized.includes("app") ||
    normalized.includes("download") ||
    normalized.includes("prepare")
  ) {
    return `## Direct Answer
Before traveling to China, download the key apps you need for payments, transport, translation, maps, and communication.

## Practical Steps
1. Install Alipay and WeChat for payments and daily services.
2. Install a translation app with camera translation.
3. Prepare a map app that works well in China.
4. Save hotel names and addresses in Chinese.
5. Set up mobile data or eSIM before arrival if possible.

## Watch Outs
Some international services may not work the same way in China. Test essential apps before you rely on them during your trip.

## Useful Phrases
请问这个地址怎么走？
How do I get to this address?`;
  }

  return `## Direct Answer
Yes. For a China trip, focus on practical preparation: payments, transport, mobile data, translation, and saving key addresses in Chinese.

## Practical Steps
1. Set up payment apps before or soon after arrival.
2. Save hotel and destination addresses in Chinese.
3. Prepare mobile data, translation, and map tools.
4. Keep your passport accessible for hotels, trains, and some tickets.
5. Build in extra time for large stations, popular attractions, and first-time setup.

## Watch Outs
Avoid relying on one app, one payment method, or spoken English only. A backup plan makes travel much smoother.

## Useful Phrases
请帮我看一下这个地址。
Please help me check this address.

我想去这里。
I want to go here.`;
}
