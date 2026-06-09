# ChinaTrip AI Phase 3 Product Plan: RAG Knowledge Base

## 1. Summary

Phase 3 upgrades ChinaTrip AI from a prompt-driven travel assistant into a RAG-enabled assistant backed by a curated, project-owned knowledge base.

The goal is to build a practical RAG MVP:

```text
Project knowledge seeds
→ Ingestion script
→ Embedding generation
→ Supabase PostgreSQL + pgvector
→ User question
→ Knowledge retrieval
→ AI answer grounded in retrieved context
→ Short source display in the UI
```

This phase is not about building a full CMS, a real-time policy database, or a web-crawling pipeline. It establishes the first reliable knowledge-base loop so the product can produce more consistent, traceable answers for China inbound travel scenarios.

## 2. Background

Phase 1 delivered the core product loop:

```text
Home question
→ Chat page
→ AI answer
→ Follow-up question
→ Copy or Share answer
```

Phase 2 improved the answer experience with:

- Quick questions.
- Prompt profiles.
- Pain-point routing.
- Structured answer rendering.
- Static visual assets.
- Redis caching.

Today, answers still rely mostly on:

- System prompts.
- Prompt profiles.
- Recent conversation history.
- The model's built-in knowledge.

That creates several product limits:

- Details about payments, transport, tickets, app setup, and emergencies can be inconsistent.
- The team has no explicit place to maintain travel knowledge that the assistant should always know.
- Answers do not show the knowledge sources used, which limits user trust.
- Future content areas such as cities, attractions, entry policy, and operational guidance need a reusable knowledge infrastructure.

Phase 3 addresses these gaps through a RAG knowledge base.

## 3. Phase Goal

Phase 3 builds the first production-shaped RAG MVP for ChinaTrip AI.

Target capabilities:

- Maintain first-party knowledge as project seed files.
- Import knowledge through a repeatable ingestion script.
- Convert knowledge chunks into embedding vectors.
- Retrieve relevant chunks with pgvector.
- Inject retrieved knowledge before AI answer generation.
- Store retrieval details in assistant message metadata.
- Show concise sources below answers.
- Keep the existing chat flow working when RAG is unavailable.

After Phase 3, typical China inbound travel questions should be answered with help from curated project knowledge, not only from the model's general memory.

## 4. Product Scope

The first knowledge base covers the six travel pain points already defined in Phase 2:

| Knowledge Area | Prompt Profile | Coverage |
| --- | --- | --- |
| Payment survival | `payment_survival` | Alipay, WeChat Pay, foreign cards, cash backup, payment failure handling |
| Internet and apps | `internet_apps` | SIM, eSIM, roaming, VPN reminders, core apps, SMS verification |
| Transport workflow | `transport_workflow` | Airports, metro, taxis, Didi, high-speed rail, Chinese addresses |
| Tickets and booking | `tickets_booking` | Passport booking, reservations, closed days, sold-out risk, alternatives |
| Language cards | `language_cards` | Driver, hotel, restaurant, ticket counter, and help phrases |
| Emergency help | `emergency_help` | Lost passport, lost phone, payment loss, hospitals, police, embassy help |

The first batch of knowledge is English-first because the current product defaults to English answers.

Future expansions may include:

- City knowledge.
- Attraction knowledge.
- Entry policy FAQ.
- Hotel check-in guidance.
- Airport and railway station scenarios.
- Food, allergy, and dietary restriction guidance.

## 5. User Experience

### 5.1 Normal Q&A

The user flow does not change:

```text
User asks a China travel question
→ AI returns a structured, practical answer
```

Users do not need to choose a knowledge base or understand how RAG works.

### 5.2 Source Display

When an answer uses retrieved knowledge, the UI shows short sources below the answer:

```text
Sources used
- Payment Survival Basics · Payment · Updated Jun 2026
- Backup Payment Options · Payment · Updated Jun 2026
```

Display rules:

- Show at most 3 sources.
- Show only title, category, and updated date.
- Do not show raw chunk text.
- Do not show similarity scores.
- Hide the source module when no knowledge source was used.
- Copy should copy the answer text only.
- Shared answer pages should preserve source display.

### 5.3 Fallback Experience

RAG is an enhancement, not a hard dependency for chat.

Fallback rules:

```text
Missing embedding configuration
→ Normal AI answer, no sources

Embedding API failure
→ Normal AI answer, no sources

pgvector query failure
→ Normal AI answer, no sources

No relevant match
→ Normal AI answer, no sources
```

Only AI generation failures should produce the existing assistant failed state.

## 6. Functional Requirements

### 6.1 Knowledge Seed Files

Add a project knowledge directory:

```text
ai/knowledge/seed/
```

Recommended first files:

```text
payment-survival.json
internet-apps.json
transport-workflow.json
tickets-booking.json
language-cards.json
emergency-help.json
```

Seed document type:

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

Seed example:

```json
{
  "id": "payment-survival-basics-en",
  "title": "Payment Survival Basics for Foreign Travelers in China",
  "language": "en",
  "category": "payment_survival",
  "sourceType": "internal_seed",
  "trustLevel": "product_curated",
  "updatedAt": "2026-06-01",
  "summary": "Practical payment setup and backup advice for foreign travelers arriving in China.",
  "sections": [
    {
      "id": "before-arrival-setup",
      "heading": "Before arrival setup",
      "tags": ["alipay", "wechat pay", "foreign card", "setup"],
      "content": "Foreign travelers should set up at least one mobile payment app before arriving in China. Alipay and WeChat Pay are the most useful daily payment tools. Add an international bank card if supported, complete identity verification when requested, and keep a backup card and a small amount of cash."
    },
    {
      "id": "if-payment-fails",
      "heading": "If mobile payment fails",
      "tags": ["payment failed", "cash", "card declined", "backup"],
      "content": "If Alipay or WeChat Pay fails at a shop, first check mobile data and app login status. Then try the other payment app if available. If both fail, ask whether cash or a foreign card is accepted. In hotels, airports, larger malls, and some restaurants, foreign cards are more likely to work than in small local shops."
    }
  ]
}
```

### 6.2 Knowledge Ingestion Script

Add a standalone ingestion script.

Responsibilities:

```text
Read seed files
→ Validate JSON structure
→ Split into chunks
→ Generate content hashes
→ Call Embedding API
→ Write knowledge_documents
→ Write knowledge_chunks
→ Record knowledge_ingestion_runs
```

Recommended commands:

```bash
pnpm knowledge:ingest:dry-run
pnpm knowledge:ingest
```

Dry-run behavior:

- Read files.
- Validate structure.
- Print document and chunk counts.
- Do not call the Embedding API.
- Do not write to the database.

Real import behavior:

- Call the Embedding API.
- Upsert documents and chunks.
- Record the import result.

### 6.3 Embedding Service

Phase 3 uses a dedicated embedding configuration that is independent from the answer-generation model.

The answer model can continue to use DeepSeek. The embedding service uses Doubao / Volcengine Ark text embeddings.

Recommended environment variables:

```env
EMBEDDING_PROVIDER="doubao"
EMBEDDING_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
EMBEDDING_API_KEY=""
EMBEDDING_MODEL="doubao-embedding-text-240515"
EMBEDDING_DIMENSIONS="1536"
```

Responsibilities:

- DeepSeek generates the final answer.
- Doubao Embedding converts seed knowledge and user questions into vectors.
- pgvector performs similarity search.

### 6.4 RAG Retrieval

Before answer generation, run knowledge retrieval:

```text
User question
→ Generate query embedding
→ Search similar chunks with pgvector
→ Filter by language and promptProfile
→ Select Top 3-5 chunks
→ Deduplicate source documents
→ Build Knowledge Context
→ Inject into the AI prompt
```

Retrieval rules:

- Prefer the current `promptProfile`.
- Allow `general_travel` as supplemental context.
- Use English knowledge by default.
- Do not inject Knowledge Context when there are no matches.
- Fall back to a normal AI answer if retrieval fails.

### 6.5 Prompt Injection

Current prompt structure:

```text
Core Prompt
+ Pain Point Rules
+ Intent Classifier
+ Prompt Profile
+ Templates
+ Output Contract
```

Phase 3 prompt structure:

```text
Core Prompt
+ Pain Point Rules
+ Intent Classifier
+ Prompt Profile
+ Knowledge Context
+ Templates
+ Output Contract
```

Knowledge Context example:

```text
Knowledge base context:
Use this context when relevant to the traveler's question.
Do not invent official policies, prices, opening hours, or links if they are not provided here.
If the context is missing or not relevant, answer from general travel knowledge and remind the traveler to verify time-sensitive details.

[Source 1]
Title: Payment Survival Basics for Foreign Travelers in China
Updated: 2026-06-01
Content:
...

[Source 2]
Title: Backup Payment Options
Updated: 2026-06-01
Content:
...
```

Phase 3 does not require inline citation markers such as `[1]` or `[2]` in the answer body. Source display is controlled by server metadata.

### 6.6 Source Metadata

Assistant message metadata should record RAG details:

```json
{
  "promptProfile": "payment_survival",
  "retrieval": {
    "enabled": true,
    "matchedChunkCount": 3,
    "matches": [
      {
        "chunkId": "...",
        "documentId": "...",
        "title": "Payment Survival Basics for Foreign Travelers in China",
        "heading": "If mobile payment fails",
        "category": "payment_survival",
        "score": 0.82,
        "updatedAt": "2026-06-01"
      }
    ]
  },
  "sources": [
    {
      "documentId": "...",
      "title": "Payment Survival Basics for Foreign Travelers in China",
      "category": "payment_survival",
      "updatedAt": "2026-06-01"
    }
  ]
}
```

The frontend displays only `sources`, not full retrieval debug details.

## 7. Data / Technical Requirements

### 7.1 Database

Add Supabase PostgreSQL / pgvector support.

Required migration work:

```text
Enable vector extension
Add knowledge_documents
Add knowledge_chunks
Add knowledge_ingestion_runs
Add required indexes
```

`knowledge_documents` stores document-level metadata.

Recommended fields:

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

`knowledge_chunks` stores searchable text chunks and embedding vectors.

Recommended fields:

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

`knowledge_ingestion_runs` stores import history.

Recommended fields:

```text
id
status
started_at
finished_at
documents_seen
chunks_created
chunks_updated
chunks_skipped
error_message
metadata
```

### 7.2 RAG Integration Point

RAG should run before AI prompt construction:

```text
prepareMessageGeneration
→ fast path check
→ resolveTravelPromptProfile
→ retrieveTravelKnowledge
→ buildTravelAnswerMessages
→ provider.generate / provider.stream
→ save assistant message
```

Recommended code integration point:

```text
lib/ai/index.ts
```

Do not put RAG retrieval in:

- Frontend code.
- API route transaction logic.
- Provider adapters.
- Prompt builders that directly query the database.

### 7.3 API and Types

Add source display support:

```ts
type AnswerSource = {
  id: string;
  title: string;
  category: string;
  updatedAt: string | null;
};
```

Assistant messages should expose:

```ts
sources?: AnswerSource[];
```

`serializeAssistantMessage()` should read sources from metadata and include them in chat detail and stream responses.

## 8. Non-functional Requirements

### 8.1 Stability

- RAG must not block the core chat loop.
- Retrieval failures must degrade to normal AI answers.
- Users should not see internal RAG errors.

### 8.2 Maintainability

- Knowledge content must be maintained as project files.
- The seed file format must be stable and validated.
- Ingestion must be repeatable and as idempotent as practical.

### 8.3 Observability

Record:

- Whether RAG was enabled.
- Retrieval hit count.
- Retrieval latency.
- Embedding model.
- Retrieval failure reason.
- Used knowledge sources.

This data can be stored in assistant metadata or `ai_usage_logs.metadata`.

### 8.4 Cost Control

- Seed ingestion calls the Embedding API.
- When RAG is enabled, each user question calls the Embedding API once.
- Each retrieval returns at most 3-5 chunks.
- Knowledge Context should stay compact to avoid unnecessary answer-generation token cost.

## 9. Acceptance Criteria

Phase 3 is complete when:

- A migration can create the knowledge-base tables and enable pgvector.
- The ingestion script can import six seed knowledge files.
- The database stores documents, chunks, and embeddings.
- Payment questions can retrieve `payment_survival` knowledge.
- Transport questions can retrieve `transport_workflow` knowledge.
- AI answers incorporate relevant retrieved knowledge.
- Answers that use retrieved knowledge show concise sources.
- RAG failures still return normal AI answers.
- Share pages can display sources, or at minimum do not break when source metadata is present.
- Existing quick question, streaming answer, copy, and share flows do not regress.

Test questions:

```text
What should I do if Alipay does not work after I arrive in China?
Which apps and mobile data setup should I prepare before going to China?
How can I take a taxi or Didi if I cannot speak Chinese?
Do foreign visitors need passport information to book attraction tickets in China?
What Chinese text should I show a taxi driver?
What should I do if I lose my passport in China?
```

Verification commands:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm build
```

## 10. Out of Scope

Phase 3 does not include:

- External web crawling.
- Automatic official policy sync.
- CMS backend.
- Knowledge review workflows.
- User-uploaded knowledge.
- File-upload Q&A.
- Multi-tenant knowledge bases.
- Complete city or attraction databases.
- Maps.
- Complex agents.
- Strict inline citation numbering.
- Automated RAG evaluation platform.

## 11. Implementation Order

Recommended implementation sequence:

```text
1. Add Phase 3 product documentation
2. Design the seed JSON schema
3. Add example seed files
4. Add Prisma schema and migration
5. Enable pgvector
6. Implement the Embedding adapter
7. Implement the knowledge ingestion script
8. Implement the retrieval service
9. Connect retrieval to generateTravelAnswer / streamTravelAnswer
10. Add Knowledge Context to prompt construction
11. Extend assistant metadata and API sources
12. Show Sources used in chat answers
13. Show or preserve sources on share pages
14. Add test questions and acceptance checks
```
