# ChinaTrip AI Technical Stack

## Recommended Stack

```text
Next.js
React
TypeScript
Tailwind CSS
Supabase Auth
Docker PostgreSQL with pgvector
Supabase PostgreSQL with pgvector
Prisma
React Query
useState / Zustand
@tanstack/react-virtual
DeepSeek LLM
Doubao / Volcengine Ark Embedding
Upstash Redis
Vercel
```

## Stack Mapping

| Module | Technology | Reason / Scenario |
|---|---|---|
| Web app | Next.js | Home, chat, share page, API Route Handlers |
| UI | React | Inputs, message stream, modal, toast, sidebar, source display |
| Types | TypeScript | Chat, Message, SharedAnswer, RAG contracts |
| Styling | Tailwind CSS | Fast responsive UI implementation |
| Auth | Supabase Auth | Google login, logout, current user |
| Local DB | Docker PostgreSQL with pgvector | Local development, migrations, vector retrieval validation |
| Production DB | Supabase PostgreSQL with pgvector | Production persistence and vector search |
| ORM | Prisma | Schema, migrations, server queries |
| Vector search | pgvector | Store and search embedding vectors inside PostgreSQL |
| Server state | React Query | Chat, messages, history, share requests |
| UI state | useState / Zustand | Input, toast, language, sidebar, modal |
| Virtual list | @tanstack/react-virtual | Long chat message performance |
| Answer LLM | DeepSeek | Primary natural-language answer generation |
| Embedding service | Doubao / Volcengine Ark | Convert seed knowledge and user questions into vectors |
| Cache | Upstash Redis | Serverless-friendly cache for selected high-frequency reads |
| Deployment | Vercel | Next.js production hosting |

## Model Strategy

Phase 3 separates answer generation from embedding generation.

Answer generation:

```env
AI_PROVIDER="deepseek"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
```

Embedding:

```env
EMBEDDING_PROVIDER="doubao"
EMBEDDING_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
EMBEDDING_API_KEY=""
EMBEDDING_MODEL="doubao-embedding-text-240515"
EMBEDDING_DIMENSIONS="2048"
```

Responsibilities:

- DeepSeek generates the final visible answer.
- Doubao Embedding converts seed knowledge and user questions into vectors.
- pgvector performs semantic similarity retrieval inside PostgreSQL.
- RAG service handles retrieval, filtering, source shaping, and Knowledge Context construction.
- Prompt builders receive retrieval context; they must not query the database directly.

## Selection Notes

### Next.js + React + TypeScript

Next.js supports the page structure and server-side API needs. React handles interactive chat UI. TypeScript keeps core product objects explicit and easier to refactor.

### Tailwind CSS

Tailwind is used for a fast, controlled, responsive implementation. Do not introduce a heavy UI framework unless a concrete need appears.

### Supabase Auth

Supabase Auth handles Google OAuth and session management. The project should not self-implement JWT auth.

### PostgreSQL + Prisma + pgvector

PostgreSQL stores chats, messages, shared answers, AI usage logs, and Phase 3 knowledge base data. Prisma provides schema management and typed access for ordinary relational data.

Phase 3 adds pgvector so PostgreSQL can store embedding vectors and perform similarity search. Prisma should represent vector columns with `Unsupported("vector(2048)")`, and vector queries should use raw SQL where necessary.

Local development should use a pgvector-enabled PostgreSQL Docker image. Production uses Supabase PostgreSQL with the `vector` extension enabled.

### DeepSeek

DeepSeek is the baseline answer-generation model for Phase 3. The RAG implementation should continue using the existing AI Provider Service path for normal and streaming answers.

### Doubao / Volcengine Ark Embedding

Doubao / Volcengine Ark provides the embedding service for RAG. The embedding client should be independent from `AI_PROVIDER` so answer model and embedding model can be changed separately.

Doubao Embedding request shape:

```text
POST {EMBEDDING_BASE_URL}/embeddings
Authorization: Bearer {EMBEDDING_API_KEY}
Content-Type: application/json

{
  "model": "{EMBEDDING_MODEL}",
  "input": ["..."]
}
```

Internal embedding contract:

```ts
type EmbeddingResult = {
  embedding: number[];
  model: string;
  dimensions: number;
};

async function embedText(input: {
  text: string;
  signal?: AbortSignal;
}): Promise<EmbeddingResult>;
```

### Upstash Redis

Upstash Redis is used only as an optional cache layer. Redis must not block chat creation, message generation, sharing, or RAG retrieval.

### RAG Knowledge Ingestion

Phase 3 knowledge ingestion is script-based, not HTTP API based.

Recommended script commands:

```json
{
  "knowledge:ingest:dry-run": "node scripts/ingest-knowledge.mjs --dry-run",
  "knowledge:ingest": "node scripts/ingest-knowledge.mjs"
}
```

The script reads project seed files from:

```text
ai/knowledge/seed/
```

It validates seed JSON, creates section-level chunks, generates content hashes, calls Doubao Embedding for changed chunks, and writes `knowledge_documents`, `knowledge_chunks`, and `knowledge_ingestion_runs`.
