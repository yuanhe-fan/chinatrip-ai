"use client";

import { Mail, X } from "lucide-react";
import Image from "next/image";
import { MouseEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function GoogleLogo() {
  return (
    <svg
      className="h-5.5 w-5.5 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.64 12.2c0-.82-.07-1.6-.2-2.36H12v4.46h6.54c-.28 1.5-1.14 2.78-2.43 3.64v2.98h3.94c2.3-2.12 3.59-5.24 3.59-8.72Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.94-2.98c-1.09.73-2.49 1.16-4.01 1.16-3.08 0-5.7-2.08-6.64-4.88H1.29v3.07C3.27 21.35 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.36 14.39A7.2 7.2 0 0 1 4.98 12c0-.83.14-1.64.38-2.39V6.54H1.29A11.94 11.94 0 0 0 0 12c0 1.94.46 3.78 1.29 5.46l4.07-3.07Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.73c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.15 15.23 0 12 0 7.31 0 3.27 2.65 1.29 6.54l4.07 3.07C6.3 6.81 8.92 4.73 12 4.73Z"
      />
    </svg>
  );
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) {
    return null;
  }

  function handleDialogClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function handleClose() {
    setIsGoogleLoading(false);
    onClose();
  }

  async function handleGoogleLogin() {
    if (isGoogleLoading) {
      return;
    }

    setIsGoogleLoading(true);
    const supabase = createSupabaseBrowserClient();
    const nextPath = `${window.location.pathname}${window.location.search}`;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath,
          )}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Failed to start Google login", error);
      setIsGoogleLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/58 px-4 py-6 backdrop-blur-[1px]"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="relative max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[30rem] overflow-y-auto rounded-[1.35rem] border border-slate-200/80 bg-white px-5 pb-7 pt-12 text-center text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.30)] sm:px-10 sm:pb-9 sm:pt-11"
        onClick={handleDialogClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label="Close login modal"
        >
          <X className="h-6 w-6" strokeWidth={2.2} />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_4px_18px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80">
          <Image
            src="/logo-96.webp"
            alt="ChinaTrip AI logo"
            width={58}
            height={58}
            priority
            className="h-[58px] w-[58px] rounded-full object-cover"
          />
        </div>

        <h2
          id="login-modal-title"
          className="mt-6 text-[1.35rem] font-bold leading-8 tracking-normal text-slate-950 sm:text-[1.45rem]"
        >
          Welcome to ChinaTrip AI
        </h2>
        <p className="mt-3 text-[0.92rem] leading-6 text-slate-600 sm:text-[0.95rem]">
          Log in to save your chats and personalize your travel guide.
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="mt-7 flex h-[3.55rem] w-full items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white px-4 text-[1.08rem] font-medium text-slate-950 shadow-[0_3px_14px_rgba(15,23,42,0.10)] transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
        >
          <GoogleLogo />
          <span className="truncate">Continue with Google</span>
          {isGoogleLoading ? (
            <span
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-amber-400"
              aria-hidden="true"
            />
          ) : null}
        </button>

        <div className="my-7 flex items-center gap-4 text-sm font-medium text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          <span>or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          disabled
          className="flex h-[3.55rem] w-full cursor-not-allowed items-center justify-center gap-4 rounded-xl bg-[#f1f5ff] px-4 text-[1.08rem] font-medium text-[#1359b7] opacity-90"
          aria-disabled="true"
        >
          <Mail className="h-5 w-5 shrink-0 text-[#2c8df2]" strokeWidth={2.2} />
          <span className="truncate">Continue with Email</span>
        </button>

        <p className="mt-7 text-xs leading-5 text-slate-500 sm:text-[0.8rem]">
          By continuing, you agree to our{" "}
          <a
            href="#"
            className="font-medium text-[#0b66f0] transition hover:text-[#084db5]"
          >
            Terms of Use
          </a>{" "}
          and{" "}
          <a
            href="#"
            className="font-medium text-[#0b66f0] transition hover:text-[#084db5]"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
