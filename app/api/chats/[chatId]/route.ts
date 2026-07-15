import { NextResponse } from "next/server";
import { apiError, isDatabaseUnavailableError } from "@/lib/api/server";
import { getCurrentIdentity } from "@/lib/auth/current-identity";
import { isUuid } from "@/lib/chat/message-generation";
import { readChatDetail } from "@/lib/chat/read";
import { createServerTiming, logPerformance } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();
  const { chatId } = await context.params;

  if (!isUuid(chatId)) {
    return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
  }

  try {
    const authStartedAt = Date.now();
    const identity = await getCurrentIdentity();
    const authMs = Date.now() - authStartedAt;
    const dbStartedAt = Date.now();
    const { searchParams } = new URL(request.url);
    const response = await readChatDetail(chatId, identity, {
      limit: searchParams.get("limit"),
      before: searchParams.get("before"),
    });
    const dbMs = Date.now() - dbStartedAt;

    if (!response) {
      return apiError("CHAT_NOT_FOUND", "Chat not found.", 404);
    }
    const totalMs = Date.now() - startedAt;
    logPerformance("chat_detail", { authMs, dbMs, totalMs });

    return NextResponse.json(response, {
      headers: {
        "Server-Timing": createServerTiming({ auth: authMs, db: dbMs, total: totalMs }),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to get chat detail", error);

    if (isDatabaseUnavailableError(error)) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "Database is unavailable. Please try again later.",
        503,
      );
    }

    return apiError("INTERNAL_ERROR", "Failed to load chat.", 500);
  }
}
