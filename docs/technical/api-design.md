# ChinaTrip AI API Design

## Common Rules

APIs support the core product loop:

```text
Home question
→ Chat page
→ AI answer
→ Follow-up question
→ Copy or Share answer
→ New user asks from share page
```

Rules:

- Base path is `/api`.
- Request and response bodies use JSON.
- API response fields use camelCase.
- Database fields use snake_case and are mapped in the server layer.
- Copy answer is client-side only through the Browser Clipboard API.
- Share does not require login.
- Phase 3 does not expose knowledge management HTTP APIs.
- RAG retrieval is implemented through internal server services and existing chat API response extensions.

## Error Shape

All API errors use this shape:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Common error codes:

```text
EMPTY_MESSAGE
INVALID_LANGUAGE
CHAT_NOT_FOUND
MESSAGE_NOT_FOUND
PAIR_NOT_FOUND
SHARE_NOT_FOUND
SHARE_NOT_PUBLIC
UNAUTHORIZED
FORBIDDEN
AI_GENERATION_FAILED
RATE_LIMITED
AI_QUOTA_EXHAUSTED
INTERNAL_ERROR
```

RAG failures should not normally become public API errors. Embedding config issues, Doubao failures, pgvector query failures, and no-match results should degrade to a normal DeepSeek answer without sources.

## Identity Rules

Anonymous users:

- Use an `anonymous_id` cookie.
- Can create chats and messages.
- Can share answers.
- Can open public share pages.

Logged-in users:

- Are identified through Supabase Auth.
- Have a row in `profiles`.
- Can view their chat history.
- Can share answers.

Identity resolution:

- If a Supabase session exists, get or create `profiles`.
- If no Supabase session exists, get or create `anonymous_sessions`.
- If no `anonymous_id` cookie exists, generate one and set it.
- Guest-to-user migration is deferred, but APIs should preserve anonymous ownership fields so migration remains possible.

## Shared Types

### AnswerVisuals

```ts
type AnswerVisuals = {
  heroAssetId?: string;
  inlineAssetIds?: string[];
  embeddedAssetIds?: string[];
  cards?: Array<{
    type: "phrase" | "warning" | "backup" | "checklist";
    title: string;
    body: string;
  }>;
};
```

### AnswerSource

Phase 3 adds source display for RAG-backed answers:

```ts
type AnswerSource = {
  id: string;
  title: string;
  category: string;
  updatedAt: string | null;
};
```

Sources are derived from assistant message metadata. They are display metadata only; they do not expose raw chunk content or similarity scores.

## API Routes

Current API surface:

```text
POST /api/chats
GET /api/chats
GET /api/chats/:chatId
PATCH /api/chats/:chatId
POST /api/chats/:chatId/messages
POST /api/chats/:chatId/messages/stream
POST /api/shared-answers
GET /api/share/:shareId
POST /api/share/:shareId/chats
GET /api/me
POST /api/auth/logout
```

`PATCH /api/chats/:chatId` is a designed endpoint for title/status updates and does not need to be implemented in the first API batch.

Phase 3 does not add public endpoints such as `/api/knowledge-documents` or `/api/rag/search`.

## Chat APIs

### POST /api/chats

Creates a chat and the first user message. This is used by the home page and by the share page question input.

AI answer generation is not performed by this endpoint. After successful creation, the client navigates to `/chat/:chatId`; the chat page then calls the message endpoint to generate an assistant answer.

Request:

```ts
type CreateChatRequest = {
  message: string;
  language?: "en" | "zh";
  source?: "home" | "share";
  shareId?: string;
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
};
```

Response:

```ts
type CreateChatResponse = {
  chat: {
    id: string;
    title: string;
    language: "en" | "zh";
    status: "active";
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
  };
  firstMessage: {
    id: string;
    chatId: string;
    role: "user";
    status: "complete";
    sequence: number;
    content: string;
    createdAt: string;
  };
};
```

Database behavior:

- Resolve `profiles` or `anonymous_sessions`.
- Create `chats`.
- Create first `messages` row with `role=user`, `status=complete`, `sequence=1`.
- Store quick-question metadata when the request exactly matches a supported quick question.
- Set `chats.last_message_at`.

Errors:

- `EMPTY_MESSAGE`
- `INVALID_LANGUAGE`
- `INTERNAL_ERROR`

### GET /api/chats

Returns chat history for the current logged-in profile or anonymous session.

Query:

```ts
type ChatHistoryQuery = {
  limit?: number;
  cursor?: string;
};
```

Response:

```ts
type ChatHistoryResponse = {
  chats: Array<{
    id: string;
    title: string;
    language: "en" | "zh";
    status: "active" | "archived";
    updatedAt: string;
    lastMessageAt: string;
    preview: string | null;
  }>;
  nextCursor: string | null;
};
```

Rules:

- Do not return `deleted` chats.
- Sort by `lastMessageAt desc`.
- `preview` is a short summary of the latest visible message.

Errors:

- `INTERNAL_ERROR`

### GET /api/chats/:chatId

Returns one chat and its messages for the current owner.

Response:

```ts
type ChatDetailResponse = {
  chat: {
    id: string;
    title: string;
    language: "en" | "zh";
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
  };
  messages: ChatDetailMessage[];
};

type ChatDetailMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  status: "pending" | "complete" | "failed";
  sequence: number;
  content: string;
  errorCode: string | null;
  errorMessage: string | null;
  visuals?: AnswerVisuals;
  sources?: AnswerSource[];
  quickQuestionMenu?: {
    sourceQuestionId: string;
    promptProfile: PromptProfile;
    subQuestions: QuickSubQuestion[];
  };
  truncated?: boolean;
  maybeTruncated?: boolean;
  finishReason?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- Only the owning profile or anonymous session can read the chat.
- Messages are returned by `sequence asc`.
- System messages are not returned to the client.
- `sources` is present only when the assistant answer used retrieved knowledge.

Errors:

- `CHAT_NOT_FOUND`
- `FORBIDDEN`
- `INTERNAL_ERROR`

### PATCH /api/chats/:chatId

Updates chat metadata. This is a designed endpoint for later polish and may remain unimplemented.

Request:

```ts
type UpdateChatRequest = {
  title?: string;
  status?: "active" | "archived" | "deleted";
};
```

Response:

```ts
type UpdateChatResponse = {
  chat: {
    id: string;
    title: string;
    status: "active" | "archived" | "deleted";
    updatedAt: string;
  };
};
```

## Message APIs

### POST /api/chats/:chatId/messages

Sends a follow-up message, generates an AI answer, writes both messages, and logs AI usage.

The same endpoint can generate the first assistant answer after `POST /api/chats` if the chat currently ends with a user message and no assistant answer has been written for that turn.

Request:

```ts
type SendMessageRequest = {
  message?: string;
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
  sourceSubQuestionId?: string;
};
```

Response:

```ts
type SendMessageResponse = {
  userMessage: {
    id: string;
    chatId: string;
    role: "user";
    status: "complete";
    sequence: number;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
  assistantMessage: {
    id: string;
    chatId: string;
    role: "assistant";
    status: "complete" | "failed";
    sequence: number;
    content: string;
    errorCode: string | null;
    errorMessage: string | null;
    visuals?: AnswerVisuals;
    sources?: AnswerSource[];
    quickQuestionMenu?: ChatDetailMessage["quickQuestionMenu"];
    truncated?: boolean;
    maybeTruncated?: boolean;
    finishReason?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  usage: {
    provider: "mock" | "doubao" | "deepseek";
    model: string;
    promptVersion: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number | null;
    fallbackUsed: boolean;
  };
};
```

Database behavior:

- Validate chat ownership.
- Create a user message with the next sequence number when `message` is present.
- Create an assistant message with `status=pending`.
- Resolve prompt profile.
- Run RAG retrieval unless the request uses fast path.
- Call DeepSeek through the AI Provider Service.
- Update assistant message to `complete` or `failed`.
- Store `visuals`, `retrieval`, and `sources` in assistant metadata when available.
- Create an `ai_usage_logs` row.
- Update `chats.last_message_at`.

Failure behavior:

- AI failures should still create/update an assistant message with `status=failed`.
- AI failures should still write `ai_usage_logs.success=false` when possible.
- RAG failures should degrade to a normal DeepSeek answer without sources.

Errors:

- `EMPTY_MESSAGE`
- `CHAT_NOT_FOUND`
- `MESSAGE_GENERATION_IN_PROGRESS`
- `AI_QUOTA_EXHAUSTED`
- `INTERNAL_ERROR`

### POST /api/chats/:chatId/messages/stream

Streams an assistant answer for a follow-up message or for the first unanswered user message after `POST /api/chats`.

This endpoint is preferred by the Chat UI because it returns immediately as `text/event-stream` and sends answer deltas while the model is generating.

Request:

```ts
type SendMessageRequest = {
  message?: string;
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
  sourceSubQuestionId?: string;
};
```

Events:

```ts
type StreamMessageEvent =
  | {
      type: "created";
      userMessage: SendMessageResponse["userMessage"];
      assistantMessage: {
        id: string;
        chatId: string;
        role: "assistant";
        status: "pending";
        sequence: number;
        content: "";
        errorCode: null;
        errorMessage: null;
        createdAt: string;
        updatedAt: string;
      };
    }
  | {
      type: "delta";
      content: string;
    }
  | {
      type: "done";
      assistantMessage: SendMessageResponse["assistantMessage"];
      usage: SendMessageResponse["usage"];
    }
  | {
      type: "error";
      assistantMessage?: SendMessageResponse["assistantMessage"];
      error: {
        code: string;
        message: string;
      };
    };
```

Because `SendMessageResponse["assistantMessage"]` includes `sources`, the `done` event automatically supports RAG sources.

Database behavior:

- Create the user message and `pending` assistant message before streaming.
- Stream deltas to the client without writing every delta to the database.
- On completion, update the assistant message to `complete` with the full answer and metadata.
- On failure or interruption, update the assistant message to `failed`.
- Create an `ai_usage_logs` row when possible.

## Share APIs

### POST /api/shared-answers

Creates or reuses a public share record for one question-answer pair.

Request:

```ts
type CreateSharedAnswerRequest = {
  chatId: string;
  userMessageId: string;
  assistantMessageId: string;
};
```

Response:

```ts
type CreateSharedAnswerResponse = {
  share: {
    id: string;
    shareId: string;
    url: string;
    question: string;
    answer: string;
    visuals?: AnswerVisuals;
    sources?: AnswerSource[];
    createdAt: string;
  };
};
```

Rules:

- Validate chat ownership.
- Validate that the two messages form a valid question-answer pair.
- Reuse an existing public share for the same assistant message when possible.
- Otherwise create `shared_answers` with question and answer snapshots.
- `sources` may be read from the assistant message metadata.

### GET /api/share/:shareId

Returns a public shared question-answer snapshot.

Response:

```ts
type SharedAnswerResponse = {
  share: {
    id: string;
    shareId: string;
    question: string;
    answer: string;
    visuals?: AnswerVisuals;
    sources?: AnswerSource[];
    createdAt: string;
    viewCount: number;
  };
};
```

Rules:

- Return only shares where `is_public=true` and `revoked_at=null`.
- Do not return `chatId`, message ids, `profileId`, or `anonymousSessionId`.
- `sources` may be rebuilt from the original assistant message metadata or safely omitted if unavailable.
- Increment `view_count` synchronously or asynchronously.

### POST /api/share/:shareId/chats

Creates a new chat from the share page question input.

Request:

```ts
type CreateChatFromShareRequest = {
  message: string;
  language?: "en" | "zh";
};
```

Response:

```ts
type CreateChatFromShareResponse = CreateChatResponse;
```

Rules:

- Internally reuse the same service logic as `POST /api/chats`.
- Treat source as `share`.
- Attach `shareId` to analytics metadata when available.
- Client navigates to `/chat/:chatId` after success.

## Profile and Auth APIs

### GET /api/me

Returns current identity state for header, sidebar, and client initialization.

Response:

```ts
type MeResponse = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    locale: "en" | "zh";
  } | null;
  anonymous: {
    id: string;
  };
};
```

### POST /api/auth/logout

Logs out the current Supabase session.

Response:

```ts
type LogoutResponse = {
  status: "ok";
};
```

## Internal RAG Interfaces

Phase 3 uses internal services, not public HTTP APIs, for knowledge ingestion and retrieval.

### Embedding

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

### Retrieval

```ts
type KnowledgeSource = AnswerSource;

type RetrievalMatch = {
  chunkId: string;
  documentId: string;
  title: string;
  heading: string | null;
  category: string;
  content: string;
  score: number;
  updatedAt: string | null;
};

type RetrievalResult = {
  enabled: boolean;
  matches: RetrievalMatch[];
  sources: KnowledgeSource[];
  failedReason?: string;
};

async function retrieveTravelKnowledge(input: {
  query: string;
  language: "en" | "zh";
  promptProfile: PromptProfile;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RetrievalResult>;
```

Retrieval rules:

- Each user question calls Doubao Embedding at most once.
- Default `limit` is `5`.
- Prefer the current `promptProfile`.
- Allow `general_travel` as supplementary context.
- Use English knowledge by default.
- Do not inject Knowledge Context when there are no matches.
- Degrade to normal DeepSeek answer if embedding config is missing, Doubao fails, or pgvector query fails.

### Knowledge Context

```ts
function buildKnowledgeContext(retrieval: RetrievalResult): string | null;
```

Knowledge Context format:

```text
Knowledge base context:
Use this context when relevant to the traveler's question.
Do not invent official policies, prices, opening hours, or links if they are not provided here.
If the context is missing or not relevant, answer from general travel knowledge and remind the traveler to verify time-sensitive details.

[Source 1]
Title: {title}
Updated: {updatedAt}
Category: {category}
Content:
{content}
```

## Knowledge Ingestion Script

Knowledge ingestion is script-based.

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

Seed directory:

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

Seed type:

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

Seed demo:

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
    }
  ]
}
```

Ingestion flow:

```text
Read ai/knowledge/seed/*.json
→ Validate with zod
→ Create section-level chunks
→ Build embedding input
→ Generate content_hash
→ Dry-run prints stats and exits
→ Real run calls Doubao Embedding API
→ Upsert knowledge_documents
→ Upsert knowledge_chunks
→ Write knowledge_ingestion_runs
```

Embedding input format:

```text
Title: {document.title}
Category: {document.category}
Summary: {document.summary}
Heading: {section.heading}
Tags: {section.tags.join(", ")}

{section.content}
```

Dry-run output:

```text
documentsSeen
sectionsSeen
chunksPlanned
invalidFiles
categories
estimatedEmbeddingCalls
```

Real import rules:

- `knowledge_documents.slug = seed.id`.
- One section creates one chunk by default.
- Upsert chunks by `document_id + chunk_index`.
- Skip embedding when `content_hash` is unchanged.
- Regenerate embedding when `content_hash` changes.
- Write `success` run on successful import.
- Write `failed` run and `error_message` on failed import.
- Store embedding provider, model, and dimensions in run metadata.

## RAG Answer Flow

```text
prepareMessageGeneration
→ fast path check
→ resolveTravelPromptProfile
→ retrieveTravelKnowledge
→ buildTravelAnswerMessages with Knowledge Context
→ DeepSeek generate / stream
→ selectAnswerVisuals
→ save assistant metadata: promptProfile + visuals + retrieval + sources
→ return assistantMessage.sources
```
