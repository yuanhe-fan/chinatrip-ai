import { z } from "zod";

export const CLARIFICATION_PROMPT_VERSION =
  "trip-clarification-v2-preference-first";

export const clarificationQuestionTypeSchema = z.enum([
  "single_choice",
  "multi_choice",
  "text",
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
    if (question.type === "text") {
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
    questions: z.array(clarificationQuestionSchema).max(5),
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
        { label: "History & culture", value: "history" },
        { label: "Food & local life", value: "food" },
        { label: "Nature & scenery", value: "nature" },
        { label: "Modern city & shopping", value: "shopping" },
        { label: "Family activities", value: "family activities" },
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
        { label: "Friends", value: "friends" },
        { label: "Family with children", value: "family with children" },
        { label: "With seniors", value: "with seniors" },
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
  const addDaysQuestion = () => {
    questions.push({
      id: "days",
      title: "How many days should I plan for?",
      type: "single_choice",
      required: true,
      options: [
        { label: "1 day", value: "1" },
        { label: "2 days", value: "2" },
        { label: "3 days", value: "3" },
        { label: "4–5 days", value: "5" },
        { label: "6–7 days", value: "7" },
      ],
      allowOther: true,
    });
  };

  if (!extractedContext.destination) {
    addDestinationQuestion();
  }

  if (!extractedContext.days) {
    addDaysQuestion();
  }

  if (!extractedContext.travelers) {
    addTravelersQuestion();
  }

  if (!extractedContext.pace) {
    addPaceQuestion();
  }

  if (!extractedContext.interests?.length) {
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
    questions: questions.slice(0, 5),
  };
}
