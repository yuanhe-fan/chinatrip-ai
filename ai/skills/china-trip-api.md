# ChinaTrip API Skill

## Applies To

- Next.js Route Handlers.
- Chat creation and message generation.
- Streaming events.
- Shared answers and public share fetch.
- AI metadata exposed to clients.

## API Rules

- Base path is `/api`.
- Validate external request payloads.
- Keep model and embedding keys on the server.
- Do not return raw provider, database, or embedding errors to clients.
- Preserve the common error shape:

```ts
{
  error: {
    code: string;
    message: string;
    details?: unknown;
  }
}
```

## Current Routes

```text
POST /api/chats
GET /api/chats
GET /api/chats/:chatId
POST /api/chats/:chatId/messages
POST /api/chats/:chatId/messages/stream
POST /api/shared-answers
GET /api/share/:shareId
POST /api/share/:shareId/chats
GET /api/me
POST /api/auth/logout
```

## Stream Contract

Stream events remain:

```text
created
delta
done
error
```

- `created` contains persisted user and pending assistant messages.
- `delta` contains visible text only.
- `done` contains the complete serialized assistant message and usage.
- `error` contains a stable public error code and message.

Do not expose Prompt text, raw retrieval chunks, vectors, similarity scores, or provider payloads.

## Metadata Boundary

Public answer metadata may expose:

- approved visuals.
- up to three answer sources.
- quick-question menu.
- finish reason and truncated flags.

Internal metadata may additionally contain:

- PromptProfile.
- retrieval matches and failure reason.
- provider request identifiers.
- timing diagnostics.

RAG failures are internal degradation, not public API errors. Generation failures continue to use the existing assistant failed state.

## Identity And Share

- Anonymous ownership uses the `anonymous_id` cookie.
- Logged-in ownership uses Supabase Auth and Profile.
- Share remains public when `isPublic=true`.
- Copy remains client-side.
- Share preserves approved visuals and source display, not internal retrieval details.

## Change Rule

When changing stream or metadata behavior:

- Update `lib/api/types.ts`.
- Keep non-streaming and streaming response semantics aligned.
- Add or update Harness metadata checks.
- Verify chat and share rendering.
