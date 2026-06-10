const DEFAULT_TIMEOUT_MS = 30_000;

export class EmbeddingConfigError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "EmbeddingConfigError";
    this.details = details;
  }
}

export class EmbeddingRequestError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "EmbeddingRequestError";
    this.details = details;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new EmbeddingConfigError(`Missing required environment variable: ${name}`, {
      missing: [name],
    });
  }

  return value;
}

export function getEmbeddingConfigFromEnv() {
  const dimensions = Number(requireEnv("EMBEDDING_DIMENSIONS"));
  const baseUrl = requireEnv("EMBEDDING_BASE_URL").replace(/\/+$/, "");
  const model = requireEnv("EMBEDDING_MODEL");

  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new EmbeddingConfigError("EMBEDDING_DIMENSIONS must be a positive integer.");
  }

  return {
    provider: process.env.EMBEDDING_PROVIDER?.trim() || "doubao",
    baseUrl,
    apiKey: requireEnv("EMBEDDING_API_KEY"),
    model,
    dimensions,
  };
}

export function createEmbeddingsUrl(baseUrl) {
  if (baseUrl.endsWith("/embeddings/multimodal")) {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/embeddings$/, "")}/embeddings/multimodal`;
}

export async function requestTextEmbedding(input) {
  const {
    text,
    config = getEmbeddingConfigFromEnv(),
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = input;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    const response = await fetch(createEmbeddingsUrl(config.baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        encoding_format: "float",
        input: [
          {
            type: "text",
            text,
          },
        ],
      }),
    }).catch((error) => {
      if (error?.name === "AbortError") {
        throw new EmbeddingRequestError(
          `Embedding API request timed out after ${timeoutMs}ms.`,
        );
      }

      throw error;
    });

    const rawText = await response.text();
    let payload;

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new EmbeddingRequestError(`Embedding API returned non-JSON response: ${rawText}`);
    }

    if (!response.ok) {
      throw new EmbeddingRequestError(
        `Embedding API request failed with ${response.status}: ${JSON.stringify(payload)}`,
        {
          status: response.status,
          payload,
        },
      );
    }

    const embedding = Array.isArray(payload?.data)
      ? payload.data[0]?.embedding
      : payload?.data?.embedding;

    if (
      !Array.isArray(embedding) ||
      !embedding.every((value) => typeof value === "number")
    ) {
      throw new EmbeddingRequestError(
        "Embedding API response did not include a numeric embedding array.",
      );
    }

    if (embedding.length !== config.dimensions) {
      throw new EmbeddingRequestError(
        `Embedding dimension mismatch: expected ${config.dimensions}, received ${embedding.length}.`,
        {
          expected: config.dimensions,
          received: embedding.length,
        },
      );
    }

    return {
      embedding,
      model: typeof payload.model === "string" ? payload.model : config.model,
      dimensions: embedding.length,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}
