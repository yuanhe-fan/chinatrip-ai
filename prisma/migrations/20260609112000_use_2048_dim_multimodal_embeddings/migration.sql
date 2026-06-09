-- Align knowledge embeddings with the Doubao multimodal embedding endpoint.
-- The ingestion pipeline has not successfully populated chunks yet, so dropping
-- partial chunk rows avoids unsafe vector dimension casts.
TRUNCATE TABLE "knowledge_chunks";

ALTER TABLE "knowledge_chunks"
  ALTER COLUMN "embedding" TYPE vector(2048);
