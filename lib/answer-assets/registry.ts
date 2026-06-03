import type { PromptProfile } from "@/lib/quick-questions/profiles";

export type AnswerAssetRole = "cover" | "detail";

export type AnswerAsset = {
  id: string;
  src: string;
  title: string;
  alt: string;
  category: PromptProfile | "city";
  city?: string;
  poi?: string;
  poiSlug?: string;
  role?: AnswerAssetRole;
  priority?: number;
  tags: string[];
  aliases?: string[];
  sourceType: "owned" | "licensed" | "generated";
  credit?: string;
};

type PoiAssetDefinition = {
  city: string;
  poi: string;
  poiSlug: string;
  title: string;
  alt: string;
  tags: string[];
  imageCount: number;
  legacyAlias?: string;
};

const BEIJING_POI_ASSETS: PoiAssetDefinition[] = [
  {
    city: "beijing",
    poi: "Tiananmen Square",
    poiSlug: "tiananmen-square",
    title: "Tiananmen Square",
    alt: "Tiananmen Square in Beijing",
    tags: ["tiananmen", "tiananmen square", "天安门"],
    imageCount: 4,
    legacyAlias: "beijing-tiananmen-square",
  },
  {
    city: "beijing",
    poi: "Forbidden City",
    poiSlug: "forbidden-city",
    title: "Forbidden City",
    alt: "The Forbidden City in Beijing",
    tags: [
      "forbidden city",
      "palace museum",
      "gugong",
      "imperial palace",
      "故宫",
    ],
    imageCount: 8,
    legacyAlias: "beijing-forbidden-city",
  },
  {
    city: "beijing",
    poi: "National Museum of China",
    poiSlug: "national-museum",
    title: "National Museum of China",
    alt: "National Museum of China in Beijing",
    tags: [
      "national museum",
      "national museum of china",
      "china national museum",
      "国家博物馆",
    ],
    imageCount: 1,
    legacyAlias: "beijing-national-museum",
  },
  {
    city: "beijing",
    poi: "Temple of Heaven",
    poiSlug: "temple-of-heaven",
    title: "Temple of Heaven",
    alt: "Temple of Heaven in Beijing",
    tags: ["temple of heaven", "tiantan", "天坛"],
    imageCount: 1,
    legacyAlias: "beijing-temple-of-heaven",
  },
  {
    city: "beijing",
    poi: "Summer Palace",
    poiSlug: "summer-palace",
    title: "Summer Palace",
    alt: "Summer Palace in Beijing",
    tags: ["summer palace", "yiheyuan", "颐和园"],
    imageCount: 1,
    legacyAlias: "beijing-summer-palace",
  },
  {
    city: "beijing",
    poi: "Bird's Nest",
    poiSlug: "bird-nest",
    title: "Bird's Nest",
    alt: "Bird's Nest National Stadium in Beijing",
    tags: ["bird nest", "bird's nest", "national stadium", "鸟巢"],
    imageCount: 7,
    legacyAlias: "beijing-bird-nest",
  },
  {
    city: "beijing",
    poi: "Water Cube",
    poiSlug: "water-cube",
    title: "Water Cube",
    alt: "Water Cube National Aquatics Center in Beijing",
    tags: [
      "water cube",
      "national aquatics center",
      "aquatics center",
      "水立方",
    ],
    imageCount: 1,
    legacyAlias: "beijing-water-cube",
  },
  {
    city: "beijing",
    poi: "Great Wall",
    poiSlug: "great-wall",
    title: "Great Wall",
    alt: "Great Wall near Beijing",
    tags: [
      "great wall",
      "mutianyu",
      "badaling",
      "great wall of china",
      "长城",
    ],
    imageCount: 1,
    legacyAlias: "beijing-great-wall",
  },
];

function createPoiAssets(definition: PoiAssetDefinition) {
  return Array.from({ length: definition.imageCount }, (_, index) => {
    const variant = index + 1;
    const role: AnswerAssetRole = variant === 1 ? "cover" : "detail";

    return {
      id: `poi:${definition.city}:${definition.poiSlug}:${variant}`,
      src: `/answer-assets/poi/${definition.city}/${definition.poiSlug}/${definition.poiSlug}-${variant}.jpg`,
      title: definition.title,
      alt:
        variant === 1
          ? definition.alt
          : `${definition.alt}, view ${variant}`,
      category: "city" as const,
      city: definition.city,
      poi: definition.poi,
      poiSlug: definition.poiSlug,
      role,
      priority: variant,
      tags: definition.tags,
      aliases:
        variant === 1 && definition.legacyAlias
          ? [definition.legacyAlias]
          : undefined,
      sourceType: "owned" as const,
    };
  });
}

export const ANSWER_ASSETS: AnswerAsset[] =
  BEIJING_POI_ASSETS.flatMap(createPoiAssets);

export function getAnswerAsset(assetId: string) {
  return (
    ANSWER_ASSETS.find(
      (asset) => asset.id === assetId || asset.aliases?.includes(assetId),
    ) ?? null
  );
}

export function findAnswerAssets({
  profile,
  tags,
  limit = 3,
}: {
  profile: PromptProfile;
  tags: string[];
  limit?: number;
}) {
  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));

  return ANSWER_ASSETS.filter((asset) => {
    if (asset.category !== profile && asset.category !== "city") {
      return false;
    }

    return asset.tags.some((tag) => normalizedTags.has(tag.toLowerCase()));
  }).slice(0, limit);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase();
}

function getPoiKey(asset: AnswerAsset) {
  return `${asset.city ?? ""}:${asset.poiSlug ?? asset.poi ?? asset.id}`;
}

function getMatchedTagFirstIndex(asset: AnswerAsset, normalizedText: string) {
  const indexes = asset.tags
    .map((tag) => normalizedText.indexOf(normalizeSearchText(tag)))
    .filter((index) => index >= 0);

  return indexes.length > 0 ? Math.min(...indexes) : null;
}

function selectBestPoiAsset(assets: AnswerAsset[]) {
  return [...assets].sort((left, right) => {
    const leftRoleRank = left.role === "cover" ? 0 : 1;
    const rightRoleRank = right.role === "cover" ? 0 : 1;

    if (leftRoleRank !== rightRoleRank) {
      return leftRoleRank - rightRoleRank;
    }

    return (left.priority ?? 999) - (right.priority ?? 999);
  })[0];
}

function sortPoiAssets(assets: AnswerAsset[]) {
  return [...assets].sort((left, right) => {
    const leftRoleRank = left.role === "cover" ? 0 : 1;
    const rightRoleRank = right.role === "cover" ? 0 : 1;

    if (leftRoleRank !== rightRoleRank) {
      return leftRoleRank - rightRoleRank;
    }

    return (left.priority ?? 999) - (right.priority ?? 999);
  });
}

export function getPoiAssetGroup(assetId: string) {
  const asset = getAnswerAsset(assetId);

  if (!asset?.city || !asset.poiSlug) {
    return asset ? [asset] : [];
  }

  const group = ANSWER_ASSETS.filter(
    (candidate) =>
      candidate.city === asset.city && candidate.poiSlug === asset.poiSlug,
  );

  return group.length > 0 ? sortPoiAssets(group) : [asset];
}

export function findItineraryPoiAssets({
  text,
  limit = ANSWER_ASSETS.length,
}: {
  text: string;
  limit?: number;
}) {
  const normalizedText = normalizeSearchText(text);
  const matchedPoiMap = new Map<
    string,
    {
      firstIndex: number;
      assets: AnswerAsset[];
    }
  >();

  ANSWER_ASSETS.forEach((asset) => {
    if (asset.category !== "city" || !asset.poi || !asset.poiSlug) {
      return;
    }

    const firstIndex = getMatchedTagFirstIndex(asset, normalizedText);

    if (firstIndex === null) {
      return;
    }

    const poiKey = getPoiKey(asset);
    const existing = matchedPoiMap.get(poiKey);

    if (existing) {
      existing.firstIndex = Math.min(existing.firstIndex, firstIndex);
      existing.assets.push(asset);
      return;
    }

    matchedPoiMap.set(poiKey, {
      firstIndex,
      assets: [asset],
    });
  });

  return [...matchedPoiMap.values()]
    .map((match) => ({
      firstIndex: match.firstIndex,
      asset: selectBestPoiAsset(match.assets),
    }))
    .filter(
      (match): match is { firstIndex: number; asset: AnswerAsset } =>
        Boolean(match.asset),
    )
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map(({ asset }) => asset)
    .slice(0, limit);
}
