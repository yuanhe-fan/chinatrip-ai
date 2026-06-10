import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  getEmbeddingConfigFromEnv,
  requestTextEmbedding,
} from "../lib/ai/embedding-client.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const seedDir = path.join(repoRoot, "ai", "knowledge", "seed");
const isDryRun = process.argv.includes("--dry-run");

const supportedCategories = [
  "payment_survival",
  "internet_apps",
  "transport_workflow",
  "tickets_booking",
  "language_cards",
  "emergency_help",
  "general_travel",
];

const knowledgeSeedDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  language: z.enum(["en", "zh"]),
  category: z.enum(supportedCategories),
  sourceType: z.literal("internal_seed"),
  trustLevel: z.literal("product_curated"),
  updatedAt: z.string().min(1),
  summary: z.string().min(1),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        heading: z.string().min(1),
        tags: z.array(z.string().min(1)).default([]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

function loadEnvFile(filePath) {
  let raw;

  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripEnvQuotes(rawValue.trim());
  }
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadLocalEnv() {
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(repoRoot, ".env"));
}

function createEmbeddingInput(document, section) {
  return [
    `Title: ${document.title}`,
    `Category: ${document.category}`,
    `Summary: ${document.summary}`,
    `Heading: ${section.heading}`,
    `Tags: ${section.tags.join(", ")}`,
    "",
    section.content,
  ].join("\n");
}

function createContentHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseSourceDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid updatedAt date: ${value}`);
  }

  return date;
}

function printStats(label, stats) {
  console.log(label);
  console.log(`documentsSeen: ${stats.documentsSeen}`);
  console.log(`sectionsSeen: ${stats.sectionsSeen}`);
  console.log(`chunksPlanned: ${stats.chunksPlanned}`);
  console.log(`invalidFiles: ${stats.invalidFiles}`);
  console.log(`categories: ${Array.from(stats.categories).sort().join(", ") || "-"}`);
  console.log(`estimatedEmbeddingCalls: ${stats.estimatedEmbeddingCalls}`);
}

async function readSeedDocuments() {
  const entries = await readdir(seedDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const documents = [];
  const invalidFiles = [];

  for (const fileName of jsonFiles) {
    const filePath = path.join(seedDir, fileName);

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const document = knowledgeSeedDocumentSchema.parse(parsed);
      documents.push({
        fileName,
        filePath,
        document,
      });
    } catch (error) {
      invalidFiles.push({
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    documents,
    invalidFiles,
  };
}

function createPlannedChunks(documents) {
  return documents.flatMap(({ document, fileName }) =>
    document.sections.map((section, chunkIndex) => {
      const embeddingInput = createEmbeddingInput(document, section);

      return {
        fileName,
        document,
        section,
        chunkIndex,
        embeddingInput,
        contentHash: createContentHash(embeddingInput),
      };
    }),
  );
}

async function embedText(text, config, context) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestEmbedding(text, config);
    } catch (error) {
      lastError = error;
      const contextLabel = formatChunkContext(context);

      if (!isRetryableEmbeddingError(error) || attempt === maxAttempts) {
        if (contextLabel) {
          error.message = `${error.message} (${contextLabel})`;
        }
        throw error;
      }

      const delayMs = 500 * attempt;
      console.warn(
        `Embedding request failed${contextLabel ? ` for ${contextLabel}` : ""}, retrying in ${delayMs}ms (${attempt}/${maxAttempts}): ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

function isRetryableEmbeddingError(error) {
  return error instanceof Error && /\b(429|500|502|503|504)\b/.test(error.message);
}

function formatChunkContext(context) {
  if (!context) {
    return "";
  }

  return [
    `document=${context.documentId}`,
    `section=${context.sectionId}`,
    `chunkIndex=${context.chunkIndex}`,
  ].join(" ");
}

async function requestEmbedding(text, config) {
  return requestTextEmbedding({
    text,
    config,
  });
}

function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

async function upsertKnowledgeDocument(prisma, document) {
  const sourceDate = parseSourceDate(document.updatedAt);

  return prisma.knowledgeDocument.upsert({
    where: {
      slug: document.id,
    },
    create: {
      slug: document.id,
      title: document.title,
      language: document.language,
      category: document.category,
      sourceType: document.sourceType,
      trustLevel: document.trustLevel,
      status: "active",
      updatedAtSource: sourceDate,
    },
    update: {
      title: document.title,
      language: document.language,
      category: document.category,
      sourceType: document.sourceType,
      trustLevel: document.trustLevel,
      status: "active",
      updatedAtSource: sourceDate,
    },
    select: {
      id: true,
    },
  });
}

async function findExistingChunk(prisma, documentId, chunkIndex) {
  const rows = await prisma.$queryRaw`
    SELECT id, content_hash
    FROM knowledge_chunks
    WHERE document_id = ${documentId}::uuid
      AND chunk_index = ${chunkIndex}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function createKnowledgeChunk({
  prisma,
  documentId,
  plannedChunk,
  embedding,
}) {
  const chunkId = randomUUID();
  const vectorLiteral = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO knowledge_chunks (
      id,
      document_id,
      chunk_index,
      heading,
      content,
      content_hash,
      language,
      category,
      tags,
      embedding,
      created_at,
      updated_at
    )
    VALUES (
      ${chunkId}::uuid,
      ${documentId}::uuid,
      ${plannedChunk.chunkIndex},
      ${plannedChunk.section.heading},
      ${plannedChunk.section.content},
      ${plannedChunk.contentHash},
      ${plannedChunk.document.language}::"Language",
      ${plannedChunk.document.category},
      ${JSON.stringify(plannedChunk.section.tags)}::jsonb,
      ${vectorLiteral}::vector,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
}

async function updateKnowledgeChunk({
  prisma,
  chunkId,
  plannedChunk,
  embedding,
}) {
  const vectorLiteral = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    UPDATE knowledge_chunks
    SET
      heading = ${plannedChunk.section.heading},
      content = ${plannedChunk.section.content},
      content_hash = ${plannedChunk.contentHash},
      language = ${plannedChunk.document.language}::"Language",
      category = ${plannedChunk.document.category},
      tags = ${JSON.stringify(plannedChunk.section.tags)}::jsonb,
      embedding = ${vectorLiteral}::vector,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${chunkId}::uuid
  `;
}

async function runDryRun() {
  const { documents, invalidFiles } = await readSeedDocuments();
  const plannedChunks = createPlannedChunks(documents);
  const categories = new Set(documents.map(({ document }) => document.category));
  const stats = {
    documentsSeen: documents.length,
    sectionsSeen: plannedChunks.length,
    chunksPlanned: plannedChunks.length,
    invalidFiles: invalidFiles.length,
    categories,
    estimatedEmbeddingCalls: plannedChunks.length,
  };

  printStats("Knowledge ingest dry run", stats);

  if (invalidFiles.length > 0) {
    console.error("Invalid seed files:");
    for (const item of invalidFiles) {
      console.error(`- ${item.fileName}: ${item.error}`);
    }
    process.exitCode = 1;
  }
}

async function runIngest() {
  const { documents, invalidFiles } = await readSeedDocuments();

  if (invalidFiles.length > 0) {
    console.error("Invalid seed files:");
    for (const item of invalidFiles) {
      console.error(`- ${item.fileName}: ${item.error}`);
    }
    process.exit(1);
  }

  const plannedChunks = createPlannedChunks(documents);
  const embeddingConfig = getEmbeddingConfigFromEnv();
  const prisma = new PrismaClient();
  let runId;
  const counts = {
    documentsSeen: documents.length,
    chunksSeen: plannedChunks.length,
    chunksCreated: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
  };
  const metadata = {
    seedDirectory: path.relative(repoRoot, seedDir),
    embeddingProvider: embeddingConfig.provider,
    embeddingModel: embeddingConfig.model,
    embeddingDimensions: embeddingConfig.dimensions,
  };

  try {
    const run = await prisma.knowledgeIngestionRun.create({
      data: {
        status: "running",
        documentsSeen: counts.documentsSeen,
        chunksSeen: counts.chunksSeen,
        metadata,
      },
      select: {
        id: true,
      },
    });
    runId = run.id;

    const documentIds = new Map();

    for (const { document } of documents) {
      const persistedDocument = await upsertKnowledgeDocument(prisma, document);
      documentIds.set(document.id, persistedDocument.id);
    }

    for (const plannedChunk of plannedChunks) {
      const documentId = documentIds.get(plannedChunk.document.id);

      if (!documentId) {
        throw new Error(`Missing persisted document id for ${plannedChunk.document.id}.`);
      }

      const existingChunk = await findExistingChunk(
        prisma,
        documentId,
        plannedChunk.chunkIndex,
      );

      if (existingChunk?.content_hash === plannedChunk.contentHash) {
        counts.chunksSkipped += 1;
        continue;
      }

      const embeddingResult = await embedText(
        plannedChunk.embeddingInput,
        embeddingConfig,
        {
          documentId: plannedChunk.document.id,
          sectionId: plannedChunk.section.id,
          chunkIndex: plannedChunk.chunkIndex,
        },
      );

      if (existingChunk) {
        await updateKnowledgeChunk({
          prisma,
          chunkId: existingChunk.id,
          plannedChunk,
          embedding: embeddingResult.embedding,
        });
        counts.chunksUpdated += 1;
      } else {
        await createKnowledgeChunk({
          prisma,
          documentId,
          plannedChunk,
          embedding: embeddingResult.embedding,
        });
        counts.chunksCreated += 1;
      }
    }

    await prisma.knowledgeIngestionRun.update({
      where: {
        id: runId,
      },
      data: {
        status: "success",
        finishedAt: new Date(),
        documentsSeen: counts.documentsSeen,
        chunksSeen: counts.chunksSeen,
        chunksCreated: counts.chunksCreated,
        chunksUpdated: counts.chunksUpdated,
        chunksSkipped: counts.chunksSkipped,
        metadata,
      },
    });

    printStats("Knowledge ingest complete", {
      documentsSeen: counts.documentsSeen,
      sectionsSeen: counts.chunksSeen,
      chunksPlanned: counts.chunksSeen,
      invalidFiles: 0,
      categories: new Set(documents.map(({ document }) => document.category)),
      estimatedEmbeddingCalls: counts.chunksCreated + counts.chunksUpdated,
    });
    console.log(`chunksCreated: ${counts.chunksCreated}`);
    console.log(`chunksUpdated: ${counts.chunksUpdated}`);
    console.log(`chunksSkipped: ${counts.chunksSkipped}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (runId) {
      await prisma.knowledgeIngestionRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "failed",
          finishedAt: new Date(),
          documentsSeen: counts.documentsSeen,
          chunksSeen: counts.chunksSeen,
          chunksCreated: counts.chunksCreated,
          chunksUpdated: counts.chunksUpdated,
          chunksSkipped: counts.chunksSkipped,
          errorMessage: message,
          metadata: {
            ...metadata,
            error: message,
          },
        },
      });
    }

    console.error(`Knowledge ingest failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

loadLocalEnv();

if (isDryRun) {
  await runDryRun();
} else {
  await runIngest();
}
