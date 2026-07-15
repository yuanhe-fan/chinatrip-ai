"use client";

import { useReportWebVitals } from "next/web-vitals";

const SAMPLE_RATE = 0.1;
const SUPPORTED_METRICS = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!SUPPORTED_METRICS.has(metric.name) || Math.random() > SAMPLE_RATE) {
      return;
    }

    void fetch("/api/metrics", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        route: window.location.pathname,
        navigationType: metric.navigationType,
      }),
    }).catch(() => {
      // Telemetry must never affect the visitor experience.
    });
  });

  return null;
}
