import type { ClarifiedTripContext } from "./schema";

const CITY_PATTERNS: Array<[RegExp, string]> = [
  [/\bbei\s?jing\b/i, "Beijing"],
  [/北京/, "Beijing"],
  [/\bshang\s?hai\b/i, "Shanghai"],
  [/上海/, "Shanghai"],
  [/\bcheng\s?du\b/i, "Chengdu"],
  [/成都/, "Chengdu"],
  [/\bxi'?an\b/i, "Xi'an"],
  [/西安/, "Xi'an"],
  [/\bchina\b/i, "China"],
  [/中国/, "China"],
];

const ENGLISH_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const CHINESE_NUMBER_WORDS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseChineseNumber(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value === "十") {
    return 10;
  }

  if (value.startsWith("十")) {
    return 10 + (CHINESE_NUMBER_WORDS[value.slice(1)] ?? 0);
  }

  if (value.endsWith("十")) {
    return (CHINESE_NUMBER_WORDS[value.slice(0, -1)] ?? 0) * 10;
  }

  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (
      (CHINESE_NUMBER_WORDS[tens] ?? 1) * 10 +
      (CHINESE_NUMBER_WORDS[ones] ?? 0)
    );
  }

  return CHINESE_NUMBER_WORDS[value];
}

function extractDays(message: string) {
  const normalized = message.toLowerCase();
  const numericMatch = normalized.match(
    /\b(\d{1,2})\s*(?:-|–)?\s*(?:day|days)\b/,
  );

  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  for (const [word, days] of Object.entries(ENGLISH_NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\s*(?:-|–)?\\s*day\\b`, "i").test(message)) {
      return days;
    }
  }

  const chineseMatch = message.match(/([一二两三四五六七八九十\d]{1,3})(?:日|天)(?:游|行程|旅行|路线|计划)?/);

  if (chineseMatch) {
    const days = parseChineseNumber(chineseMatch[1]);

    if (days) {
      return days;
    }
  }

  return undefined;
}

function extractTimeRange(message: string): Pick<
  ClarifiedTripContext,
  "arrivalTime" | "departureTime"
> {
  const timePattern = String.raw`\d{1,2}(?::\d{2})?\s*(?:am|pm)?`;
  const rangeMatch = message.match(
    new RegExp(`\\b(${timePattern})\\s*(?:to|-|–|until)\\s*(${timePattern})\\b`, "i"),
  );

  if (rangeMatch) {
    return {
      arrivalTime: rangeMatch[1].trim(),
      departureTime: rangeMatch[2].trim(),
    };
  }

  const arrivalMatch = message.match(
    new RegExp(`\\b(?:arrive|arrival|land|landing)\\w*\\s*(?:at|around)?\\s*(${timePattern})\\b`, "i"),
  );
  const departureMatch = message.match(
    new RegExp(`\\b(?:leave|depart|departure|leaving)\\w*\\s*(?:at|around)?\\s*(${timePattern})\\b`, "i"),
  );

  return {
    ...(arrivalMatch ? { arrivalTime: arrivalMatch[1].trim() } : {}),
    ...(departureMatch ? { departureTime: departureMatch[1].trim() } : {}),
  };
}

export function extractClarifiedTripContext(
  message: string,
): ClarifiedTripContext {
  const context: ClarifiedTripContext = {};

  for (const [pattern, destination] of CITY_PATTERNS) {
    if (pattern.test(message)) {
      context.destination = destination;
      break;
    }
  }

  const days = extractDays(message);

  if (days) {
    context.days = days;
  }

  Object.assign(context, extractTimeRange(message));

  if (/(老人|老年|elder|senior)/i.test(message)) {
    context.travelers = "Includes senior travelers";
  } else if (/(孩子|儿童|小孩|kid|child|children|family)/i.test(message)) {
    context.travelers = "Includes children or family travelers";
  } else if (/(solo|alone|一个人|独自)/i.test(message)) {
    context.travelers = "Solo traveler";
  }

  if (/(轻松|慢节奏|relaxed|slow|easy pace)/i.test(message)) {
    context.pace = "Relaxed";
  } else if (/(紧凑|赶|packed|fast|intensive)/i.test(message)) {
    context.pace = "Packed";
  } else if (/(适中|moderate|balanced)/i.test(message)) {
    context.pace = "Moderate";
  }

  return context;
}
