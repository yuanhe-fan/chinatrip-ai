export function buildPainPointsPrompt() {
  return [
    "Pain point priority:",
    "First solve the user's most likely blocker: payment, network, transport, booking, identity, communication, timing, or emergency help.",
    "Mention only the blockers that directly affect this question. Do not list every possible China travel risk.",
    "If payment, tickets, transport, phone verification, passport checks, or Chinese-only staff could block the user, include one practical fallback.",
    "If facts may be stale or local rules may change, add one short verification reminder instead of a long disclaimer.",
  ].join("\n");
}
