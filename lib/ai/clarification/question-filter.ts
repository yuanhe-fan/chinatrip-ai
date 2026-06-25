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
  {
    field: "startArea",
    pattern: /\b(start area|hotel|stay|staying|where are you staying|starting point)\b|酒店|住宿|住在|出发点|从哪里/i,
  },
  {
    field: "specialNeeds",
    pattern: /\b(accessibility|less walking|stairs|wheelchair|mobility|special needs)\b|少走路|无障碍|楼梯|不要太累|特殊需求/i,
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

function asksField(
  question: ClarificationQuestion,
  field: keyof ClarifiedTripContext,
) {
  const text = questionAsText(question);
  const fieldPattern = QUESTION_FIELD_PATTERNS.find(
    (item) => item.field === field,
  );

  return fieldPattern ? fieldPattern.pattern.test(text) : false;
}

function inferBaselineField(question: ClarificationQuestion) {
  const id = question.id.toLowerCase();

  if (id.includes("destination") || id.includes("city")) {
    return "destination";
  }

  if (id.includes("interest") || id.includes("theme")) {
    return "interests";
  }

  if (id.includes("traveler") || id.includes("companion")) {
    return "travelers";
  }

  if (id.includes("pace")) {
    return "pace";
  }

  const baselineFields: Array<keyof ClarifiedTripContext> = [
    "destination",
    "interests",
    "travelers",
    "pace",
  ];

  return baselineFields.find((field) => asksField(question, field));
}

function asksTimingBeforeDestination(
  question: ClarificationQuestion,
  context: ClarifiedTripContext,
) {
  if (hasKnownValue(context, "destination")) {
    return false;
  }

  const text = questionAsText(question);

  return QUESTION_FIELD_PATTERNS.some(
    ({ field, pattern }) =>
      (field === "arrivalTime" || field === "departureTime") &&
      pattern.test(text),
  );
}

function withBroadScopeBaselineQuestions(
  questions: ClarificationQuestion[],
  context: ClarifiedTripContext,
) {
  if (!hasKnownValue(context, "days") || hasKnownValue(context, "destination")) {
    return questions;
  }

  const fallbackQuestions = createFallbackClarificationFlow(context).questions;
  const merged = [...questions];
  for (const fallbackQuestion of fallbackQuestions) {
    const fallbackField = inferBaselineField(fallbackQuestion);
    const alreadyCovered =
      merged.some((question) => question.id === fallbackQuestion.id) ||
      (fallbackField
        ? merged.some(
            (question) => inferBaselineField(question) === fallbackField,
          )
        : false);

    if (!alreadyCovered) {
      merged.push(fallbackQuestion);
    }

    if (merged.length >= 6) {
      break;
    }
  }

  return merged;
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
  const questions = withBroadScopeBaselineQuestions(
    flow.questions.filter(
      (question) =>
        !asksKnownField(question, extractedContext) &&
        !asksTimingBeforeDestination(question, extractedContext),
    ),
    extractedContext,
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
