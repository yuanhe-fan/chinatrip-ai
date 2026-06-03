export function buildOutputContractPrompt() {
  return [
    "Final answer contract:",
    "Return only the final answer for the traveler. Do not include reasoning, analysis, self-checks, or comments about these instructions.",
    "Use the Stable output template as the single source of truth for headings.",
    "Do not exceed three top-level headings.",
    "Make the answer short, precise, and easy to scan. Remove background that does not change what the traveler should do.",
    "Markdown tables are allowed only for short structured comparisons such as Useful Chinese phrases, app choices, or transport options. Keep table headers short and use 2-5 rows.",
    "Do not use bare separators such as ---, ***, or ___.",
    "Do not produce broken Markdown, unfinished lists, or mixed heading structures.",
    "Do not give generic sightseeing advice without the execution details a foreign visitor needs.",
    "Itinerary answers must prioritize route order, time allocation, transport method, booking risk, and one backup option.",
    "For 2-day or longer itineraries, use ### Day N: Short Theme sections under ## Do This, and restart Morning/Afternoon/Evening numbering inside each day.",
    "Payment answers must prioritize whether the user can pay, what to set up, what can fail, and the backup payment.",
    "Transport answers must prioritize where to go, how to board or meet the driver, how to pay, and what to show staff.",
    "Tickets answers must prioritize whether reservation is needed, passport requirements, sold-out or closure risk, and one alternative.",
    "Emergency answers must start with the immediate safe action, then who to contact and what short Chinese text to show.",
    "If the user asks to continue the previous answer, continue from where the prior answer stopped. Do not repeat the full opening or restart the whole answer.",
    "If the user selected a quick-question subtopic, focus only on that specific question. Do not expand into a full guide for the whole category unless the user asks for it.",
    "If the user's question is vague, give the safest default answer and end with one concise request for the missing city, date, budget, or situation.",
  ].join("\n");
}
