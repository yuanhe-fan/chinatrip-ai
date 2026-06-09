# ChinaTrip AI

ChinaTrip AI is a browser-based AI travel assistant for foreign travelers visiting China.

It helps users ask practical questions about China travel, payments, transport, apps, food, local tips, and short itineraries. Answers should be clear, actionable, copyable, and shareable.

## Current Phase

```text
Project initialization + documentation baseline
```

This phase has not implemented:

- Business pages.
- Real API routes.
- Google login.
- Prisma migration.
- Real AI calls.
- Harness runner.

## MVP Scope

Phase 1 validates the core product loop:

```text
Home question
→ AI answer
→ Follow-up question
→ Copy or Share answer
→ New user asks from share page
```

Phase 1 includes:

- Home page.
- Classic questions.
- Chat page.
- AI answer generation.
- Follow-up questions.
- Chat history.
- New chat.
- Google login.
- Share answer.
- Copy answer.
- Share page.
- English / Chinese language switch.
- Responsive layout.
- AI usage logs.
- Vibcoding directory baseline and foundational skills.

Phase 1 does not include:

- Question limits.
- Credits or payment.
- Save answer or bookmarks.
- RAG.
- Maps.
- Attraction detail pages.
- Complex itinerary editor.
- Native app.
- Full harness automation.

## Tech Stack

```text
Next.js
React
TypeScript
Tailwind CSS
Supabase Auth
Docker PostgreSQL
Supabase PostgreSQL
Prisma
React Query
useState / Zustand
@tanstack/react-virtual
Doubao LLM
DeepSeek fallback
Vercel
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Start local PostgreSQL:

```bash
docker compose up -d
```

Start the Next.js dev server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Documentation Index

Product:

- [Phase 1 MVP Product Plan](docs/product/phase-1-mvp.md)
- [Phase 2 Answer Experience Product Plan](docs/product/phase-2-answer-experience.md)
- [Phase 3 RAG Knowledge Base Product Plan](docs/product/phase-3-rag-knowledge-base.md)
- [Copywriting](docs/product/copywriting.md)
- [User Flows](docs/product/user-flows.md)

Technical:

- [Tech Stack](docs/technical/tech-stack.md)
- [API Design](docs/technical/api-design.md)
- [Database Design](docs/technical/database-design.md)
- [Local Development](docs/technical/local-development.md)

Vibcoding:

- [Workflow](docs/vibcoding/workflow.md)

AI:

- [Travel Assistant System Prompt](ai/prompts/travel-assistant-system.md)
- [Answer Style](ai/prompts/answer-style.md)
- [Classic Questions](ai/fixtures/classic-questions.json)
- [Mock Chats](ai/fixtures/mock-chats.json)
- [Harness](ai/harness/README.md)
- [Skills](ai/skills/README.md)

## Vibcoding Strategy

Phase 1:

```text
Function validation first
Reserve Vibcoding directories
Write baseline skills
Seed basic prompts and fixtures
Defer full harness runner
```

Phase 2:

```text
Add harness runner
Add expected answer checks
Add prompt versioning
Add AI answer quality reports
Refine skills from real development
```

## Development Order

Recommended next sequence:

```text
1. Confirm documentation baseline.
2. Implement Prisma schema and local migration.
3. Implement home page.
4. Implement chat page shell.
5. Implement API routes with mock AI.
6. Implement real AI Provider Service.
7. Implement save, share, copy.
8. Implement Google login.
9. Add AI usage logs.
10. Add initial harness runner in Phase 2.
```
