-- EnableExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "KnowledgeIngestionStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'internal_seed',
    "trust_level" TEXT NOT NULL DEFAULT 'product_curated',
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'active',
    "updated_at_source" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL,
    "tags" JSONB,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_ingestion_runs" (
    "id" UUID NOT NULL,
    "status" "KnowledgeIngestionStatus" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "documents_seen" INTEGER NOT NULL DEFAULT 0,
    "chunks_seen" INTEGER NOT NULL DEFAULT 0,
    "chunks_created" INTEGER NOT NULL DEFAULT 0,
    "chunks_updated" INTEGER NOT NULL DEFAULT 0,
    "chunks_skipped" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "knowledge_ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_slug_key" ON "knowledge_documents"("slug");

-- CreateIndex
CREATE INDEX "knowledge_documents_language_category_status_idx" ON "knowledge_documents"("language", "category", "status");

-- CreateIndex
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_language_category_idx" ON "knowledge_chunks"("language", "category");

-- CreateIndex
CREATE INDEX "knowledge_chunks_content_hash_idx" ON "knowledge_chunks"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_document_id_chunk_index_key" ON "knowledge_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_runs_started_at_idx" ON "knowledge_ingestion_runs"("started_at");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
