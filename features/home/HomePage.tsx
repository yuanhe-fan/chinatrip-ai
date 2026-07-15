import Image from "next/image";
import Link from "next/link";
import { HomeAccountControls } from "@/features/home/HomeAccountControls";
import { HomeView } from "@/features/home/HomeView";

export function HomePage() {
  return (
    <main className="app-min-viewport relative overflow-hidden text-white">
      <div className="fixed inset-0 z-0 bg-black/20" aria-hidden="true" />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-black/60 via-transparent to-black/60"
        aria-hidden="true"
      />

      <div className="app-min-viewport app-safe-bottom app-safe-top relative z-10 flex flex-col px-4 sm:px-8 sm:py-6 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl text-white outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/50 sm:gap-3"
            aria-label="ChinaTrip AI home"
          >
            <Image
              src="/logo-96.webp"
              alt="ChinaTrip AI logo"
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0 rounded-full bg-white object-cover shadow-[0_0_15px_rgba(255,255,255,0.2)] sm:h-10 sm:w-10"
            />
            <span className="truncate text-xl font-medium tracking-tight text-white sm:text-[1.45rem] lg:text-[1.55rem]">
              ChinaTrip AI
            </span>
          </Link>
          <HomeAccountControls />
        </header>

        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center pb-20 pt-10 text-center sm:pt-16 lg:-mt-8 lg:pb-24">
          <h1 className="max-w-5xl text-balance text-[2.5rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[4.45rem] lg:text-[5.5rem]">
            Your AI Travel Guide for China
          </h1>
          <p className="mt-4 max-w-3xl text-[0.95rem] font-normal leading-relaxed text-white/80 sm:mt-6 sm:text-xl sm:leading-8">
            Ask practical questions about China travel, payments, transport,
            apps, food, and local tips. Get answers you can save and share.
          </p>
          <HomeView />
        </section>
      </div>
    </main>
  );
}
