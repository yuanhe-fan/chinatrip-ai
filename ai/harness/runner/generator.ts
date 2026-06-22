import { randomUUID } from "node:crypto";
import type { GenerateTravelAnswerResult } from "../../../lib/ai/types";
import { isPromptProfile } from "../../../lib/quick-questions/profiles";
import type {
  HarnessCase,
  HarnessGenerationResult,
} from "./types";

const DEFAULT_CASE_TIMEOUT_MS = 90_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readPromptProfile(value: unknown) {
  return isPromptProfile(value) ? value : null;
}

export async function generateForHarness(
  testCase: HarnessCase,
  options: { timeoutMs?: number } = {},
): Promise<HarnessGenerationResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_CASE_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const [{ streamTravelAnswer }, { mergeCompletionStatusMetadata }] =
      await Promise.all([
        import("../../../lib/ai/index"),
        import("../../../lib/ai/completion-status"),
      ]);
    let streamedContent = "";
    let doneResult: GenerateTravelAnswerResult | null = null;

    for await (const chunk of streamTravelAnswer({
      chatId: randomUUID(),
      userMessage: testCase.question,
      language: testCase.language,
      history: testCase.history,
      metadata: {
        ...testCase.metadata,
        promptProfile: testCase.profile,
        harnessCaseId: testCase.id,
      },
      signal: controller.signal,
    })) {
      if (chunk.type === "delta") {
        streamedContent += chunk.content;
      } else {
        doneResult = chunk.result;
      }
    }

    if (!doneResult) {
      throw new Error("AI provider did not return a done result.");
    }

    const content = doneResult.content || streamedContent;
    const completionMetadata = mergeCompletionStatusMetadata(
      doneResult.metadata,
      content,
    );
    const metadata: Record<string, unknown> = isRecord(completionMetadata)
      ? completionMetadata
      : {};
    const retrieval = isRecord(metadata.retrieval) ? metadata.retrieval : {};
    const rawSources = Array.isArray(metadata.sources) ? metadata.sources : [];
    const sources = rawSources
      .filter(
        (source: unknown): source is {
          id: string;
          title: string;
          category: string;
          updatedAt: string | null;
        } =>
          isRecord(source) &&
          typeof source.id === "string" &&
          typeof source.title === "string" &&
          typeof source.category === "string" &&
          (typeof source.updatedAt === "string" || source.updatedAt === null),
      )
      .slice(0, 10);

    return {
      content,
      provider: doneResult.provider,
      model: doneResult.model,
      promptVersion: doneResult.promptVersion,
      promptProfile: readPromptProfile(metadata.promptProfile),
      inputTokens: doneResult.inputTokens,
      outputTokens: doneResult.outputTokens,
      latencyMs: doneResult.latencyMs,
      fallbackUsed: doneResult.fallbackUsed,
      finishReason: readString(metadata.finishReason) ?? null,
      truncated: metadata.truncated === true,
      maybeTruncated: metadata.maybeTruncated === true,
      retrieval: {
        enabled: retrieval.enabled === true,
        matchedChunkCount: readNumber(retrieval.matchedChunkCount) ?? 0,
        failedReason: readString(retrieval.failedReason),
      },
      sources,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Harness case timed out after ${timeoutMs}ms.`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
