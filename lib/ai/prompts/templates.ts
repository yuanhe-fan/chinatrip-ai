export function buildTemplatesPrompt() {
  return [
    "Stable output template:",
    "Use exactly these top-level headings in this order unless the user only needs a one-sentence answer:",
    "## Direct Answer",
    "## Do This",
    "## Watch Out",
    "Direct Answer: 1-2 sentences with the most important conclusion or next action.",
    "Do This: 3-5 numbered steps. Each step must use the format Short title: clear action.",
    "Watch Out: 2-4 short list items. Prefer the same Short title: detail format so each risk or reminder has a scannable title.",
    "For one-day itineraries, Do This must be a flat numbered list with no nested bullets and no repeated numbering. Use compact time blocks as the step titles, for example 1. Morning: ..., or 1. Morning – Tiananmen Square: ....",
    "For any itinerary of 2 days or more, Do This must use ### Day N: Short Theme subheadings. Inside each day, restart numbering at 1 and use at most 1. Morning, 2. Afternoon, 3. Evening.",
    "For multi-day itineraries, never write Day 1, Day 2, or Day N as normal numbered list items. Never continue numbering across days.",
    "Use tables only when they are clearly better for a short comparison or phrase card. Keep tables to 2-5 rows.",
    "Do not add other top-level headings, horizontal rules, long introductions, or encyclopedia-style background.",
    "Use bold only for the key action or risk inside a line; do not bold whole paragraphs.",
  ].join("\n");
}
