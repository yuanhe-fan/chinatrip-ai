# ChinaTrip AI Phase 1 Product Plan: MVP

## 1. Summary

Phase 1 validates whether foreign travelers will use a dedicated AI assistant for practical China travel questions.

The MVP focuses on the core question-and-answer loop:

```text
Home question
→ Chat page
→ AI answer
→ Follow-up question
→ Copy or Share answer
→ New user asks from share page
```

ChinaTrip AI is a browser-based assistant for foreign travelers visiting China. It focuses on practical, travel-ready answers about payments, transport, apps, food, local tips, and short trip decisions. It does not try to become a full travel platform with maps, booking, attraction detail pages, or a complex itinerary editor.

## 2. Background

Foreign travelers visiting China often need execution-level help before and during the trip:

- Which payment setup works.
- How to use transport and ride-hailing.
- Which apps, SIM, eSIM, or VPN setup they need.
- What Chinese text to show staff.
- How to handle urgent travel problems.

Generic AI tools can answer these questions, but the MVP tests whether a focused China travel assistant with clear entry points, chat history, and shareable answers creates a stronger user loop.

## 3. Phase Goal

Phase 1 prioritizes product function validation.

Primary validation points:

- Whether users ask their first China travel question.
- Whether AI answers feel clear, practical, and useful.
- Whether users continue asking follow-up questions.
- Whether users copy or share answers.
- Whether new users ask their own questions from a shared answer page.

Vibcoding is included as a project foundation, but only as lightweight directories, baseline skills, prompts, and fixtures.

## 4. Product Scope

Phase 1 includes:

- Independent Next.js project initialization.
- Home page.
- Classic question entry points.
- Chat detail page.
- AI answer generation.
- Follow-up questions.
- Chat history.
- New chat.
- Google login.
- User avatar and logout.
- Share answer.
- Copy answer.
- Public share page.
- English default answers; Chinese language switch UI is temporarily hidden for launch.
- Responsive layout.
- AI usage logs.
- Docker PostgreSQL for local development.
- Prisma schema planning.
- Vibcoding directories.
- Baseline skills for UI, API, AI, data, and QA rules.

The MVP has three core pages:

```text
/
Home

/chat/:chatId
Chat detail

/share/:shareId
Public share page
```

## 5. User Experience

### 5.1 Home Question Flow

The home page includes:

- Logo / product name.
- English UI by default.
- Google login entry.
- Hero visual direction.
- Headline.
- Subtitle.
- Question input.
- Ask AI button.
- Classic questions.
- Footer.

Submit behavior:

- Empty input cannot submit.
- Enter submits.
- Shift + Enter inserts a new line.
- Submitting creates a chat and the first user message.
- Successful creation navigates to `/chat/:chatId`.
- The chat page generates the first AI answer.

### 5.2 Chat Flow

The chat page includes:

- Sidebar.
- New Chat.
- Chat History.
- User Area.
- Chat Header.
- Message List.
- Chat Input.
- Share / Copy actions.

Message behavior:

- User messages align right.
- AI messages align left.
- AI messages show Share / Copy actions.
- AI generation shows a loading state.
- Long conversations use a virtualized message list.

AI answer style:

- Direct answer.
- Practical steps when useful.
- Things to watch out for.
- Useful Chinese phrases when useful.
- Quick summary when useful.

### 5.3 Share Flow

The share page shows one question-answer pair, not the full chat transcript.

It includes:

- Header.
- Original Question.
- AI Answer.
- Created Date.
- Ask your own question CTA.
- Question input.
- Footer.

Submitting a question from the share page creates a new chat and navigates to `/chat/:chatId`.

## 6. Functional Requirements

### 6.1 Home Page

- Desktop layout uses a centered hero, wide input, and classic questions that wrap horizontally.
- Mobile layout uses a single column, full-width input, and stacked classic questions.
- Classic question clicks fill the input or start the supported MVP flow according to the current implementation.

### 6.2 Chat Page

- Desktop sidebar is open by default.
- Desktop sidebar can be closed and reopened.
- When closed on desktop, the chat area fills the width.
- Mobile sidebar is hidden by default.
- Mobile sidebar opens as a drawer.
- Mobile drawer closes via close button or overlay.
- Selecting a history item on mobile closes the drawer.

### 6.3 Share Page

- Share does not require login in Phase 1.
- Share scope is a single question-answer pair.
- Copy answer uses the browser Clipboard API and does not call the backend.
- Share page visitors can ask their own question and start a new chat.

### 6.4 Auth

- Google login can be triggered from the header or sidebar user area.
- After login, the header or sidebar shows the avatar.
- Logged-in users can view profile-owned chat history.
- Anonymous chat migration after login is deferred, but the data model preserves `anonymous_id`.

## 7. Data / Technical Requirements

Phase 1 uses:

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Supabase Auth.
- PostgreSQL.
- Prisma.
- React Query.
- AI Provider Service.

Core data tables:

- `profiles`
- `anonymous_sessions`
- `chats`
- `messages`
- `shared_answers`
- `ai_usage_logs`

AI generation rules:

- All model calls go through the AI Provider Service.
- AI usage logs record provider, model, tokens, latency, success state, fallback use, and error information when possible.
- Answers default to English.

## 8. Non-functional Requirements

- Responsive layout must work on desktop and mobile.
- Chat and share flows should remain usable for anonymous users.
- AI generation failures should produce a clear failed assistant message state.
- The product should remain focused on practical travel execution rather than broad travel inspiration.
- The database model should allow future guest-to-user chat migration.

## 9. Acceptance Criteria

- A user can submit a question from the home page.
- The app creates a chat and first user message.
- The chat page generates the first AI answer.
- A user can ask follow-up questions.
- Chat history shows recent chats.
- A user can start a new chat.
- A user can copy an AI answer.
- A user can share one question-answer pair.
- A public share page can be opened without login.
- A share page visitor can ask a new question.
- Google login updates the user area.
- AI usage logs are written for successful and failed requests when possible.
- Desktop and mobile layouts do not block the core loop.

## 10. Out of Scope

Phase 1 does not include:

- Guest 3-question limit.
- Logged-in user 5-question limit.
- Credits.
- Payment or recharge.
- Upgrade page.
- Save answer.
- Saved answers page.
- Saved answer management.
- RAG.
- pgvector.
- Maps.
- Attraction detail pages.
- Complex itinerary editor.
- Image recognition.
- Voice input.
- PDF export.
- Native client app.
- Complex agents.
- Full multi-model evaluation platform.

## 11. Implementation Order

Recommended Phase 1 sequence:

```text
1. Confirm documentation baseline
2. Implement Prisma schema and local migration
3. Implement home page
4. Implement chat page shell
5. Implement API routes with mock AI
6. Implement real AI Provider Service
7. Implement copy and share flows
8. Implement Google login
9. Add AI usage logs
10. Add baseline Vibcoding directories, prompts, fixtures, and skills
```
