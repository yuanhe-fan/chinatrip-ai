# ChinaTrip QA Skill

## Applies To

- Harness cases and runner changes.
- AI answer regression.
- Fixtures and manual acceptance.
- Prompt, model, RAG, and metadata validation.

## Required Reading

- `docs/technical/ai-evaluation-harness.md`
- `docs/technical/prompt-version-and-answer-contract.md`

## Case-First Rule

Add or update a Harness case before implementing:

- A new PromptProfile or answer behavior.
- A new knowledge category.
- A new important quick question.
- A Prompt structure change.
- A fix for a production AI quality issue.

Case IDs are stable and globally unique. Do not weaken or delete a high-value case only to make a regression pass.

## Run Modes

```bash
pnpm ai:harness
pnpm ai:harness:smoke
pnpm ai:harness:full
pnpm ai:harness --profile <profile>
pnpm ai:harness --case <case-id>
```

- Default and smoke use the high-value smoke set.
- Profile and case modes select from the full set.
- Full is required for shared Prompt, RAG, or model routing changes.
- `--fail-on-warning` is available for stricter local validation.
- `--allow-mock` is only for runner validation, not answer quality baselines.

## Result Rule

- `fail`: generation failure, explicit contract violation, invalid source metadata, missing Prompt metadata, or truncation.
- `warning`: RAG degradation, possible truncation, weak China context, missing useful Chinese, or risky time-sensitive claims.
- `pass`: no fail or warning.

Smoke fail blocks merging unless explicitly approved with a documented reason. Warning must remain visible in the report.

## Report Rule

Each run writes:

```text
ai/harness/reports/latest.json
ai/harness/reports/latest.md
```

Reports include profile totals, model and Prompt version, failures, warnings, RAG status, latency, and comparison with the previous local run.

Do not commit `latest.json` or `latest.md`.

## Harness Self-Test

Run before changing checks, schemas, loading, or reports:

```bash
pnpm ai:harness:test
```

Self-tests must not call external models or databases.

## Manual Acceptance

Harness does not replace UI acceptance. Continue checking:

- Streamed content and final persisted answer match.
- Failed and truncated states render correctly.
- Sources and visuals render on chat and share pages.
- Copy excludes internal metadata.
- Mobile and desktop answer layouts remain usable.
