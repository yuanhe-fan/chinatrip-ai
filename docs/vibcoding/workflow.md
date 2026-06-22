# ChinaTrip AI Vibcoding Workflow

## Positioning

Vibcoding is part of the ChinaTrip AI engineering workflow. Phases 1-3 established the product, prompt profile, answer rendering, AI provider, and RAG foundations. Phase 4 turns the reserved Harness, Prompt, and Skills directories into an executable quality system.

The detailed Phase 4 workflow is defined in:

- [AI 开发规范与 Skills](ai-development-skills.md)
- [AI 评测 Harness 技术规范](../technical/ai-evaluation-harness.md)
- [Prompt 版本与回答契约](../technical/prompt-version-and-answer-contract.md)

## Current Workflow

For every meaningful feature:

```text
1. Check product docs.
2. Check technical contracts.
3. Check relevant skill.
4. Add or update a Harness case when AI behavior changes.
5. Implement the smallest functional slice.
6. Run the required checks.
7. Update Prompt version, docs, fixtures, or Skills when behavior changes.
```

## Evaluation Levels

```text
Small AI change
→ smoke

PromptProfile change
→ affected profile + smoke

Shared Prompt, RAG, or model routing change
→ full
```

## Rules

- Do not treat skills as decorative docs. Use them before implementation.
- Do not let implementation drift from product scope.
- Do not expose model API keys to client components.
- Do not claim real-time policy or price accuracy unless backed by a verified source.
- Do not change core Prompt behavior without a version decision and evaluation case.
- Do not weaken a high-value Harness case only to make a regression pass.
- RAG failures must degrade to a normal answer and remain visible in internal metadata.

## Directory Purposes

```text
docs/product
Product scope, copywriting, user flows.

docs/technical
Stack, API, database, local development.

docs/vibcoding
Development workflow and AI collaboration rules.

ai/prompts
System prompt and answer style constraints.

ai/fixtures
Classic questions and mock chat examples.

ai/harness
Executable AI behavior checks and quality reports.

ai/skills
Project-level implementation and review rules.
```
