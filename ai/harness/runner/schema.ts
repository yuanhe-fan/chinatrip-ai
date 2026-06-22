import { z } from "zod";
import { PROMPT_PROFILES } from "../../../lib/quick-questions/profiles";

const promptProfileSchema = z.enum(PROMPT_PROFILES);

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const expectedSchema = z
  .object({
    mustMention: z.array(z.string().min(1)).optional(),
    mustMentionAny: z.array(z.array(z.string().min(1)).min(1)).optional(),
    mustNotMention: z.array(z.string().min(1)).optional(),
    requiredHeadings: z.array(z.string().min(1)).optional(),
    shouldIncludeChinesePhrase: z.boolean().optional(),
    requiresActionSteps: z.boolean().optional(),
    requiresSourcesWhenRagEnabled: z.boolean().optional(),
    maxWords: z.number().int().positive().optional(),
  })
  .refine(
    (value) =>
      Object.values(value).some((item) =>
        Array.isArray(item) ? item.length > 0 : item !== undefined,
      ),
    "expected must define at least one check",
  );

export const harnessCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  profile: promptProfileSchema,
  language: z.enum(["en", "zh"]),
  question: z.string().min(3),
  history: z.array(historyMessageSchema).optional(),
  metadata: z
    .object({
      promptProfile: promptProfileSchema.optional(),
      sourceQuestionId: z.string().min(1).optional(),
      sourceSubQuestionId: z.string().min(1).optional(),
    })
    .optional(),
  expected: expectedSchema,
  riskTags: z.array(z.string().min(1)).min(1),
});

export const harnessCaseFileSchema = z.array(harnessCaseSchema).min(1);
export const smokeCaseIdsSchema = z.array(z.string().min(1)).min(1);
