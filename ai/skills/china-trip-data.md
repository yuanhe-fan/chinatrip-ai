# ChinaTrip Data Skill

## Applies To

- Prisma schema and migrations.
- Chat, Message, SharedAnswer, and AiUsageLog data.
- Knowledge documents, chunks, and ingestion runs.
- AI answer and retrieval metadata.

## Current Data Areas

```text
profiles
anonymous_sessions
chats
messages
shared_answers
ai_usage_logs
knowledge_documents
knowledge_chunks
knowledge_ingestion_runs
```

## Naming Rules

- Database tables and columns use snake_case.
- TypeScript types use PascalCase.
- API fields use camelCase.
- Prisma maps database names explicitly.

## Message Metadata

Assistant metadata may contain:

- PromptProfile.
- approved visuals.
- sources.
- retrieval enabled state and matched chunk diagnostics.
- finish reason.
- truncated and maybe-truncated state.
- timing diagnostics.

Metadata readers must validate unknown JSON and tolerate missing legacy fields.

Do not store API keys, raw provider credentials, or unnecessary sensitive user data in metadata.

## AI Usage Log

Production generation records:

- provider and model.
- prompt version.
- token usage when available.
- latency.
- success and fallback use.
- error message for failed generation.
- relevant generation metadata.

Harness evaluation does not create usage log rows; its output belongs under `ai/harness/reports`.

## Knowledge Data

- `knowledge_documents` stores document identity, category, trust, status, and source update time.
- `knowledge_chunks` stores section content, hash, tags, and vector.
- `knowledge_ingestion_runs` records ingestion outcomes.
- Vector queries may use raw SQL where Prisma cannot represent pgvector operations.
- Raw chunks and similarity scores never cross the public API boundary.

## Migration Rules

- Develop migrations against local PostgreSQL with pgvector.
- Review generated SQL before applying it.
- Do not alter shared or production data from local development.
- Preserve compatibility for existing Message metadata.
- Index changes must match expected lookup or vector query patterns.

## Validation Rule

When metadata or schema changes:

- Update API serializers/readers.
- Update Harness metadata checks.
- Update database and API documentation.
- Run build and relevant AI regression cases.
