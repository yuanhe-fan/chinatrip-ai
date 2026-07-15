import { NextResponse } from "next/server";

const METRICS = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !METRICS.has((payload as { name?: string }).name ?? "") ||
    !RATINGS.has((payload as { rating?: string }).rating ?? "") ||
    typeof (payload as { value?: unknown }).value !== "number" ||
    !Number.isFinite((payload as { value: number }).value) ||
    typeof (payload as { route?: unknown }).route !== "string"
  ) {
    return new NextResponse(null, { status: 204 });
  }

  const route = (payload as { route: string }).route.slice(0, 160);
  const country = request.headers.get("x-vercel-ip-country") ?? "unknown";
  const device = request.headers.get("sec-ch-ua-mobile") === "?1" ? "mobile" : "desktop";

  console.info("web_vital", {
    name: (payload as { name: string }).name,
    value: Math.round((payload as { value: number }).value * 100) / 100,
    rating: (payload as { rating: string }).rating,
    route,
    country,
    device,
    navigationType: (payload as { navigationType?: string }).navigationType ?? "unknown",
  });

  return new NextResponse(null, { status: 204 });
}
