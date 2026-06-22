# ChinaTrip AI Harness

The Harness is the Phase 4 automated quality system for AI answers.

## Goal

It verifies whether AI answers follow ChinaTrip AI product rules, Prompt contracts, and RAG expectations:

- Correct language.
- Practical answer.
- China-specific context.
- No fabricated real-time policy, prices, or official links.
- Useful Chinese phrases when relevant.
- Not overly long or generic.
- Stable Markdown structure.
- Required profile-specific content.
- Valid Prompt and retrieval metadata.

The complete technical specification is:

- [AI 评测 Harness 技术规范](../../docs/technical/ai-evaluation-harness.md)
- [四期 AI 自动化产品计划](../../docs/product/phase-4-ai-automation.md)

## Command Quick Reference

| Command | Purpose | Model / Data Behavior |
| --- | --- | --- |
| `pnpm ai:harness` | Run the 12-case smoke suite | Uses the real Provider from `.env.local` |
| `pnpm ai:harness:smoke` | Explicitly run the smoke suite | Same as the default command |
| `pnpm ai:harness:full` | Run all 32 cases across 9 PromptProfiles | Uses the real Provider and has higher cost |
| `pnpm ai:harness --profile payment_survival` | Run every case for one profile | Uses the real Provider |
| `pnpm ai:harness --case <case-id>` | Run one case for debugging or fix verification | Uses the real Provider |
| `pnpm ai:harness:test` | Test schemas, checks, CLI, preflight, and reports | Does not call a model or database |

Profile and case filters select from the full suite, not only the smoke IDs.

## Options

| Option | Purpose |
| --- | --- |
| `--fail-on-warning` | Return a non-zero exit code when any warning exists |
| `--concurrency 2` | Run two cases concurrently; default is 1 and maximum is 8 |
| `--allow-mock` | Permit mock execution for runner validation only |
| `AI_PROVIDER=mock` | Temporarily select mock; must be combined with `--allow-mock` |

`--allow-mock` validates runner behavior only. Mock answers are not a quality baseline.

Examples:

```bash
pnpm ai:harness --profile itinerary_planning --fail-on-warning
pnpm ai:harness:full --concurrency 2
AI_PROVIDER=mock pnpm ai:harness --case payment-foreign-card-setup --allow-mock
```

## External Calls And Cost

All evaluation commands except `pnpm ai:harness:test` send the case question, current project Prompt, optional history, and relevant RAG context to the configured Provider.

- Confirm that the Provider is approved to receive this project content.
- Smoke normally makes 12 model calls.
- Full normally makes 32 model calls.
- Full is intended for shared AI behavior changes or scheduled review, not ordinary CI.
- If RAG is unavailable, answer generation continues and the report records a warning.

## Coverage

- `payment_survival`
- `internet_apps`
- `transport_workflow`
- `tickets_booking`
- `emergency_help`
- `itinerary_planning`
- `language_cards`
- `food_ordering`
- `general_travel`

The full suite contains 32 cases. The smoke suite references 12 high-value cases without duplicating case content.

## Output

```text
ai/harness/reports/latest.json
ai/harness/reports/latest.md
```

Results use `pass`, `warning`, and `fail`. Static contract checks are primary; optional LLM Judge results do not block CI by default.

Exit behavior:

- Any fail returns a non-zero exit code.
- Warning-only runs return zero unless `--fail-on-warning` is set.
- Reports are written before a completed run returns its result.

Generated `latest.json` and `latest.md` are ignored by Git.
