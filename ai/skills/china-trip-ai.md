# ChinaTrip AI Skill

## Applies To

- Prompt composition and PromptProfile changes.
- AI Provider Service and model routing.
- Streaming and non-streaming generation.
- RAG retrieval and fallback.
- Prompt versioning and AI usage logging.

## Required Reading

- `docs/product/phase-4-ai-automation.md`
- `docs/technical/prompt-version-and-answer-contract.md`
- `docs/technical/ai-evaluation-harness.md`

## Provider Rule

All visible travel answers must go through the shared AI Provider Service:

```ts
generateTravelAnswer({
  chatId,
  userMessage,
  language,
  history,
  metadata,
})
```

Streaming and non-streaming generation must use the same:

- Prompt composition.
- Prompt version.
- PromptProfile resolution.
- RAG retrieval.
- Visual and source metadata rules.

Do not call a model directly from a route or client component.

## Prompt Rule

The travel Prompt is composed from:

```text
Core Prompt
+ Pain Point Rules
+ Intent Classifier
+ Prompt Profile
+ Stable Output Template
+ Knowledge Context (optional)
+ Final Answer Contract
```

When Prompt behavior changes:

1. Decide whether `TRAVEL_ANSWER_PROMPT_VERSION` must increase.
2. Add the matching file under `ai/prompts/versions/`.
3. Add or update a Harness case.
4. Run smoke and the affected profile.
5. Run full for shared structure or RAG behavior changes.

Never change the version constant without a version document.

## Answer Rules

- Answer in the selected language.
- Write for foreign travelers who may lack Chinese identity, phone, bank, language, or app access.
- Resolve the immediate blocker before background.
- Prefer actions, fallbacks, and show-to-local text.
- Follow the profile-specific answer contract.
- Avoid generic travel inspiration.
- Do not fabricate live availability, prices, opening hours, current policy, or official links.
- Tell the traveler to verify time-sensitive details through an official channel.

## RAG Rule

- Prompt builders receive knowledge context; they do not query the database.
- Relevant retrieved knowledge takes priority over model memory.
- RAG failure must degrade to a normal answer without sources.
- Retrieval failure remains visible in internal metadata and Harness reports.
- Do not expose raw chunks, vectors, or similarity scores.
- Public source display is limited to three documents.

## Logging Rule

Every production AI request records:

- provider and model.
- prompt version.
- input and output tokens when available.
- latency and success.
- fallback use.
- error details for failed generation.
- PromptProfile and retrieval metadata when available.

Harness generation does not write Chat, Message, or AiUsageLog rows. It writes only Harness reports.

## Regression Rule

- New AI capability: add the case first.
- PromptProfile change: run that profile plus smoke.
- Shared Prompt, RAG, or model routing change: run full.
- Production issue: add a reproducing case before fixing it.
