# ChinaTrip AI Database Design

## Strategy

Local development uses Docker PostgreSQL. Production uses Supabase PostgreSQL. Prisma is the data access and migration layer.

Phase 3 adds a RAG knowledge base on top of the existing chat schema:

```text
Project seed files
→ Ingestion script
→ Doubao Embedding
→ knowledge_documents / knowledge_chunks
→ pgvector retrieval
→ AI answer with sources
```

The database remains the source of truth for chats, messages, sharing, AI usage logs, and imported knowledge.

## Extensions

Phase 3 requires pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Supabase production databases must enable the `vector` extension through a migration. Local development should use a pgvector-enabled PostgreSQL image, such as `pgvector/pgvector:pg16`.

## Core Tables

### profiles

Stores business profile information for Supabase Auth users.

```text
id
user_id
email
name
avatar_url
locale
created_at
updated_at
```

Rules:

- `user_id` stores the Supabase Auth user id and must be unique.
- `email` may be nullable, but should be unique when present.
- `locale` defaults to `en`.
- Future user preferences can be added here without changing chat ownership.

### anonymous_sessions

Tracks anonymous browser sessions for logged-out users.

```text
id
anonymous_id
user_agent
created_at
last_active_at
```

Rules:

- `anonymous_id` is stored in a browser cookie and must be unique.
- Anonymous users can create chats, send messages, copy answers, and share answers.
- Anonymous records are preserved to support future guest-to-user migration.

### chats

Stores chat sessions.

```text
id
profile_id
anonymous_session_id
title
language
status
created_at
updated_at
last_message_at
```

Rules:

- `language` is `en` or `zh`.
- `status` is `active`, `archived`, or `deleted`.
- A chat should have either `profile_id` or `anonymous_session_id` when created.
- After a guest logs in, a chat may keep `anonymous_session_id` and also receive `profile_id`.
- `title` is generated from the first user question.
- Chat history is sorted by `last_message_at desc`.

### messages

Stores chat messages.

```text
id
chat_id
role
status
sequence
content
error_code
error_message
metadata
created_at
updated_at
```

Rules:

- `role` is `user`, `assistant`, or `system`; UI uses `user` and `assistant`.
- `status` is `pending`, `complete`, or `failed`.
- `sequence` is the stable display order within a chat.
- Messages are displayed by `sequence asc`, then `created_at asc`.
- AI generation may create a `pending` assistant message and update it to `complete`.
- `metadata` stores prompt profile, visuals, completion status, retrieval metadata, and sources.

Phase 3 assistant metadata may include:

```json
{
  "retrieval": {
    "enabled": true,
    "matchedChunkCount": 3,
    "matches": [
      {
        "chunkId": "...",
        "documentId": "...",
        "title": "...",
        "heading": "...",
        "category": "payment_survival",
        "score": 0.82,
        "updatedAt": "2026-06-01"
      }
    ]
  },
  "sources": [
    {
      "id": "...",
      "title": "Payment Survival Basics",
      "category": "payment_survival",
      "updatedAt": "2026-06-01"
    }
  ]
}
```

### shared_answers

Stores a public shareable snapshot of one question-answer pair.

```text
id
chat_id
user_message_id
assistant_message_id
profile_id
anonymous_session_id
share_slug
question
answer
is_public
view_count
created_at
updated_at
revoked_at
```

Rules:

- Share does not require login.
- `profile_id` is nullable for anonymous sharing.
- `anonymous_session_id` is nullable for logged-in sharing.
- `share_slug` must be unique and is the public URL identifier.
- The share page reads only `question` and `answer` snapshots, not the full chat.
- Reuse an existing share record for the same assistant message when possible.
- Phase 3 source display can be rebuilt from the assistant message metadata or snapshotted later if share immutability requires it.

### ai_usage_logs

Stores AI request usage, cost, fallback, and failure metadata.

```text
id
chat_id
message_id
provider
model
prompt_version
input_tokens
output_tokens
cost_estimate
latency_ms
success
fallback_used
error_message
metadata
created_at
```

Rules:

- `provider` is `mock`, `doubao`, or `deepseek`.
- `message_id` usually points to the assistant message and may be nullable for failed requests.
- Successful and failed AI requests should both be logged when possible.
- `metadata` may store prompt profile, retrieval status, hit count, embedding provider/model, retrieval latency, and source ids.

### answer_feedback

Stores one private quality reaction per completed assistant answer and viewer.

```text
id
assistant_message_id
profile_id
anonymous_session_id
reaction
reason
comment
created_at
updated_at
```

Rules:

- Exactly one of `profile_id` and `anonymous_session_id` must be present.
- The same signed-in profile or anonymous session can submit only one immutable feedback record for one assistant message.
- Identical retries are idempotent; attempts to change a submitted reaction, reason, or comment are rejected by the API.
- `reaction` is `up` or `down`; a negative reason and comment are optional, and comments are limited to 500 characters by the API.
- Feedback is private quality data. It is not copied to public shares or injected into AI/RAG prompts.
- Deleting the assistant message cascades to its feedback records.

## RAG Tables

### knowledge_documents

Stores knowledge document metadata imported from project seed files.

```text
id
slug
title
language
category
source_type
trust_level
status
updated_at_source
created_at
updated_at
```

Rules:

- `slug` corresponds to the seed file `id` and must be unique.
- `language` uses the existing `Language` enum: `en` or `zh`.
- `category` corresponds to a Prompt Profile such as `payment_survival`.
- `source_type` is `internal_seed` in Phase 3.
- `trust_level` is `product_curated` in Phase 3.
- `status` supports `active` and `archived`.
- `updated_at_source` comes from the seed file `updatedAt`.

### knowledge_chunks

Stores searchable knowledge chunks and embedding vectors.

```text
id
document_id
chunk_index
heading
content
content_hash
language
category
tags
embedding
created_at
updated_at
```

Rules:

- `document_id` references `knowledge_documents.id`.
- `chunk_index` is the stable order inside a document.
- One section creates one chunk by default.
- `content_hash` is used to detect changed content during ingestion.
- `tags` uses JSON.
- `embedding` uses `vector(2048)`.
- Prisma should represent `embedding` with `Unsupported("vector(2048)")`.
- `(document_id, chunk_index)` must be unique.

### knowledge_ingestion_runs

Stores knowledge import batches.

```text
id
status
started_at
finished_at
documents_seen
chunks_seen
chunks_created
chunks_updated
chunks_skipped
error_message
metadata
```

Rules:

- Dry-run does not write an ingestion run.
- Every real import writes one run.
- `status` supports `running`, `success`, and `failed`.
- `metadata` records embedding provider, model, dimensions, seed directory, and error details.

## Indexes

Recommended indexes:

```text
profiles.user_id unique
profiles.email unique where not null
anonymous_sessions.anonymous_id unique
chats.profile_id + last_message_at
chats.anonymous_session_id + last_message_at
messages.chat_id + sequence unique
shared_answers.share_slug unique
shared_answers.assistant_message_id
ai_usage_logs.chat_id + created_at
ai_usage_logs.message_id
knowledge_documents.slug unique
knowledge_documents.language + category + status
knowledge_chunks.document_id + chunk_index unique
knowledge_chunks.document_id
knowledge_chunks.language + category
knowledge_chunks.content_hash
knowledge_ingestion_runs.started_at
```

Vector index guidance:

- MVP data volume can start with exact pgvector search.
- Add `ivfflat` or `hnsw` only after enough data exists to benchmark.
- Do not tune vector index parameters before measuring recall and latency on real seed data.

## Deferred Tables

### saved_answers

`saved_answers` is not part of the current schema.

Add `saved_answers` later only when the product includes saved answer retrieval or management.

## Naming Rules

- Database tables use plural snake_case.
- Database columns use snake_case.
- TypeScript types use PascalCase.
- API response fields use camelCase.
- Preserve `anonymous_id` to enable future guest-to-user migration.
