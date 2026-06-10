"use client";

import type { AnswerSource } from "@/lib/api/types";

const MAX_VISIBLE_SOURCES = 3;

function formatCategoryLabel(category: string) {
  return category
    .split("_")
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part,
    )
    .join(" ");
}

function formatSourceDate(value: string | null) {
  if (!value) {
    return "Updated date unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated date unknown";
  }

  return `Updated ${new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(date)}`;
}

export function AnswerSources({ sources }: { sources?: AnswerSource[] }) {
  const visibleSources = sources?.slice(0, MAX_VISIBLE_SOURCES) ?? [];

  if (visibleSources.length === 0) {
    return null;
  }

  return (
    <aside className="rounded-xl border border-sky-200/85 bg-[#F3FAFC] px-3.5 py-3 text-[#26384D] shadow-[0_8px_18px_rgba(14,116,144,0.07),0_1px_0_rgba(255,255,255,0.86)_inset]">
      <ul className="space-y-2">
        {visibleSources.map((source) => (
          <li
            key={source.id}
            className="min-w-0 border-t border-sky-200/70 pt-2 first:border-t-0 first:pt-0"
          >
            <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold leading-5 text-slate-600">
              <span className="inline-flex items-center rounded-full bg-sky-700 px-2 py-0.5 text-[0.68rem] font-extrabold leading-4 text-white shadow-[0_4px_10px_rgba(14,116,144,0.16)]">
                Knowledge source
              </span>
              <span className="break-words [overflow-wrap:anywhere]">
                {formatCategoryLabel(source.category)} ·{" "}
                {formatSourceDate(source.updatedAt)}
              </span>
            </span>
            <span className="mt-1 block break-words text-sm font-semibold leading-5 text-[#14243A] [overflow-wrap:anywhere]">
              {source.title}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
