"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { UserProfileAvatar } from "@/components/UserProfileAvatar";
import { useCurrentUser } from "@/features/auth/use-current-user";

const LoginModal = dynamic(
  () => import("@/components/LoginModal").then((module) => module.LoginModal),
  { ssr: false },
);

export function HomeAccountControls() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user, isLoadingUser } = useCurrentUser();

  return (
    <>
      <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
        {isLoadingUser ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 p-1 ring-1 ring-white/25 backdrop-blur-md sm:w-[10.5rem] sm:justify-start sm:gap-2 sm:py-1.5 sm:pl-2 sm:pr-4"
            aria-label="Loading account"
          >
            <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/30" />
            <span className="hidden h-3 w-24 animate-pulse rounded-full bg-white/20 sm:block" />
          </div>
        ) : user ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 p-1 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-md sm:w-auto sm:justify-start sm:gap-2 sm:py-1.5 sm:pl-2 sm:pr-4">
            <UserProfileAvatar
              avatarUrl={user.avatarUrl}
              name={user.name}
              email={user.email}
              size={28}
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/45"
              fallbackClassName="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/18 text-xs font-bold text-white ring-1 ring-white/45"
            />
            <span className="hidden max-w-36 truncate sm:inline">
              {user.name ?? user.email ?? "Signed in"}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 sm:px-5"
          >
            Log in
          </button>
        )}
      </nav>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
