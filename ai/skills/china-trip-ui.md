# ChinaTrip UI Skill

## Applies To

- Home, chat, and share pages.
- AI answer Markdown rendering.
- Streaming, failed, and truncated states.
- Sources, visuals, copy, and share behavior.

## Product Rules

- Build the usable travel assistant, not a marketing-only page.
- Keep the primary workflow focused on asking and acting on a China travel question.
- Support desktop and mobile without clipping or horizontal overflow.
- Use the existing Tailwind and Lucide patterns.

## Answer Contract

The default AI answer uses:

```markdown
## Direct Answer
## Do This
## Watch Out
```

The renderer must support:

- paragraphs and subheadings.
- ordered and unordered lists.
- short comparison and phrase tables.
- multi-day `### Day N: Short Theme` sections.
- approved embedded POI assets.

Do not silently depend on malformed Markdown. Prompt and Harness rules should prevent broken headings, repeated numbering, and unfinished lists.

## Message States

- `loading`: show stable progress without layout jumps.
- `complete`: render answer, visuals, sources, and actions.
- `failed`: show the public error and allow a safe retry path.
- `truncated`: offer continuation without duplicating the whole answer.
- `maybeTruncated`: preserve metadata and show continuation when appropriate.

Streaming text and the final persisted answer must converge to the same visible content.

## Sources And Visuals

- Sources display only when present.
- Show at most three sources.
- Do not display raw chunk text, vector data, or similarity score.
- Chat and share pages use the same source and visual metadata rules.
- Images come from the approved asset registry; model-generated URLs are not trusted.
- Copy copies answer text only.
- Share preserves answer text, approved visuals, and sources.

## Responsive QA

Check at minimum:

- 390px mobile.
- 768px tablet.
- 1440px desktop.

Verify:

- answer headings and lists do not overflow.
- source labels wrap.
- image grids and previews remain usable.
- copy/share/continue actions fit narrow screens.
- the chat input remains usable during long answers.

## Change Rule

When answer parsing or rendering changes:

- Confirm compatibility with the Prompt answer contract.
- Add or update structural Harness cases.
- Verify chat and share pages.
- Update this Skill when a new renderer constraint becomes reusable.
