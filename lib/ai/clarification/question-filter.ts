import type {
  ClarificationFlow,
  ClarificationQuestion,
  ClarifiedTripContext,
} from "./schema";
import { createFallbackClarificationFlow } from "./schema";

const QUESTION_FIELD_PATTERNS: Array<{
  field: keyof ClarifiedTripContext;
  pattern: RegExp;
}> = [
  {
    field: "destination",
    pattern: /\b(city|destination|where|which place|which area)\b|城市|目的地|哪里|去哪/i,
  },
  {
    field: "days",
    pattern: /\b(days?|duration|how many days|length)\b|几天|多少天|天数|日程/i,
  },
  {
    field: "arrivalTime",
    pattern: /\b(arrival|arrive|start time|what time do you arrive)\b|抵达|到达|几点到/i,
  },
  {
    field: "departureTime",
    pattern: /\b(departure|depart|leave|end time|what time do you leave)\b|离开|返程|几点走/i,
  },
  {
    field: "travelers",
    pattern: /\b(traveler|travelers|people|companion|who is traveling)\b|同行|几个人|老人|孩子|儿童/i,
  },
  {
    field: "pace",
    pattern: /\b(pace|speed|relaxed|packed|moderate|walking intensity)\b|节奏|轻松|紧凑|强度/i,
  },
  {
    field: "budget",
    pattern: /\b(budget|cost|spend|price)\b|预算|花费|消费/i,
  },
  {
    field: "interests",
    pattern: /\b(interest|interests|prefer|preferences|museum|food|history|shopping)\b|兴趣|偏好|喜欢|博物馆|美食|历史|购物/i,
  },
  {
    field: "dietaryNeeds",
    pattern: /\b(diet|dietary|allergy|halal|vegetarian|vegan|spicy)\b|饮食|忌口|过敏|清真|素食|辣/i,
  },
];

function hasKnownValue(
  context: ClarifiedTripContext,
  field: keyof ClarifiedTripContext,
) {
  const value = context[field];

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && value !== null && value !== "";
}

function questionAsText(question: ClarificationQuestion) {
  return `${question.id} ${question.title} ${question.description ?? ""}`;
}

function asksKnownField(
  question: ClarificationQuestion,
  context: ClarifiedTripContext,
) {
  const text = questionAsText(question);

  return QUESTION_FIELD_PATTERNS.some(
    ({ field, pattern }) => hasKnownValue(context, field) && pattern.test(text),
  );
}

export function mergeClarificationContext(
  aiContext: ClarifiedTripContext,
  knownContext: ClarifiedTripContext,
): ClarifiedTripContext {
  return {
    ...aiContext,
    ...knownContext,
  };
}

export function normalizeClarificationFlow(
  flow: ClarificationFlow,
  knownContext: ClarifiedTripContext,
): ClarificationFlow {
  const extractedContext = mergeClarificationContext(
    flow.extractedContext,
    knownContext,
  );
  const questions = flow.questions.filter(
    (question) => !asksKnownField(question, extractedContext),
  );

  if (!flow.needsClarification) {
    return {
      ...flow,
      extractedContext,
      questions: [],
    };
  }

  if (questions.length > 0) {
    return {
      ...flow,
      extractedContext,
      questions,
    };
  }

  return createFallbackClarificationFlow(extractedContext);
}
