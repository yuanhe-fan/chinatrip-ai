export type EmbeddingConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
};

export type EmbeddingResult = {
  embedding: number[];
  model: string;
  dimensions: number;
};

export class EmbeddingConfigError extends Error {
  details?: unknown;
}

export class EmbeddingRequestError extends Error {
  details?: unknown;
}

export function getEmbeddingConfigFromEnv(): EmbeddingConfig;

export function createEmbeddingsUrl(baseUrl: string): string;

export function requestTextEmbedding(input: {
  text: string;
  config?: EmbeddingConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<EmbeddingResult>;
