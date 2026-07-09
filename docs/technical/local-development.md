# ChinaTrip AI Local Development

## Current Phase

Current phase:

```text
Phase 5 dynamic trip clarification release hardening
```

Implemented core loop:

```text
Home question
→ Chat page
→ Streaming AI answer
→ Follow-up question
→ Copy or Share answer
→ Public share page
→ New user asks from share page
```

Phases 3-5 add:

```text
Knowledge seed files
→ Ingestion script
→ Doubao Embedding
→ Supabase PostgreSQL + pgvector
→ RAG retrieval
→ DeepSeek answer generation
→ Sources display
→ Dynamic trip clarification
```

## Requirements

```text
Node.js 22+
pnpm
Docker
PostgreSQL with pgvector
Supabase project with Google Auth enabled
DeepSeek API key
Doubao / Volcengine Ark Embedding API key
```

## Install

```bash
pnpm install
```

## Environment

Create `.env.local` and provide the project values:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

AI_PROVIDER="deepseek"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
AI_TEMPERATURE="0.2"
AI_MAX_OUTPUT_TOKENS="2000"

EMBEDDING_PROVIDER="doubao"
EMBEDDING_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
EMBEDDING_API_KEY=""
EMBEDDING_MODEL="doubao-embedding-text-240515"
EMBEDDING_DIMENSIONS="2048"

UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

Production must set `NEXT_PUBLIC_SITE_URL` to the real HTTPS domain so metadata, canonical URLs, robots, sitemap, and share links do not use localhost.

## Auth Configuration

Supabase Auth must enable Google as a provider.

Local redirect URL:

```text
http://localhost:3000/auth/callback
```

Production redirect URL:

```text
https://your-domain.com/auth/callback
```

Google OAuth consent screen should use the public product name `ChinaTrip AI`.

## Local PostgreSQL with pgvector

Phase 3 local development should use a pgvector-enabled PostgreSQL image.

Recommended Docker service:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: chinatrip-ai-postgres
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: chinatrip
      POSTGRES_PASSWORD: chinatrip
      POSTGRES_DB: chinatrip_dev
```

Start PostgreSQL:

```bash
docker compose up -d
```

Confirm PostgreSQL is running:

```bash
docker compose ps
```

If `POST /api/chats` returns `503 DATABASE_UNAVAILABLE`, first check that `.env.local` points to the same port as `docker-compose.yml`. The default local URL is:

```env
DATABASE_URL="postgresql://chinatrip:chinatrip@localhost:5433/chinatrip_dev"
```

Then start the database and rerun migrations if needed:

```bash
docker compose up -d
pnpm prisma:migrate
```

Stop PostgreSQL:

```bash
docker compose down
```

Remove local database volume:

```bash
docker compose down -v
```

## Prisma

Generate Prisma client:

```bash
pnpm prisma:generate
```

Validate schema:

```bash
pnpm exec prisma validate
```

Run migrations:

```bash
pnpm prisma:migrate
```

Phase 3 migration must enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Before production deploy, confirm all migrations have been applied to the Supabase database.

## Knowledge Seed Files

Knowledge seed files live under:

```text
ai/knowledge/seed/
```

First seed files:

```text
payment-survival.json
internet-apps.json
transport-workflow.json
tickets-booking.json
language-cards.json
emergency-help.json
```

Seed files use this shape:

```ts
type KnowledgeSeedDocument = {
  id: string;
  title: string;
  language: "en" | "zh";
  category:
    | "payment_survival"
    | "internet_apps"
    | "transport_workflow"
    | "tickets_booking"
    | "language_cards"
    | "emergency_help"
    | "general_travel";
  sourceType: "internal_seed";
  trustLevel: "product_curated";
  updatedAt: string;
  summary: string;
  sections: Array<{
    id: string;
    heading: string;
    tags: string[];
    content: string;
  }>;
};
```

## Knowledge Ingestion

Knowledge ingestion is script-based and does not use a public HTTP API.

Script path:

```text
scripts/ingest-knowledge.mjs
```

Package scripts:

```json
{
  "knowledge:ingest:dry-run": "node scripts/ingest-knowledge.mjs --dry-run",
  "knowledge:ingest": "node scripts/ingest-knowledge.mjs"
}
```

Dry-run:

```bash
pnpm knowledge:ingest:dry-run
```

Dry-run behavior:

- Reads `ai/knowledge/seed/*.json`.
- Validates seed structure with zod.
- Creates planned section-level chunks.
- Prints `documentsSeen`, `sectionsSeen`, `chunksPlanned`, `invalidFiles`, `categories`, and `estimatedEmbeddingCalls`.
- Does not call Doubao Embedding.
- Does not write to the database.

Real import:

```bash
pnpm knowledge:ingest
```

Real import behavior:

- Reads and validates seed files.
- Creates one chunk per section by default.
- Builds embedding input from title, category, summary, heading, tags, and content.
- Generates `content_hash`.
- Skips embedding when `content_hash` is unchanged.
- Calls Doubao Embedding for new or changed chunks.
- Upserts `knowledge_documents`.
- Upserts `knowledge_chunks`.
- Writes one `knowledge_ingestion_runs` row with success or failure state.

Embedding input format:

```text
Title: {document.title}
Category: {document.category}
Summary: {document.summary}
Heading: {section.heading}
Tags: {section.tags.join(", ")}

{section.content}
```

## RAG Local Verification Flow

Use this sequence to validate RAG locally:

```text
Configure DATABASE_URL
Configure DeepSeek env
Configure Doubao Embedding env
Start pgvector PostgreSQL
Run Prisma migration
Run knowledge dry-run
Run knowledge ingest
Start dev server
Ask test questions and verify sources
```

Commands:

```bash
docker compose up -d
pnpm prisma:migrate
pnpm knowledge:ingest:dry-run
pnpm knowledge:ingest
pnpm dev
```

Test questions:

```text
What should I do if Alipay does not work after I arrive in China?
How can I take a taxi or Didi if I cannot speak Chinese?
Do foreign visitors need passport information to book attraction tickets in China?
```

Expected behavior:

- Payment questions retrieve `payment_survival` chunks.
- Transport questions retrieve `transport_workflow` chunks.
- Ticket questions retrieve `tickets_booking` chunks.
- Assistant messages include `sources` when retrieved knowledge was used.
- If Doubao Embedding fails, the app still returns a normal DeepSeek answer without sources.

## Development Server

```bash
pnpm dev
```

The app runs at:

```text
http://localhost:3000
```

## Verification

Run before release handoff:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm run build
```

If `pnpm run build` fails in a sandbox with a Turbopack port binding error, rerun it in a normal local shell.

## Common Issues

If Prisma cannot connect, check:

- Docker container or Supabase database is reachable.
- `.env.local` has the correct `DATABASE_URL`.
- Prisma migrations have been applied.
- Local Docker image supports pgvector.

If RAG returns no sources, check:

- `EMBEDDING_PROVIDER`, `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, and `EMBEDDING_DIMENSIONS`.
- `knowledge_documents` contains active documents.
- `knowledge_chunks` contains embeddings.
- The question maps to a prompt profile with matching knowledge category.

If AI generation fails with `AI_QUOTA_EXHAUSTED`, the configured DeepSeek usage limit has been reached; the UI should show the dedicated usage exhausted card.
