import "server-only";

import { Prisma } from "@prisma/client";
import { requestTextEmbedding } from "@/lib/ai/embedding";
import { prisma } from "@/lib/prisma";
import type { AnswerSource } from "@/lib/api/types";
import type { PromptProfile } from "@/lib/quick-questions/profiles";

const DEFAULT_RETRIEVAL_LIMIT = 5;
const KNOWLEDGE_LANGUAGE = "en";

export type RetrievalMatch = {
  chunkId: string;
  documentId: string;
  title: string;
  heading: string | null;
  category: string;
  content: string;
  score: number;
  updatedAt: string | null;
};

export type RetrievalResult = {
  enabled: boolean;
  matches: RetrievalMatch[];
  sources: AnswerSource[];
  failedReason?: string;
};

type RetrievalRow = {
  chunk_id: string;
  document_id: string;
  title: string;
  heading: string | null;
  category: string;
  content: string;
  distance: number;
  updated_at: Date | string | null;
};

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function toIsoDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function createEmptyRetrieval(failedReason?: string): RetrievalResult {
  return {
    enabled: false,
    matches: [],
    sources: [],
    failedReason,
  };
}

function createSources(matches: RetrievalMatch[]): AnswerSource[] {
  const sources = new Map<string, AnswerSource>();

  for (const match of matches) {
    if (sources.has(match.documentId)) {
      continue;
    }

    sources.set(match.documentId, {
      id: match.documentId,
      title: match.title,
      category: match.category,
      updatedAt: match.updatedAt,
    });
  }

  return Array.from(sources.values());
}

function normalizeRetrievalError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function retrieveTravelKnowledge(input: {
  query: string;
  language: "en" | "zh";
  promptProfile: PromptProfile;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RetrievalResult> {
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_RETRIEVAL_LIMIT, 10));

  try {
    const embeddingResult = await requestTextEmbedding({
      text: input.query,
      signal: input.signal,
    });
    const vectorLiteral = toVectorLiteral(embeddingResult.embedding);
    const categories = [input.promptProfile, "general_travel"];
    const rows = await prisma.$queryRaw<RetrievalRow[]>`
      SELECT
        kc.id AS chunk_id,
        kd.id AS document_id,
        kd.title AS title,
        kc.heading AS heading,
        kc.category AS category,
        kc.content AS content,
        kc.embedding <=> ${vectorLiteral}::vector AS distance,
        kd.updated_at_source AS updated_at
      FROM knowledge_chunks kc
      INNER JOIN knowledge_documents kd
        ON kd.id = kc.document_id
      WHERE kd.status = 'active'::"KnowledgeDocumentStatus"
        AND kc.language = ${KNOWLEDGE_LANGUAGE}::"Language"
        AND kd.language = ${KNOWLEDGE_LANGUAGE}::"Language"
        AND kc.category IN (${Prisma.join(categories)})
      ORDER BY
        CASE
          WHEN kc.category = ${input.promptProfile} THEN 0
          WHEN kc.category = 'general_travel' THEN 1
          ELSE 2
        END,
        distance ASC
      LIMIT ${limit}
    `;
    const matches = rows.map((row) => {
      const distance = Number(row.distance);

      return {
        chunkId: row.chunk_id,
        documentId: row.document_id,
        title: row.title,
        heading: row.heading,
        category: row.category,
        content: row.content,
        score: Number((1 - distance).toFixed(4)),
        updatedAt: toIsoDate(row.updated_at),
      };
    });

    return {
      enabled: matches.length > 0,
      matches,
      sources: createSources(matches),
    };
  } catch (error) {
    console.warn("rag_retrieval_failed", {
      promptProfile: input.promptProfile,
      language: input.language,
      reason: normalizeRetrievalError(error),
    });

    return createEmptyRetrieval(normalizeRetrievalError(error));
  }
}

export function buildKnowledgeContext(retrieval: RetrievalResult) {
  if (!retrieval.enabled || retrieval.matches.length === 0) {
    return null;
  }

  return [
    "Knowledge base context:",
    "Use this context when relevant to the traveler's question.",
    "Do not invent official policies, prices, opening hours, or links if they are not provided here.",
    "If the context is missing or not relevant, answer from general travel knowledge and remind the traveler to verify time-sensitive details.",
    "",
    ...retrieval.matches.map((match, index) =>
      [
        `[Source ${index + 1}]`,
        `Title: ${match.title}`,
        match.heading ? `Heading: ${match.heading}` : null,
        `Updated: ${match.updatedAt ?? "Unknown"}`,
        `Category: ${match.category}`,
        "Content:",
        match.content,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}

export function createRetrievalMetadata(retrieval: RetrievalResult) {
  if (!retrieval.enabled) {
    return {
      retrieval: {
        enabled: false,
        matchedChunkCount: 0,
        failedReason: retrieval.failedReason,
      },
      sources: [],
    };
  }

  return {
    retrieval: {
      enabled: true,
      matchedChunkCount: retrieval.matches.length,
      matches: retrieval.matches.map((match) => ({
        chunkId: match.chunkId,
        documentId: match.documentId,
        title: match.title,
        heading: match.heading,
        category: match.category,
        score: match.score,
        updatedAt: match.updatedAt,
      })),
    },
    sources: retrieval.sources,
  };
}
