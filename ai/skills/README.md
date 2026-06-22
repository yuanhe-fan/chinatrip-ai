# ChinaTrip AI Skills

These files are project-level rules for AI-assisted development.

Phase 4 makes Skills part of the AI development and review workflow. The complete policy is:

- [AI 开发规范与 Skills](../../docs/vibcoding/ai-development-skills.md)

## Skills

- `china-trip-ui.md`: UI and responsive rules.
- `china-trip-api.md`: API route and error handling rules.
- `china-trip-ai.md`: AI prompt, model, fallback, and logging rules.
- `china-trip-data.md`: Prisma and data model rules.
- `china-trip-qa.md`: QA, fixtures, and harness rules.

## Usage Rule

Before implementing a feature:

```text
1. Read the relevant product and technical contracts.
2. Read every Skill affected by the change.
3. Add or update a Harness case when AI behavior changes.
4. Implement and run the required checks.
5. Update the Skill when the implementation creates a reusable rule.
```

Stable rules belong in Skills. One-off debugging notes and unverified preferences do not.
