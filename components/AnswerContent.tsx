"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { AnswerVisuals } from "@/lib/api/types";
import {
  getAnswerAsset,
  getPoiAssetGroup,
  type AnswerAsset,
} from "@/lib/answer-assets/registry";
export type { AnswerAsset } from "@/lib/answer-assets/registry";

type AnswerSection = {
  title: string | null;
  blocks: AnswerBlock[];
};

type NumberedGroupItem = {
  title: string;
  body: string[];
};

type AnswerBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "subheading"; title: string }
  | { type: "minorHeading"; title: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] }
  | { type: "numberedGroup"; items: NumberedGroupItem[] }
  | { type: "table"; headers: string[]; rows: string[][] };

type SectionTone = {
  label: string;
  title: string;
  marker: string;
  line: string;
  number: string;
  numberRing: string;
  softBg: string;
  border: string;
};

type EmbeddedAssetMatch = {
  asset: AnswerAsset;
  assetId: string;
};

type EmbeddedAssetCandidate = {
  asset: AnswerAsset;
  assetId: string;
  order: number;
  index: number;
  tagLength: number;
  sourceRank: number;
};

type EmbeddedItemText = {
  itemKey: string;
  primaryText: string;
  secondaryText?: string;
};

const SECTION_TONES: Record<string, SectionTone> = {
  direct: {
    label: "Direct Answer",
    title: "text-[#8A552B]",
    marker: "bg-[#D49A52]",
    line: "from-[#D49A52]/45",
    number: "text-[#8A552B]",
    numberRing: "border-[#E6D8C7] bg-[#FFF8EF]",
    softBg: "bg-[#FFF8EF]/55",
    border: "border-[#E6D8C7]/70",
  },
  steps: {
    label: "Practical Steps",
    title: "text-sky-700",
    marker: "bg-sky-500",
    line: "from-sky-300/70",
    number: "text-sky-700",
    numberRing: "border-sky-100 bg-sky-50",
    softBg: "bg-sky-50/55",
    border: "border-sky-100",
  },
  watch: {
    label: "Watch Outs",
    title: "text-amber-700",
    marker: "bg-amber-500",
    line: "from-amber-300/80",
    number: "text-amber-700",
    numberRing: "border-amber-100 bg-amber-50",
    softBg: "bg-amber-50/60",
    border: "border-amber-100",
  },
  phrases: {
    label: "Useful Phrases",
    title: "text-emerald-700",
    marker: "bg-emerald-500",
    line: "from-emerald-300/75",
    number: "text-emerald-700",
    numberRing: "border-emerald-100 bg-emerald-50",
    softBg: "bg-emerald-50/55",
    border: "border-emerald-100",
  },
  summary: {
    label: "Quick Summary",
    title: "text-indigo-700",
    marker: "bg-indigo-500",
    line: "from-indigo-300/75",
    number: "text-indigo-700",
    numberRing: "border-indigo-100 bg-indigo-50",
    softBg: "bg-indigo-50/55",
    border: "border-indigo-100",
  },
  general: {
    label: "",
    title: "text-[#8A552B]",
    marker: "bg-[#8A552B]",
    line: "from-[#E6D8C7]",
    number: "text-[#8A552B]",
    numberRing: "border-[#E6D8C7] bg-[#FFF8EF]",
    softBg: "bg-[#FFF8EF]/45",
    border: "border-[#E6D8C7]/65",
  },
};

function cleanInlineText(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .trim();
}

function normalizeAssetMatchText(value: string) {
  return cleanInlineText(value).toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTagIndex(text: string, tag: string) {
  if (!tag) {
    return -1;
  }

  if (/^[a-z0-9\s'-]+$/.test(tag)) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(tag)}([^a-z0-9]|$)`,
      "i",
    );
    const match = text.match(pattern);

    if (!match || match.index === undefined) {
      return -1;
    }

    return match.index + (match[1]?.length ?? 0);
  }

  return text.indexOf(tag);
}

function findEmbeddedAssetForText({
  primaryText,
  secondaryText = "",
  embeddedAssets,
}: {
  primaryText: string;
  secondaryText?: string;
  embeddedAssets: EmbeddedAssetMatch[];
}) {
  const normalizedPrimaryText = normalizeAssetMatchText(primaryText);
  const normalizedSecondaryText = normalizeAssetMatchText(secondaryText);
  return embeddedAssets
    .map(({ asset, assetId }, order) => {
      const tagMatches = asset.tags
        .flatMap((tag) => {
          const normalizedTag = normalizeAssetMatchText(tag);
          const primaryIndex = findTagIndex(normalizedPrimaryText, normalizedTag);
          const secondaryIndex = findTagIndex(
            normalizedSecondaryText,
            normalizedTag,
          );
          const matches: Array<{
            sourceRank: number;
            index: number;
            tagLength: number;
          }> = [];

          if (primaryIndex >= 0) {
            matches.push({
              sourceRank: 0,
              index: primaryIndex,
              tagLength: normalizedTag.length,
            });
          }

          if (secondaryIndex >= 0) {
            matches.push({
              sourceRank: 1,
              index: secondaryIndex,
              tagLength: normalizedTag.length,
            });
          }

          return matches;
        })
        .sort((left, right) => {
          if (left.sourceRank !== right.sourceRank) {
            return left.sourceRank - right.sourceRank;
          }

          if (left.tagLength !== right.tagLength) {
            return right.tagLength - left.tagLength;
          }

          return left.index - right.index;
        });

      const bestTagMatch = tagMatches[0];

      return bestTagMatch
        ? {
            asset,
            assetId,
            order,
            ...bestTagMatch,
          }
        : null;
    })
    .filter(
      (
        item,
      ): item is EmbeddedAssetCandidate => Boolean(item),
    )
    .sort((left, right) => {
      if (left.sourceRank !== right.sourceRank) {
        return left.sourceRank - right.sourceRank;
      }

      if (left.tagLength !== right.tagLength) {
        return right.tagLength - left.tagLength;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      return left.order - right.order;
    })[0];
}

function getEmbeddedItemTexts(sections: AnswerSection[]) {
  const itemTexts: EmbeddedItemText[] = [];

  sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      if (block.type === "ordered" || block.type === "unordered") {
        block.items.forEach((item, itemIndex) => {
          const { title, body } = splitItemTitle(item);

          itemTexts.push({
            itemKey: createEmbeddedItemKey(sectionIndex, blockIndex, itemIndex),
            primaryText: title ?? item,
            secondaryText: title ? body : "",
          });
        });
      }

      if (block.type === "numberedGroup") {
        block.items.forEach((item, itemIndex) => {
          const { title, body } = splitItemTitle(item.title);

          itemTexts.push({
            itemKey: createEmbeddedItemKey(sectionIndex, blockIndex, itemIndex),
            primaryText: title ?? item.title,
            secondaryText: [title ? body : "", ...item.body].join(" "),
          });
        });
      }
    });
  });

  return itemTexts;
}

function createEmbeddedItemKey(
  sectionIndex: number,
  blockIndex: number,
  itemIndex: number,
) {
  return `${sectionIndex}:${blockIndex}:${itemIndex}`;
}

function createEmbeddedAssetMap({
  sections,
  embeddedAssets,
}: {
  sections: AnswerSection[];
  embeddedAssets: EmbeddedAssetMatch[];
}) {
  const usedAssetIds = new Set<string>();
  const assetByItemKey = new Map<string, AnswerAsset>();

  getEmbeddedItemTexts(sections).forEach((item) => {
    const match = findEmbeddedAssetForText({
      primaryText: item.primaryText,
      secondaryText: item.secondaryText,
      embeddedAssets: embeddedAssets.filter(
        ({ assetId }) => !usedAssetIds.has(assetId),
      ),
    });

    if (!match) {
      return;
    }

    usedAssetIds.add(match.assetId);
    assetByItemKey.set(item.itemKey, match.asset);
  });

  return assetByItemKey;
}

function getEmbeddedAssetForItem({
  embeddedAssetByItemKey,
  sectionIndex,
  blockIndex,
  itemIndex,
}: {
  embeddedAssetByItemKey: Map<string, AnswerAsset>;
  sectionIndex: number;
  blockIndex: number;
  itemIndex: number;
}) {
  return (
    embeddedAssetByItemKey.get(
      createEmbeddedItemKey(sectionIndex, blockIndex, itemIndex),
    ) ?? null
  );
}

function splitItemTitle(item: string) {
  const separatorMatch = item.match(/^([^:：\n-]{2,48})(?:[:：]| - )\s+(.+)$/);

  if (!separatorMatch) {
    return {
      title: null,
      body: item,
    };
  }

  return {
    title: separatorMatch[1].trim(),
    body: separatorMatch[2].trim(),
  };
}

function isTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|") && line.includes("|");
}

function isTableSeparatorLine(line: string) {
  if (!isTableLine(line)) {
    return false;
  }

  return line
    .split("|")
    .slice(1, -1)
    .every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTableCells(line: string) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cleanInlineText(cell));
}

function getSectionKey(title: string | null) {
  const normalized = (title ?? "").toLowerCase();

  if (normalized.includes("direct")) {
    return "direct";
  }

  if (
    normalized.includes("do this") ||
    normalized.includes("step") ||
    normalized.includes("itinerary") ||
    normalized.includes("plan") ||
    normalized.includes("route")
  ) {
    return "steps";
  }

  if (
    normalized.includes("watch out") ||
    normalized.includes("watch") ||
    normalized.includes("warning") ||
    normalized.includes("note") ||
    normalized.includes("careful") ||
    normalized.includes("must handle") ||
    normalized.includes("foreign visitor") ||
    normalized.includes("backup") ||
    normalized.includes("fail")
  ) {
    return "watch";
  }

  if (normalized.includes("phrase") || normalized.includes("chinese")) {
    return "phrases";
  }

  if (normalized.includes("summary")) {
    return "summary";
  }

  return "general";
}

function parseBlocks(lines: string[]): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let ordered: string[] = [];
  let unordered: string[] = [];
  let numberedGroup: NumberedGroupItem[] = [];
  let table:
    | {
        headers: string[];
        rows: string[][];
        hasSeparator: boolean;
      }
    | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    }
  }

  function flushOrdered() {
    if (ordered.length > 0) {
      blocks.push({ type: "ordered", items: ordered });
      ordered = [];
    }
  }

  function flushNumberedGroup() {
    if (numberedGroup.length > 0) {
      if (
        numberedGroup.length === 1 &&
        numberedGroup[0].body.length === 0
      ) {
        ordered.push(numberedGroup[0].title);
      } else {
        blocks.push({ type: "numberedGroup", items: numberedGroup });
      }

      numberedGroup = [];
    }
  }

  function flushUnordered() {
    if (unordered.length > 0) {
      blocks.push({ type: "unordered", items: unordered });
      unordered = [];
    }
  }

  function flushTable() {
    if (table?.hasSeparator && table.headers.length > 0 && table.rows.length > 0) {
      blocks.push({
        type: "table",
        headers: table.headers,
        rows: table.rows,
      });
    } else if (table) {
      paragraph.push(
        ...[
          table.headers,
          ...table.rows,
        ].map((cells) => cells.join(" | ")),
      );
    }

    table = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushTable();
      flushNumberedGroup();
      flushOrdered();
      flushUnordered();
      flushParagraph();
      continue;
    }

    if (!line) {
      flushTable();
      flushUnordered();
      if (numberedGroup.length === 0) {
        flushOrdered();
        flushParagraph();
      }
      continue;
    }

    if (isTableLine(line)) {
      flushNumberedGroup();
      flushOrdered();
      flushUnordered();

      if (isTableSeparatorLine(line)) {
        if (table && table.headers.length > 0) {
          table.hasSeparator = true;
        }
        continue;
      }

      const cells = parseTableCells(line);

      if (!table) {
        flushParagraph();
        table = {
          headers: cells,
          rows: [],
          hasSeparator: false,
        };
      } else if (table.hasSeparator) {
        table.rows.push(cells);
      } else {
        table.rows.push(cells);
      }

      continue;
    }

    const minorHeadingMatch = line.match(/^####\s+(.+)$/);

    if (minorHeadingMatch) {
      flushTable();
      flushNumberedGroup();
      flushOrdered();
      flushUnordered();
      flushParagraph();
      blocks.push({
        type: "minorHeading",
        title: cleanInlineText(minorHeadingMatch[1]),
      });
      continue;
    }

    const subheadingMatch = line.match(/^###\s+(.+)$/);

    if (subheadingMatch) {
      flushTable();
      flushNumberedGroup();
      flushOrdered();
      flushUnordered();
      flushParagraph();
      blocks.push({
        type: "subheading",
        title: cleanInlineText(subheadingMatch[1]),
      });
      continue;
    }

    const orderedMatch = line.match(/^\d+[\.)]\s+(.+)$/);

    if (orderedMatch) {
      flushTable();
      flushParagraph();
      flushOrdered();
      flushUnordered();
      numberedGroup.push({
        title: cleanInlineText(orderedMatch[1]),
        body: [],
      });
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);

    if (unorderedMatch) {
      flushTable();
      flushNumberedGroup();
      flushParagraph();
      flushOrdered();
      unordered.push(cleanInlineText(unorderedMatch[1]));
      continue;
    }

    flushTable();
    flushUnordered();
    if (numberedGroup.length > 0) {
      numberedGroup[numberedGroup.length - 1].body.push(cleanInlineText(line));
      continue;
    }

    flushOrdered();
    paragraph.push(cleanInlineText(line));
  }

  flushTable();
  flushNumberedGroup();
  flushOrdered();
  flushUnordered();
  flushParagraph();

  return blocks;
}

function parseAnswerContent(content: string): AnswerSection[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ title: string | null; lines: string[] }> = [];
  let currentSection: { title: string | null; lines: string[] } = {
    title: null,
    lines: [],
  };

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^##\s+(.+)$/);

    if (headingMatch) {
      if (currentSection.title || currentSection.lines.some(Boolean)) {
        sections.push(currentSection);
      }

      currentSection = {
        title: cleanInlineText(headingMatch[1]),
        lines: [],
      };
      continue;
    }

    currentSection.lines.push(rawLine);
  }

  if (currentSection.title || currentSection.lines.some(Boolean)) {
    sections.push(currentSection);
  }

  return sections
    .map((section) => ({
      title: section.title,
      blocks: parseBlocks(section.lines),
    }))
    .filter((section) => section.blocks.length > 0);
}

function TypingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-[#8A552B]"
      aria-hidden="true"
    />
  );
}

function renderTextWithOptionalCursor(text: string, shouldShowCursor: boolean) {
  return (
    <>
      {text}
      {shouldShowCursor ? <TypingCursor /> : null}
    </>
  );
}

function NumberedItemContent({
  item,
  showCursor,
}: {
  item: string;
  showCursor: boolean;
}) {
  const { title, body } = splitItemTitle(item);

  if (!title) {
    return (
      <span className="block min-w-0 flex-1 break-words pt-0.5 leading-7 text-[#26384D] [overflow-wrap:anywhere]">
        {renderTextWithOptionalCursor(body, showCursor)}
      </span>
    );
  }

  return (
    <span className="block min-w-0 flex-1 space-y-1.5 pt-0.5 [overflow-wrap:anywhere]">
      <span className="block break-words text-[0.95rem] font-bold leading-6 text-[#172033]">
        {title}
      </span>
      <span className="block max-w-[45rem] break-words leading-7 text-[#4C5B6C]">
        {renderTextWithOptionalCursor(body, showCursor)}
      </span>
    </span>
  );
}

function AnswerAssetImage({
  assetId,
  priority = false,
}: {
  assetId: string;
  priority?: boolean;
}) {
  const asset = getAnswerAsset(assetId);

  if (!asset) {
    return null;
  }

  return (
    <figure className="overflow-hidden rounded-[1rem] border border-[#E6D8C7] bg-[#FFFDF9] shadow-[0_14px_32px_rgba(20,36,58,0.08)]">
      <div className="relative aspect-[16/9] w-full">
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          sizes="(min-width: 768px) 44rem, 100vw"
          priority={priority}
          className="object-cover"
        />
      </div>
      <figcaption className="border-t border-[#E6D8C7]/70 px-3 py-2 text-xs font-medium leading-5 text-[#756A60]">
        {asset.title}
      </figcaption>
    </figure>
  );
}

function EmbeddedAssetThumbnail({
  asset,
  onOpen,
}: {
  asset: AnswerAsset;
  onOpen: (asset: AnswerAsset) => void;
}) {
  const assetGroup = getPoiAssetGroup(asset.id);
  const imageCount = assetGroup.length;
  const hasMultipleImages = imageCount > 1;

  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      className={`group relative mt-3 w-full text-left transition hover:-translate-y-0.5 sm:mt-0 sm:w-[9.5rem] sm:shrink-0 ${
        hasMultipleImages ? "pr-2 pt-2" : ""
      }`}
      aria-label={`Open image: ${asset.title}`}
    >
      {hasMultipleImages ? (
        <>
          <span
            className="absolute right-0 top-0 h-[calc(100%-0.45rem)] w-[calc(100%-0.45rem)] rounded-[0.85rem] border border-[#E6D8C7]/70 bg-[#F3EEE7] shadow-[0_8px_18px_rgba(20,36,58,0.08)]"
            aria-hidden="true"
          />
          <span
            className="absolute right-1 top-1 h-[calc(100%-0.45rem)] w-[calc(100%-0.45rem)] rounded-[0.85rem] border border-[#E6D8C7]/80 bg-[#FFF8EF] shadow-[0_8px_18px_rgba(20,36,58,0.08)]"
            aria-hidden="true"
          />
        </>
      ) : null}
      <div className="relative overflow-hidden rounded-[0.85rem] border border-[#E6D8C7] bg-[#FFFDF9] shadow-[0_10px_22px_rgba(20,36,58,0.07)] transition group-hover:border-[#D49A52]/70 group-hover:shadow-[0_14px_28px_rgba(20,36,58,0.11)]">
        {hasMultipleImages ? (
          <span className="absolute right-2 top-2 z-10 rounded-full border border-white/80 bg-[#172033]/82 px-2 py-0.5 text-[0.68rem] font-extrabold leading-4 text-white shadow-[0_8px_16px_rgba(20,36,58,0.22)] backdrop-blur">
            {imageCount}
          </span>
        ) : null}
        <div className="relative aspect-[16/9] w-full sm:aspect-[4/3]">
          <Image
            src={asset.src}
            alt={asset.alt}
            fill
            sizes="(min-width: 640px) 9.5rem, 100vw"
            className="object-cover transition duration-200 group-hover:scale-[1.03]"
          />
        </div>
        <div className="border-t border-[#E6D8C7]/70 px-2.5 py-1.5 text-[0.7rem] font-bold leading-4 text-[#756A60]">
          {asset.title}
        </div>
      </div>
    </button>
  );
}

function VisualCards({ cards }: { cards: NonNullable<AnswerVisuals["cards"]> }) {
  const toneByType: Record<
    NonNullable<AnswerVisuals["cards"]>[number]["type"],
    string
  > = {
    phrase: "border-emerald-100 bg-emerald-50 text-emerald-950",
    warning: "border-amber-100 bg-amber-50 text-amber-950",
    backup: "border-sky-100 bg-sky-50 text-sky-950",
    checklist: "border-indigo-100 bg-indigo-50 text-indigo-950",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card, index) => (
        <div
          key={`${card.type}-${card.title}-${index}`}
          className={`rounded-[1rem] border p-4 shadow-[0_10px_24px_rgba(20,36,58,0.05)] ${
            toneByType[card.type]
          }`}
        >
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] opacity-75">
            {card.type}
          </p>
          <h4 className="mt-1 break-words text-sm font-extrabold leading-6 [overflow-wrap:anywhere]">
            {card.title}
          </h4>
          <p className="mt-2 break-words text-sm font-medium leading-6 [overflow-wrap:anywhere]">
            {card.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function NumberedBadge({
  index,
  tone,
}: {
  index: number;
  tone: SectionTone;
}) {
  return (
    <span
      className={`relative z-10 mt-0.5 inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border text-[0.68rem] font-extrabold shadow-[0_6px_14px_rgba(20,36,58,0.07),0_1px_0_rgba(255,255,255,0.95)_inset] ${tone.numberRing} ${tone.number}`}
    >
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

function NumberedGroupItemContent({
  item,
  showCursor,
}: {
  item: NumberedGroupItem;
  showCursor: boolean;
}) {
  const { title, body } = splitItemTitle(item.title);
  const bodyLines = title ? [body, ...item.body] : item.body;

  return (
    <div className="min-w-0 flex-1 space-y-3 pt-0.5 [overflow-wrap:anywhere]">
      <div className="break-words text-[1rem] font-extrabold leading-6 text-[#172033]">
        {title ?? item.title}
      </div>
      {bodyLines.length > 0 ? (
        <div className="max-w-[48rem] space-y-2.5">
          {bodyLines.map((line, index) => {
            const isLastLine = index === bodyLines.length - 1;

            return (
              <p
                key={`${line}-${index}`}
                className="break-words text-[0.95rem] leading-7 text-[#4C5B6C] [overflow-wrap:anywhere]"
              >
                {renderTextWithOptionalCursor(
                  line,
                  showCursor && isLastLine,
                )}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AnswerTableView({
  headers,
  rows,
  tone,
  showCursor,
}: {
  headers: string[];
  rows: string[][];
  tone: SectionTone;
  showCursor: boolean;
}) {
  const normalizedRows = rows.map((row) =>
    headers.map((_, index) => row[index] ?? ""),
  );

  return (
    <div
      className={`overflow-hidden rounded-[0.9rem] border ${tone.border} ${tone.softBg} shadow-[0_12px_28px_rgba(20,36,58,0.045),0_1px_0_rgba(255,255,255,0.92)_inset]`}
    >
      <div
        className={`hidden border-b ${tone.border} bg-white/45 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] ${tone.title} sm:grid`}
        style={{
          gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))`,
        }}
      >
        {headers.map((header, index) => (
          <div
            key={`${header}-${index}`}
            className={`border-r ${tone.border} px-4 py-3 last:border-r-0`}
          >
            {header}
          </div>
        ))}
      </div>

      <div className="hidden divide-y divide-[#E6D8C7]/55 sm:block">
        {normalizedRows.map((row, rowIndex) => (
          <div
            key={`desktop-row-${rowIndex}`}
            className="grid bg-white/55"
            style={{
              gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))`,
            }}
          >
            {row.map((cell, cellIndex) => {
              const isLikelyChinesePhrase =
                /chinese|phrase/i.test(headers[cellIndex] ?? "") ||
                /[\u3400-\u9fff]/.test(cell);

              return (
                <div
                  key={`${cell}-${cellIndex}`}
                  className={`min-w-0 border-r ${tone.border} px-4 py-3 text-[0.92rem] leading-6 last:border-r-0 ${
                    isLikelyChinesePhrase
                      ? "font-semibold text-emerald-800"
                      : "text-[#314257]"
                  } [overflow-wrap:anywhere]`}
                >
                  {renderTextWithOptionalCursor(
                    cell,
                    showCursor &&
                      rowIndex === normalizedRows.length - 1 &&
                      cellIndex === row.length - 1,
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="divide-y divide-[#E6D8C7]/60 sm:hidden">
        {normalizedRows.map((row, rowIndex) => (
          <div
            key={`mobile-row-${rowIndex}`}
            className="space-y-3 bg-white/60 p-4"
          >
            {row.map((cell, cellIndex) => {
              const header = headers[cellIndex] ?? `Item ${cellIndex + 1}`;
              const isLikelyChinesePhrase =
                /chinese|phrase/i.test(header) || /[\u3400-\u9fff]/.test(cell);

              return (
                <div key={`${header}-${cellIndex}`} className="space-y-1">
                  <div
                    className={`text-[0.68rem] font-extrabold uppercase tracking-[0.12em] ${tone.title}`}
                  >
                    {header}
                  </div>
                  <div
                    className={`break-words text-[0.93rem] leading-6 ${
                      isLikelyChinesePhrase
                        ? "font-semibold text-emerald-800"
                        : "text-[#314257]"
                    } [overflow-wrap:anywhere]`}
                  >
                    {renderTextWithOptionalCursor(
                      cell,
                      showCursor &&
                        rowIndex === normalizedRows.length - 1 &&
                        cellIndex === row.length - 1,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerBlockView({
  block,
  sectionIndex,
  blockIndex,
  isLastBlock,
  showCursor,
  tone,
  embeddedAssetByItemKey,
  onOpenImage,
}: {
  block: AnswerBlock;
  sectionIndex: number;
  blockIndex: number;
  isLastBlock: boolean;
  showCursor: boolean;
  tone: SectionTone;
  embeddedAssetByItemKey: Map<string, AnswerAsset>;
  onOpenImage: (asset: AnswerAsset) => void;
}) {
  if (block.type === "subheading") {
    return (
      <div className="flex items-center gap-2 pt-1.5">
        <span
          className={`h-5 w-1 rounded-full ${tone.marker} shadow-[0_0_0_3px_rgba(255,255,255,0.75)]`}
          aria-hidden="true"
        />
        <h4
          className={`break-words text-[0.8rem] font-extrabold uppercase tracking-[0.12em] ${tone.title} [overflow-wrap:anywhere]`}
        >
          {renderTextWithOptionalCursor(block.title, showCursor && isLastBlock)}
        </h4>
      </div>
    );
  }

  if (block.type === "minorHeading") {
    return (
      <h5
        className={`break-words rounded-[0.7rem] border ${tone.border} ${tone.softBg} px-3 py-2 text-[0.9rem] font-bold leading-6 text-[#1F2F43] [overflow-wrap:anywhere]`}
      >
        {renderTextWithOptionalCursor(block.title, showCursor && isLastBlock)}
      </h5>
    );
  }

  if (block.type === "ordered" || block.type === "unordered") {
    return (
      <ol className="space-y-4">
        {block.items.map((item, index) => {
          const isLastItem = index === block.items.length - 1;
          const embeddedAsset = getEmbeddedAssetForItem({
            embeddedAssetByItemKey,
            sectionIndex,
            blockIndex,
            itemIndex: index,
          });

          return (
            <li key={`${item}-${index}`} className="relative flex gap-3.5">
              {!isLastItem ? (
                <span
                  className={`absolute left-[0.78125rem] top-8 h-[calc(100%-1rem)] w-px bg-gradient-to-b ${tone.line} to-transparent`}
                  aria-hidden="true"
                />
              ) : null}
              <NumberedBadge index={index} tone={tone} />
              <div className="min-w-0 flex-1 gap-4 sm:flex sm:items-start">
                <NumberedItemContent
                  item={item}
                  showCursor={showCursor && isLastBlock && isLastItem}
                />
                {embeddedAsset ? (
                  <EmbeddedAssetThumbnail
                    asset={embeddedAsset}
                    onOpen={onOpenImage}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  if (block.type === "numberedGroup") {
    return (
      <ol className="space-y-5">
        {block.items.map((item, index) => {
          const isLastItem = index === block.items.length - 1;
          const embeddedAsset = getEmbeddedAssetForItem({
            embeddedAssetByItemKey,
            sectionIndex,
            blockIndex,
            itemIndex: index,
          });

          return (
            <li key={`${item.title}-${index}`} className="relative flex gap-3.5">
              {!isLastItem ? (
                <span
                  className={`absolute left-[0.78125rem] top-8 h-[calc(100%-1rem)] w-px bg-gradient-to-b ${tone.line} to-transparent`}
                  aria-hidden="true"
                />
              ) : null}
              <NumberedBadge index={index} tone={tone} />
              <div className="min-w-0 flex-1 gap-4 sm:flex sm:items-start">
                <NumberedGroupItemContent
                  item={item}
                  showCursor={showCursor && isLastBlock && isLastItem}
                />
                {embeddedAsset ? (
                  <EmbeddedAssetThumbnail
                    asset={embeddedAsset}
                    onOpen={onOpenImage}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  if (block.type === "table") {
    return (
      <AnswerTableView
        headers={block.headers}
        rows={block.rows}
        tone={tone}
        showCursor={showCursor && isLastBlock}
      />
    );
  }

  return (
    <div className="max-w-[48rem] space-y-3.5">
      {block.lines.map((line, index) => {
        const isLastLine = index === block.lines.length - 1;

        return (
          <p
            key={`${line}-${index}`}
            className="break-words text-[0.96rem] leading-8 text-[#314257] [overflow-wrap:anywhere]"
          >
            {renderTextWithOptionalCursor(
              line,
              showCursor && isLastBlock && isLastLine,
            )}
          </p>
        );
      })}
    </div>
  );
}

export function AnswerContent({
  content,
  visuals,
  showCursor = false,
  onOpenImage,
}: {
  content: string;
  visuals?: AnswerVisuals;
  showCursor?: boolean;
  onOpenImage?: (asset: AnswerAsset) => void;
}) {
  const sections = useMemo(() => parseAnswerContent(content), [content]);
  const inlineAssetIds = visuals?.inlineAssetIds?.filter(Boolean) ?? [];
  const embeddedAssets = useMemo(
    () =>
      (visuals?.embeddedAssetIds ?? [])
        .map((assetId) => {
          const asset = getAnswerAsset(assetId);

          return asset ? { asset, assetId } : null;
        })
        .filter((item): item is EmbeddedAssetMatch => Boolean(item)),
    [visuals?.embeddedAssetIds],
  );
  const embeddedAssetByItemKey = useMemo(
    () =>
      createEmbeddedAssetMap({
        sections,
        embeddedAssets,
      }),
    [sections, embeddedAssets],
  );

  if (sections.length === 0 && !visuals) {
    return null;
  }

  return (
    <div className="space-y-7 text-[#26384D]">
      {visuals?.heroAssetId ? (
        <AnswerAssetImage assetId={visuals.heroAssetId} priority />
      ) : null}

      {visuals?.cards?.length ? <VisualCards cards={visuals.cards} /> : null}

      {inlineAssetIds.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {inlineAssetIds.map((assetId) => (
            <AnswerAssetImage key={assetId} assetId={assetId} />
          ))}
        </div>
      ) : null}

      {sections.map((section, sectionIndex) => {
        const sectionKey = getSectionKey(section.title);
        const tone = SECTION_TONES[sectionKey] ?? SECTION_TONES.general;
        const isLastSection = sectionIndex === sections.length - 1;
        const sectionTitle = section.title ?? tone.label;

        return (
          <section
            key={`${section.title ?? "answer"}-${sectionIndex}`}
            className={`relative space-y-4.5 ${
              sectionIndex === 0
                ? ""
                : "border-t border-[#E6D8C7]/60 pt-6"
            }`}
          >
            {sectionTitle ? (
              <div
                className={`flex items-center gap-3 rounded-[0.85rem] border ${tone.border} ${tone.softBg} px-3.5 py-2.5`}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.marker} shadow-[0_0_0_4px_rgba(212,154,82,0.10)]`}
                />
                <h3
                  className={`min-w-0 break-words text-[0.72rem] font-extrabold uppercase tracking-[0.14em] ${tone.title} [overflow-wrap:anywhere]`}
                >
                  {sectionTitle}
                </h3>
                <span
                  className={`h-px min-w-6 flex-1 bg-gradient-to-r ${tone.line} to-transparent`}
                  aria-hidden="true"
                />
              </div>
            ) : null}

            <div className="space-y-4">
              {section.blocks.map((block, blockIndex) => (
                <AnswerBlockView
                  key={`${block.type}-${blockIndex}`}
                  block={block}
                  sectionIndex={sectionIndex}
                  blockIndex={blockIndex}
                  isLastBlock={
                    isLastSection && blockIndex === section.blocks.length - 1
                  }
                  showCursor={showCursor}
                  tone={tone}
                  embeddedAssetByItemKey={embeddedAssetByItemKey}
                  onOpenImage={onOpenImage ?? (() => undefined)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
