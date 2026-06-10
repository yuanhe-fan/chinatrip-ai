import "server-only";

export {
  EmbeddingConfigError,
  EmbeddingRequestError,
  getEmbeddingConfigFromEnv,
  requestTextEmbedding,
} from "./embedding-client.mjs";
export type { EmbeddingConfig, EmbeddingResult } from "./embedding-client.mjs";
