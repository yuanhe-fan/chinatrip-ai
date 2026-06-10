import "server-only";

import { getConfiguredProvider } from "./config";
import { selectAnswerVisuals } from "@/lib/answer-assets/visuals";
import {
  buildKnowledgeContext,
  createRetrievalMetadata,
  retrieveTravelKnowledge,
} from "./rag";
import {
  TRAVEL_ANSWER_PROMPT_VERSION,
  buildTravelAnswerMessages,
  resolveTravelPromptProfile,
} from "./prompts/travel-answer";
import { deepseekProvider } from "./providers/deepseek";
import { doubaoProvider } from "./providers/doubao";
import { mockProvider } from "./providers/mock";
import type {
  AiProvider,
  AiProviderAdapter,
  GenerateTravelAnswerInput,
  GenerateTravelAnswerResult,
  StreamTravelAnswerChunk,
} from "./types";

const PROVIDERS: Record<AiProvider, AiProviderAdapter> = {
  mock: mockProvider,
  doubao: doubaoProvider,
  deepseek: deepseekProvider,
};

export async function generateTravelAnswer(
  input: GenerateTravelAnswerInput,
): Promise<GenerateTravelAnswerResult> {
  const language = input.language ?? "en";
  const providerName = getConfiguredProvider();
  const provider = PROVIDERS[providerName];
  const promptProfile = resolveTravelPromptProfile(input);
  const retrieval = await retrieveTravelKnowledge({
    query: input.userMessage,
    language,
    promptProfile,
  });
  const retrievalMetadata = createRetrievalMetadata(retrieval);
  const knowledgeContext = buildKnowledgeContext(retrieval);

  const result = await provider.generateAnswer({
    chatId: input.chatId,
    language,
    messages: buildTravelAnswerMessages({
      ...input,
      language,
      metadata: {
        ...input.metadata,
        provider: providerName,
      },
      knowledgeContext,
    }),
    promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
  });

  return {
    ...result,
    metadata: {
      ...(typeof result.metadata === "object" && result.metadata !== null
        ? result.metadata
        : {}),
      promptProfile,
      visuals: selectAnswerVisuals({
        profile: promptProfile,
        question: input.userMessage,
        answer: result.content,
      }),
      ...retrievalMetadata,
    },
  };
}

export async function* streamTravelAnswer(
  input: GenerateTravelAnswerInput & { signal?: AbortSignal },
): AsyncGenerator<StreamTravelAnswerChunk> {
  const language = input.language ?? "en";
  const providerName = getConfiguredProvider();
  const provider = PROVIDERS[providerName];
  const promptProfile = resolveTravelPromptProfile(input);
  const retrieval = await retrieveTravelKnowledge({
    query: input.userMessage,
    language,
    promptProfile,
    signal: input.signal,
  });
  const retrievalMetadata = createRetrievalMetadata(retrieval);
  const knowledgeContext = buildKnowledgeContext(retrieval);
  const request = {
    chatId: input.chatId,
    language,
    messages: buildTravelAnswerMessages({
      ...input,
      language,
      metadata: {
        ...input.metadata,
        provider: providerName,
      },
      knowledgeContext,
    }),
    promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
    signal: input.signal,
  };

  if (provider.streamAnswer) {
    for await (const chunk of provider.streamAnswer(request)) {
      if (chunk.type === "done") {
        yield {
          ...chunk,
          result: {
            ...chunk.result,
            metadata: {
              ...(typeof chunk.result.metadata === "object" &&
              chunk.result.metadata !== null
                ? chunk.result.metadata
                : {}),
              promptProfile,
              visuals: selectAnswerVisuals({
                profile: promptProfile,
                question: input.userMessage,
                answer: chunk.result.content,
              }),
              ...retrievalMetadata,
            },
          },
        };
        continue;
      }

      yield chunk;
    }
    return;
  }

  const rawResult = await provider.generateAnswer(request);
  const result: GenerateTravelAnswerResult = {
    ...rawResult,
    metadata: {
      ...(typeof rawResult.metadata === "object" && rawResult.metadata !== null
        ? rawResult.metadata
        : {}),
      promptProfile,
      visuals: selectAnswerVisuals({
        profile: promptProfile,
        question: input.userMessage,
        answer: rawResult.content,
      }),
      ...retrievalMetadata,
    },
  };

  if (result.content) {
    yield {
      type: "delta",
      content: result.content,
    };
  }

  yield {
    type: "done",
    result,
  };
}

export type {
  AiProvider,
  AiProviderAdapter,
  GenerateTravelAnswerInput,
  GenerateTravelAnswerResult,
  StreamTravelAnswerChunk,
  TravelAnswerLanguage,
  TravelAnswerMessage,
} from "./types";
export { AiProviderConfigError, AiProviderError } from "./errors";
