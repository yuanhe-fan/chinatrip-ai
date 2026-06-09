# ChinaTrip AI Phase 2 Product Plan: Answer Experience

## 1. Summary

Phase 2 upgrades ChinaTrip AI from a general China travel Q&A assistant into a faster, more practical, visual execution assistant for foreign travelers visiting China.

Phase 2 focuses on five product areas:

- Upstash Redis for faster high-frequency read APIs.
- A refreshed home page question set based on real foreign-traveler pain points.
- Specialized prompt profiles for quick questions, plus a general fallback profile for free-form questions.
- A static image library that can be matched to AI answers through approved asset ids.
- A richer AI answer module that supports text, images, step cards, Chinese phrase cards, warning cards, and backup-plan cards.

## 2. Background

Phase 1 proves the core product loop:

```text
Home question
→ Chat page
→ AI answer
→ Follow-up question
→ Copy or Share answer
→ New user asks from share page
```

After the MVP loop works, the product needs more practical answers, stronger entry points, faster repeated reads, and richer answer presentation. Phase 2 improves the user-facing answer experience without introducing a knowledge base or CMS.

## 3. Phase Goal

Phase 2 goal:

- Make common China travel questions easier to start from the home page.
- Route questions into more specific prompt profiles.
- Improve answer structure for real foreign-traveler pain points.
- Add approved static visuals without letting the model invent image URLs.
- Cache high-frequency read APIs without making Redis a hard dependency.

## 4. Product Scope

Phase 2 includes:

- Six home classic questions.
- Prompt profile routing.
- Quick-question submenu support for itinerary and pain-point follow-ups.
- Upstash Redis cache for selected read APIs.
- Static answer asset registry.
- Server-side visual matching.
- AI answer UI support for images and structured visual cards.
- Share page support for visual answers.

Phase 2 keeps the app browser-based and does not add a new major product surface.

## 5. User Experience

### 5.1 Home Classic Questions

The home page keeps six classic question entries. Clicking a classic question only fills the input. It does not create a chat. The user still creates a chat by clicking Ask AI or pressing Enter.

If the submitted text exactly matches a quick question, the app sends the matching `promptProfile` and `sourceQuestionId`. If the user edits the text before submitting, the message is treated as a free-form question and classified by intent.

| Label | Question | Subtitle | Prompt Profile |
| --- | --- | --- | --- |
| Payment | What should I do if I cannot pay after arriving in China? | Alipay, WeChat Pay, cards, cash backup | `payment_survival` |
| Itinerary Planning | Can you help me plan a simple one-day China itinerary? | Beijing, Shanghai, Chengdu, Xi'an, custom plan | `itinerary_planning` |
| Internet & Apps | Which apps, SIM, eSIM, and VPN setup do I need before going to China? | Apps, mobile data, blocked services | `internet_apps` |
| Transport | How do I use airports, metro, taxis, Didi, and high-speed trains in China? | Airport, metro, taxi, Didi, rail | `transport_workflow` |
| Tickets & Booking | Can I visit attractions directly, or do I need reservations and passport booking? | Reservations, passport, closed days | `tickets_booking` |
| Emergency | What should I do if I lose my passport, phone, payment access, or need medical help in China? | Passport, phone, hospital, emergency phrases | `emergency_help` |

Home page requirements:

- Desktop and mobile layouts must show all six entries without text overflow.
- Cards show label and subtitle.
- The selected question appears in the existing input.
- Chat creation behavior remains unchanged until the user submits the input.
- `Language` is no longer a home page entry, but `language_cards` remains available for free-form communication questions.
- Food remains supported for free-form questions, but it is not a home page entry in this phase.

### 5.2 Itinerary Menu

Itinerary menu questions:

- `Plan a one-day Beijing itinerary for a first-time visitor.`
- `Plan a one-day Shanghai itinerary for a first-time visitor.`
- `Plan a one-day Chengdu itinerary for a first-time visitor.`
- `Plan a one-day Xi'an itinerary for a first-time visitor.`
- `Help me create a custom China travel plan.`

### 5.3 Visual Answer Experience

AI answers may include text, approved images, phrase cards, warning cards, backup cards, and checklist cards.

Rendering requirements:

- Mobile: stack images above text, single-column cards, no text overflow.
- Desktop: support hero image, inline images, embedded POI thumbnails inside itinerary steps, side-by-side image/text layouts, and 2-4 image grids.
- Itinerary POI images should appear close to the matching route item when possible, with click-to-enlarge preview.
- Copy action copies text only.
- Share action preserves text and visual metadata.
- Chat page and share page use the same answer rendering rules.

## 6. Functional Requirements

### 6.1 Prompt Profiles

Phase 2 keeps the current core prompt system but adds profile-specific prompt packets.

Prompt composition:

```text
Core Prompt
+ Pain Point Rules
+ Intent Classifier
+ Prompt Profile
+ Output Contract
```

Prompt profile type:

```ts
type PromptProfile =
  | "payment_survival"
  | "internet_apps"
  | "transport_workflow"
  | "tickets_booking"
  | "language_cards"
  | "itinerary_planning"
  | "food_ordering"
  | "emergency_help"
  | "general_travel";
```

Routing rules:

- Exact quick-question submission uses the quick question's `promptProfile`.
- Edited quick-question text is treated as free-form input.
- Free-form input is classified by intent.
- If intent matches one of the supported pain-point profiles, use that profile.
- If intent does not match, use `general_travel`.

Profile requirements:

- `payment_survival`: cover payment failure, Alipay, WeChat Pay, foreign cards, cash backup, deposits, and show-to-staff Chinese.
- `internet_apps`: cover app setup, SIM, eSIM, roaming, VPN reminders, SMS verification, offline maps, and translation backup.
- `transport_workflow`: cover airports, metro, taxis, Didi, high-speed rail, pickup points, Chinese addresses, and staffed-counter fallback.
- `tickets_booking`: cover reservations, passport booking, real-name rules, closed days, capacity limits, and alternative attractions.
- `language_cards`: produce Chinese text cards for drivers, hotels, restaurants, ticket counters, and basic help.
- `itinerary_planning`: organize routes by distance, timing, pace, transport risk, reservation risk, and backup routes.
- `food_ordering`: cover food suggestions, non-spicy options, scan ordering, allergies, vegetarian needs, and dietary restrictions.
- `emergency_help`: cover passport loss, phone loss, payment loss, hospitals, police, embassy help, and safety-first action steps.
- `general_travel`: answer random travel questions and switch into a specialized profile when the user's intent clearly matches one of the supported categories.

### 6.2 Upstash Redis

Phase 2 uses Upstash Redis as a cache layer for Vercel serverless routes. Supabase PostgreSQL remains the source of truth.

Environment variables:

```env
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

Client rules:

- If Redis environment variables are missing, Redis is disabled.
- Redis read failures fall back to database queries.
- Redis write failures are ignored.
- Redis must never block the core product loop.

Cache targets:

| API | TTL | Key |
| --- | --- | --- |
| `GET /api/chats` | 30-60 seconds | `chat-history:profile:{profileId}:limit:{limit}` |
| `GET /api/chats` | 30-60 seconds | `chat-history:anonymous:{anonymousSessionId}:limit:{limit}` |
| `GET /api/share/:shareId` | 10 minutes | `share:{shareId}` |

Invalidation rules:

- New chat creation deletes the owner's chat-history cache.
- New user message deletes the owner's chat-history cache.
- Assistant answer completion deletes the owner's chat-history cache.
- Share revoke or share content update deletes `share:{shareId}`.

Do not cache:

- AI streaming response bodies.
- Supabase session or token data.
- Full private chat detail.
- Logged-in `/api/me` responses.

### 6.3 Static Image Library

Phase 2 uses project-owned static images and a registry. It does not use a database-backed media library.

Directory structure:

```text
public/answer-assets/
  poi/
    beijing/
      tiananmen-square/
      forbidden-city/
      national-museum/
      temple-of-heaven/
      summer-palace/
      bird-nest/
      water-cube/
      great-wall/
  payment/
  internet/
  transport/
  tickets/
  language/
  emergency/
```

Registry type:

```ts
type AnswerAsset = {
  id: string;
  src: string;
  title: string;
  alt: string;
  category: PromptProfile | "city";
  city?: string;
  poi?: string;
  poiSlug?: string;
  role?: "cover" | "detail";
  priority?: number;
  tags: string[];
  aliases?: string[];
  sourceType: "owned" | "licensed" | "generated";
  credit?: string;
};
```

Image matching rules:

- `id` is stable and semantic, for example `poi:beijing:forbidden-city:1`.
- The image file path can change, but `id` should not change.
- AI must not return image URLs.
- AI may return visual intent or tags.
- Server-side code selects approved `assetId` values from the registry based on `promptProfile`, user question, tags, and answer context.
- Itinerary images use POI-level matching instead of one city route image.
- One POI can have multiple image assets.
- For `itinerary_planning`, server-side code matches POI tags against the generated answer, sorts matched POIs by first appearance in the answer, and selects one best asset per POI.
- If no image matches, render a text-only answer.

### 6.4 AI Answer UI Metadata

Visual metadata:

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

Profile-specific visual guidance:

- `payment_survival`: payment scene image and backup-payment warning card.
- `internet_apps`: app, eSIM, and offline-backup checklist.
- `transport_workflow`: airport, Didi, metro, and high-speed rail step cards.
- `tickets_booking`: reservation, passport-booking, and closed-day warning cards.
- `language_cards`: copyable Chinese phrase cards.
- `itinerary_planning`: POI images from `poi/{city}/{poiSlug}/` that match mentioned attractions.
- `food_ordering`: text and dietary phrase cards first; food images are deferred.
- `emergency_help`: emergency warning card, help phrase card, and action checklist.

## 7. Data / Technical Requirements

`CreateChatRequest` adds:

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

`messages.metadata` stores:

```ts
{
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
  visuals?: AnswerVisuals;
}
```

Phase 2 first implementation does not require a `shared_answers` migration. Share pages can reselect visuals from the stored question and answer.

`ai_usage_logs.metadata` may include:

```ts
{
  promptProfile?: PromptProfile;
  cacheHit?: boolean;
  selectedAssetIds?: string[];
}
```

## 8. Non-functional Requirements

- Redis must never block the core product loop.
- Missing Redis environment variables should produce normal database fallback behavior.
- Missing or unmatched image assets should degrade to text-only answers.
- Mobile and desktop answer layouts must avoid overlap and text overflow.
- AI must not fabricate image URLs.
- Policy-sensitive answers should ask users to verify current rules.

## 9. Acceptance Criteria

- Home page shows six classic questions.
- Clicking a quick question only fills the input.
- Ask AI or Enter creates the chat.
- Exact quick-question submissions include the correct `promptProfile` and `sourceQuestionId`.
- Edited quick-question text is treated as free-form input.
- Free-form input maps to a supported profile or `general_travel`.
- Upstash Redis caches `/api/chats` and `/api/share/:shareId`.
- Redis failure does not break any user flow.
- Static image registry and allowed directories exist, while missing assets degrade gracefully.
- Itinerary Planning replaces Language in the home quick question list and appears immediately after Payment.
- `language_cards` remains available for free-form communication questions.
- Itinerary image matching uses POI-level assets, not one whole-city route image.
- Chat page supports visual answers.
- Share page supports visual answer rendering.

Test plan:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm build
```

## 10. Out of Scope

Phase 2 does not include:

- Knowledge base.
- Vector database.
- RAG.
- CMS.
- User-uploaded images.
- Self-hosted or generic TCP Redis.
- External image search.
- User-uploaded images.

## 11. Implementation Order

Recommended Phase 2 sequence:

```text
1. Refresh home quick questions
2. Add quick-question metadata routing
3. Add prompt profile classification and profile prompts
4. Add Upstash Redis cache for selected read APIs
5. Add static answer asset registry
6. Add server-side visual matching
7. Extend AI answer metadata
8. Upgrade chat answer rendering
9. Upgrade share answer rendering
10. Verify prompt, Redis, image, and answer UI behavior
```
