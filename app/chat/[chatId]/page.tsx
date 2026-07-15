import type { Metadata } from "next";
import { ChatView } from "@/features/chat/ChatView";
import { isDatabaseUnavailableError } from "@/lib/api/server";
import { getCurrentIdentity } from "@/lib/auth/current-identity";
import { getChatPageInitialData } from "@/lib/chat/read";
import type { ChatHistoryResponse, MeResponse } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Chat",
  robots: {
    index: false,
    follow: false,
  },
};

const EMPTY_HISTORY: ChatHistoryResponse = {
  chats: [],
  nextCursor: null,
};

const ANONYMOUS_VIEWER: MeResponse = {
  user: null,
  anonymous: {
    id: "",
  },
};

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  let initialHistory = EMPTY_HISTORY;
  let initialDetail = null;
  let initialMe = ANONYMOUS_VIEWER;

  try {
    const identity = await getCurrentIdentity();
    const initialData = await getChatPageInitialData(chatId, identity);
    initialHistory = initialData.history;
    initialDetail = initialData.detail;
    initialMe = {
      user: identity.profile
        ? {
            id: identity.profile.id,
            email: identity.profile.email,
            name: identity.profile.name,
            avatarUrl: identity.profile.avatarUrl,
            locale: identity.profile.locale,
          }
        : null,
      anonymous: {
        id: identity.anonymousSession?.anonymousId ?? "authenticated",
      },
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    console.error("Chat server prefetch unavailable; using client fallback", {
      chatId,
    });
  }

  return (
    <ChatView
      chatId={chatId}
      initialDetail={initialDetail}
      initialHistory={initialHistory}
      initialMe={initialMe}
    />
  );
}
