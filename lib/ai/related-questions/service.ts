import "server-only";

import { z } from "zod";
import { getConfiguredProvider } from "../config";
import { deepseekProvider } from "../providers/deepseek";
import { doubaoProvider } from "../providers/doubao";
import { mockProvider } from "../providers/mock";
import type { AiProvider, AiProviderAdapter, TravelAnswerLanguage } from "../types";
import type { PromptProfile } from "@/lib/quick-questions/profiles";

const RELATED_QUESTIONS_PROMPT_VERSION = "related-questions-v1";
const questionSchema = z.string().trim().min(3).max(160);
const responseSchema = z.object({ questions: z.array(questionSchema).min(1).max(3) });

const PROVIDERS: Record<AiProvider, AiProviderAdapter> = {
  mock: mockProvider,
  doubao: doubaoProvider,
  deepseek: deepseekProvider,
};

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Related questions did not contain JSON.");
  }

  return candidate.slice(start, end + 1);
}

function normalizeQuestions(value: unknown, sourceQuestion: string) {
  const parsed = responseSchema.safeParse(value);

  if (!parsed.success) {
    return [];
  }

  const original = sourceQuestion.trim().toLocaleLowerCase();
  const seen = new Set<string>();

  return parsed.data.questions.filter((question) => {
    const normalized = question.toLocaleLowerCase();

    if (normalized === original || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

export function parseRelatedQuestionsContent(
  content: string,
  sourceQuestion: string,
) {
  return normalizeQuestions(
    JSON.parse(extractJsonObject(content)) as unknown,
    sourceQuestion,
  );
}

function createMockQuestions(language: TravelAnswerLanguage) {
  return language === "zh"
    ? ["从机场到市区最方便的方式是什么？", "哪些项目需要提前预约？"]
    : [
        "What is the easiest way to get there from the airport?",
        "What should I reserve in advance?",
      ];
}

export async function generateRelatedQuestions(input: {
  chatId: string;
  language: TravelAnswerLanguage;
  sourceQuestion: string;
  answer: string;
  promptProfile?: PromptProfile;
  signal?: AbortSignal;
}) {
  const providerName = getConfiguredProvider();

  if (providerName === "mock") {
    return createMockQuestions(input.language);
  }

  try {
    const result = await PROVIDERS[providerName].generateAnswer({
      chatId: input.chatId,
      language: input.language,
      promptVersion: RELATED_QUESTIONS_PROMPT_VERSION,
      signal: input.signal,
      messages: [
        {
          role: "system",
          content: [
            "Return JSON only: {\"questions\":[string] }.",
            "Generate one to three short, specific follow-up travel questions.",
            "Questions must be directly useful after the supplied answer, must not repeat the original question, and must not introduce unsupported facts.",
            "Do not ask generic questions such as 'Anything else?'.",
            `Write the questions in ${input.language === "zh" ? "Chinese" : "English"}.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Original question:\n${input.sourceQuestion}`,
            `Answer:\n${input.answer}`,
            input.promptProfile ? `Prompt profile: ${input.promptProfile}` : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    return parseRelatedQuestionsContent(result.content, input.sourceQuestion);
  } catch (error) {
    console.warn("related_questions_generation_failed", {
      chatId: input.chatId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
