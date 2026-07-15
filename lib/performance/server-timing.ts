type TimingValue = number | null | undefined;

function sanitizeDuration(value: TimingValue) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

/**
 * Creates a standards-compliant Server-Timing value without exposing request
 * payloads, account identifiers, or provider responses.
 */
export function createServerTiming(
  timings: Record<string, TimingValue>,
) {
  return Object.entries(timings)
    .map(([name, duration]) => {
      const sanitized = sanitizeDuration(duration);

      return sanitized === null ? null : `${name};dur=${sanitized}`;
    })
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

export function logPerformance(event: string, timings: Record<string, TimingValue>) {
  console.info("performance_timing", {
    event,
    ...Object.fromEntries(
      Object.entries(timings).map(([name, duration]) => [
        name,
        sanitizeDuration(duration),
      ]),
    ),
  });
}
