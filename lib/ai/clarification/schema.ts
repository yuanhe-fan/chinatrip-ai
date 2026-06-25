import { z } from "zod";

export const CLARIFICATION_PROMPT_VERSION =
  "trip-clarification-v1-ephemeral-context";

export const clarificationQuestionTypeSchema = z.enum([
  "single_choice",
  "multi_choice",
  "text",
  "date_time",
]);

export const clarificationOptionSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(80),
});

export const clarifiedTripContextSchema = z
  .object({
    destination: z.string().trim().min(1).max(80).optional(),
    days: z.number().int().min(1).max(30).optional(),
    arrivalTime: z.string().trim().min(1).max(80).optional(),
    departureTime: z.string().trim().min(1).max(80).optional(),
    travelers: z.string().trim().min(1).max(80).optional(),
    pace: z.string().trim().min(1).max(80).optional(),
    budget: z.string().trim().min(1).max(80).optional(),
    interests: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
    dietaryNeeds: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
    startArea: z.string().trim().min(1).max(120).optional(),
    avoidances: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    specialNeeds: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    notes: z.string().trim().min(1).max(500).optional(),
  })
  .strip();

export const clarificationQuestionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(48)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(240).optional(),
    type: clarificationQuestionTypeSchema,
    required: z.boolean(),
    options: z.array(clarificationOptionSchema).max(8).optional(),
    allowOther: z.boolean().optional(),
  })
  .superRefine((question, context) => {
    if (question.type === "text" || question.type === "date_time") {
      return;
    }

    const optionCount = question.options?.length ?? 0;

    if (!question.allowOther && optionCount < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choice questions require at least two options.",
        path: ["options"],
      });
    }
  });

export const clarificationFlowSchema = z
  .object({
    intent: z.literal("itinerary_planning"),
    needsClarification: z.boolean(),
    reason: z.string().trim().min(1).max(300),
    extractedContext: clarifiedTripContextSchema.default({}),
    questions: z.array(clarificationQuestionSchema).max(6),
  })
  .superRefine((flow, context) => {
    if (flow.needsClarification && flow.questions.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A clarification flow must include questions.",
        path: ["questions"],
      });
    }
  });

export type ClarificationQuestionType = z.infer<
  typeof clarificationQuestionTypeSchema
>;
export type ClarificationOption = z.infer<typeof clarificationOptionSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type ClarifiedTripContext = z.infer<typeof clarifiedTripContextSchema>;
export type ClarificationFlow = z.infer<typeof clarificationFlowSchema>;

export function parseClarifiedTripContext(value: unknown) {
  return clarifiedTripContextSchema.safeParse(value);
}

export function isClarifiedTripContext(
  value: unknown,
): value is ClarifiedTripContext {
  return parseClarifiedTripContext(value).success;
}

export function createFallbackClarificationFlow(
  extractedContext: ClarifiedTripContext = {},
): ClarificationFlow {
  const questions: ClarificationQuestion[] = [];
  const addDestinationQuestion = () => {
    questions.push({
      id: "destination",
      title: "Which city or cities do you want to include?",
      description:
        "Choose a starting focus for the itinerary. You can pick Other if you already have a different route in mind.",
      type: "single_choice",
      required: true,
      options: [
        { label: "Beijing", value: "Beijing" },
        { label: "Shanghai", value: "Shanghai" },
        { label: "Chengdu", value: "Chengdu" },
        { label: "Xi'an", value: "Xi'an" },
      ],
      allowOther: true,
    });
  };
  const addInterestsQuestion = () => {
    questions.push({
      id: "interests",
      title: "What do you care about most?",
      type: "multi_choice",
      required: true,
      options: [
        { label: "History", value: "history" },
        { label: "Food", value: "food" },
        { label: "Pandas", value: "pandas" },
        { label: "Modern city", value: "modern city" },
        { label: "Nature", value: "nature" },
        { label: "Shopping", value: "shopping" },
      ],
      allowOther: true,
    });
  };
  const addTravelersQuestion = () => {
    questions.push({
      id: "travelers",
      title: "Who is traveling with you?",
      type: "single_choice",
      required: true,
      options: [
        { label: "Solo", value: "solo" },
        { label: "Couple", value: "couple" },
        { label: "Family", value: "family" },
        { label: "Friends", value: "friends" },
      ],
      allowOther: true,
    });
  };
  const addPaceQuestion = () => {
    questions.push({
      id: "pace",
      title: "What pace do you prefer?",
      type: "single_choice",
      required: true,
      options: [
        { label: "Relaxed", value: "relaxed" },
        { label: "Moderate", value: "moderate" },
        { label: "Packed", value: "packed" },
      ],
    });
  };

  if (!extractedContext.destination && !extractedContext.days) {
    questions.push({
      id: "destination_and_days",
      title: "Which city and how many days should I plan for?",
      description:
        "Add the city, number of days, and any timing details you already know.",
      type: "text",
      required: true,
    });
  } else if (!extractedContext.destination) {
    addDestinationQuestion();

    if (!extractedContext.interests?.length) {
      addInterestsQuestion();
    }

    if (!extractedContext.travelers) {
      addTravelersQuestion();
    }

    if (!extractedContext.pace) {
      addPaceQuestion();
    }
  } else if (!extractedContext.days) {
    questions.push({
      id: "days",
      title: "How many days should I plan for?",
      type: "text",
      required: true,
    });
  } else if (!extractedContext.arrivalTime || !extractedContext.departureTime) {
    if (!extractedContext.arrivalTime) {
      questions.push({
        id: "arrival_time",
        title: "When will you arrive?",
        description: "Choose the date you expect to start the itinerary.",
        type: "date_time",
        required: true,
      });
    }

    if (!extractedContext.departureTime) {
      questions.push({
        id: "departure_time",
        title: "When will you leave?",
        description: "Choose the date you need the itinerary to end.",
        type: "date_time",
        required: true,
      });
    }
  } else if (!extractedContext.travelers) {
    addTravelersQuestion();
  } else if (!extractedContext.pace) {
    addPaceQuestion();
  } else if (!extractedContext.interests?.length) {
    addInterestsQuestion();
  }

  if (questions.length === 0) {
    return {
      intent: "itinerary_planning",
      needsClarification: false,
      reason: "Enough context is available for itinerary planning.",
      extractedContext,
      questions: [],
    };
  }

  return {
    intent: "itinerary_planning",
    needsClarification: true,
    reason:
      "Clarification generation fell back to a context-aware safe question.",
    extractedContext,
    questions,
  };
}
