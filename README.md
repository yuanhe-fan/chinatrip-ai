# ChinaTrip AI

ChinaTrip AI is a browser-based AI travel assistant for foreign travelers visiting China.

It helps users ask practical questions about China travel, payments, transport, apps, food, local tips, and short itineraries. Answers should be clear, actionable, copyable, and shareable.

## Current Phase

```text
Phase 5: Dynamic trip clarification release hardening
```

Phases 1-3 have established:

- Home, chat, share, authentication, and responsive UI flows.
- AI provider, streaming answer, prompt profile, and usage logging.
- Structured answer rendering and approved visual assets.
- RAG knowledge ingestion, pgvector retrieval, and answer sources.

Phase 4 established:

- AI evaluation Harness.
- Prompt versioning and answer contracts.
- AI development rules and project Skills.

Phase 5 focuses on:

- Dynamic itinerary clarification inside the existing chat flow.
- Temporary, non-persistent trip context collection before itinerary generation.
- Context-aware clarification quality, fallback behavior, and UI release hardening.

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
- [Phase 4 AI Automation Engineering Plan](docs/product/phase-4-ai-automation.md)
- [Phase 5 Dynamic Trip Clarification Flow](docs/product/phase-5-dynamic-trip-clarification.md)
- [Copywriting](docs/product/copywriting.md)
- [User Flows](docs/product/user-flows.md)

Technical:

- [Tech Stack](docs/technical/tech-stack.md)
- [API Design](docs/technical/api-design.md)
- [Database Design](docs/technical/database-design.md)
- [Local Development](docs/technical/local-development.md)
- [AI Evaluation Harness](docs/technical/ai-evaluation-harness.md)
- [Prompt Version and Answer Contract](docs/technical/prompt-version-and-answer-contract.md)
- [Dynamic Trip Clarification Flow](docs/technical/dynamic-trip-clarification-flow.md)

Vibcoding:

- [Workflow](docs/vibcoding/workflow.md)
- [AI Development Rules and Skills](docs/vibcoding/ai-development-skills.md)

AI:

- [Travel Assistant System Prompt](ai/prompts/travel-assistant-system.md)
- [Answer Style](ai/prompts/answer-style.md)
- [Classic Questions](ai/fixtures/classic-questions.json)
- [Mock Chats](ai/fixtures/mock-chats.json)
- [Harness](ai/harness/README.md)
- [Skills](ai/skills/README.md)
- [Prompt Versions](ai/prompts/versions/README.md)

## AI Engineering Strategy

Phase 4 and Phase 5 sequence:

```text
Harness quality baseline
→ Prompt versions and answer contracts
→ AI development rules and Skills
→ Dynamic trip clarification
→ Continuous quality feedback loop
```

Development rule:

```text
Read product and technical contracts
→ Read the relevant Skill
→ Add or update a Harness case
→ Implement the smallest change
→ Run evaluation
→ Update Prompt docs and Skills
```

## Current Phase 5 Delivery Order

Recommended sequence:

```text
1. Align Phase 5 product, API, technical, and local-development docs.
2. Harden dynamic clarification error handling and fallback behavior.
3. Add targeted itinerary clarification regression tests.
4. Run itinerary profile Harness and smoke checks.
5. Complete PC and mobile UI acceptance for the clarification flow.
```
