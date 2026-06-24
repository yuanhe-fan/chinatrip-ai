import type {
  HarnessCase,
  HarnessCheckResult,
  HarnessGenerationResult,
  HarnessStatus,
} from "./types";
import { TRAVEL_ANSWER_PROMPT_VERSION } from "../../../lib/ai/prompts/travel-answer";

const CHINESE_CHARACTER_PATTERN = /[\u3400-\u9fff]/g;
const LATIN_WORD_PATTERN = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
const LIVE_FACT_PATTERN =
  /(?:https?:\/\/|www\.|\b(?:guaranteed|always|required by law|by law|legally|legal tender|must accept cash|cannot refuse cash|current price|costs? exactly)\b|\b(?:open|closed) (?:daily|every day) (?:from|at) \d|\b(?:price|cost|costs|fee|fare|ticket|deposit)\b[^.\n]{0,40}(?:¥|RMB|CNY|\$)\s?\d+|(?:¥|RMB|CNY|\$)\s?\d+[^.\n]{0,40}\b(?:price|cost|fee|fare|ticket|deposit)\b)/i;
const CHINA_CONTEXT_PATTERN =
  /\b(china|chinese|alipay|wechat|didi|passport|metro|high-speed rail|railway|embassy|consulate)\b|[\u3400-\u9fff]/i;

function issue(
  ruleId: string,
  status: "warning" | "fail",
  category: HarnessCheckResult["category"],
  message: string,
): HarnessCheckResult {
  return { ruleId, status, category, message };
}

function includesNormalized(content: string, expected: string) {
  return content.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
}

function countWords(content: string, language: HarnessCase["language"]) {
  const latinWords = content.match(LATIN_WORD_PATTERN)?.length ?? 0;
  const chineseCharacters = content.match(CHINESE_CHARACTER_PATTERN)?.length ?? 0;

  if (language === "en") {
    return latinWords;
  }

  return latinWords + chineseCharacters;
}

function readTopLevelHeadings(content: string) {
  return Array.from(content.matchAll(/^##\s+(.+)$/gm), (match) =>
    match[1].trim(),
  );
}

function hasActionSteps(content: string) {
  return (content.match(/^\s*\d+[.)]\s+\S+/gm)?.length ?? 0) >= 2;
}

function hasBrokenMarkdown(content: string) {
  const fences = content.match(/^```/gm)?.length ?? 0;
  const boldMarkers = content.match(/\*\*/g)?.length ?? 0;
  return fences % 2 !== 0 || boldMarkers % 2 !== 0;
}

function hasRepeatedNumbering(content: string) {
  const listNumbers = Array.from(
    content.matchAll(/^\s*(\d+)[.)]\s+\S+/gm),
    (match) => Number(match[1]),
  );

  for (let index = 1; index < listNumbers.length; index += 1) {
    if (listNumbers[index] === listNumbers[index - 1]) {
      return true;
    }
  }

  return false;
}

function hasOneDayNestedList(content: string) {
  return /(?:Morning|Afternoon|Evening)[^\n]*\n\s{2,}(?:[-*]|\d+[.)])\s+/i.test(
    content,
  );
}

function hasValidMultiDayStructure(content: string) {
  const days = content.match(/^###\s+Day\s+\d+\s*:/gim) ?? [];
  return days.length >= 2 && !/^\s*\d+[.)]\s+Day\s+\d+/gim.test(content);
}

function checkLanguage(testCase: HarnessCase, content: string) {
  const chineseCount = content.match(CHINESE_CHARACTER_PATTERN)?.length ?? 0;
  const latinCount = content.match(LATIN_WORD_PATTERN)?.length ?? 0;

  if (testCase.language === "en") {
    return latinCount >= 20 && chineseCount <= Math.max(80, latinCount * 1.5);
  }

  return chineseCount >= 20 && chineseCount >= latinCount * 0.25;
}

export function deriveStatus(checks: HarnessCheckResult[]): HarnessStatus {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }
  return "pass";
}

export function evaluateHarnessCase(
  testCase: HarnessCase,
  generation: HarnessGenerationResult,
) {
  const checks: HarnessCheckResult[] = [];
  const { content } = generation;
  const expected = testCase.expected;

  if (!content.trim()) {
    checks.push(
      issue(
        "content.not_empty",
        "fail",
        "contract_failure",
        "The generated answer is empty.",
      ),
    );
  }

  if (!checkLanguage(testCase, content)) {
    checks.push(
      issue(
        "language.correct",
        "fail",
        "contract_failure",
        `The answer does not appear to be primarily ${testCase.language}.`,
      ),
    );
  }

  const topLevelHeadings = readTopLevelHeadings(content);
  if (topLevelHeadings.length > 3) {
    checks.push(
      issue(
        "structure.max_top_level_headings",
        "fail",
        "contract_failure",
        `Expected at most 3 top-level headings, found ${topLevelHeadings.length}.`,
      ),
    );
  }

  for (const heading of expected.requiredHeadings ?? []) {
    if (!topLevelHeadings.some((actual) => actual === heading)) {
      checks.push(
        issue(
          "structure.required_default_headings",
          "fail",
          "contract_failure",
          `Missing required heading: ${heading}.`,
        ),
      );
    }
  }

  if (/^(?:---|\*\*\*|___)\s*$/gm.test(content)) {
    checks.push(
      issue(
        "structure.no_horizontal_rules",
        "fail",
        "contract_failure",
        "The answer contains a forbidden horizontal rule.",
      ),
    );
  }

  if (hasBrokenMarkdown(content)) {
    checks.push(
      issue(
        "structure.no_broken_markdown",
        "fail",
        "contract_failure",
        "The answer contains unbalanced Markdown markers.",
      ),
    );
  }

  if (hasRepeatedNumbering(content)) {
    checks.push(
      issue(
        "structure.no_repeated_numbering",
        "fail",
        "contract_failure",
        "The answer contains consecutive repeated list numbering.",
      ),
    );
  }

  for (const value of expected.mustMention ?? []) {
    if (!includesNormalized(content, value)) {
      checks.push(
        issue(
          "content.required_mentions",
          "fail",
          "contract_failure",
          `Missing required content: ${value}.`,
        ),
      );
    }
  }

  for (const alternatives of expected.mustMentionAny ?? []) {
    if (!alternatives.some((value) => includesNormalized(content, value))) {
      checks.push(
        issue(
          "content.required_mentions",
          "fail",
          "contract_failure",
          `Expected one of: ${alternatives.join(", ")}.`,
        ),
      );
    }
  }

  for (const value of expected.mustNotMention ?? []) {
    if (includesNormalized(content, value)) {
      checks.push(
        issue(
          "content.forbidden_mentions",
          "fail",
          "contract_failure",
          `Found forbidden content: ${value}.`,
        ),
      );
    }
  }

  if (expected.maxWords && countWords(content, testCase.language) > expected.maxWords) {
    checks.push(
      issue(
        "content.max_words",
        "fail",
        "contract_failure",
        `Answer exceeds the ${expected.maxWords}-word limit.`,
      ),
    );
  }

  if (expected.requiresActionSteps && !hasActionSteps(content)) {
    checks.push(
      issue(
        "content.actionable_steps",
        "fail",
        "contract_failure",
        "The answer does not contain enough numbered action steps.",
      ),
    );
  }

  if (
    testCase.profile === "itinerary_planning" &&
    /\b(?:one-day|1-day|one day|1 day)\b/i.test(testCase.question) &&
    hasOneDayNestedList(content)
  ) {
    checks.push(
      issue(
        "profile.itinerary_one_day_flat",
        "fail",
        "contract_failure",
        "A one-day itinerary contains nested list items.",
      ),
    );
  }

  if (
    testCase.profile === "itinerary_planning" &&
    /\b(?:2|3|4|5|two|three|four|five)[ -]?day\b/i.test(testCase.question) &&
    !hasValidMultiDayStructure(content)
  ) {
    checks.push(
      issue(
        "profile.itinerary_multi_day_sections",
        "fail",
        "contract_failure",
        "A multi-day itinerary is missing valid Day sections.",
      ),
    );
  }

  if (!generation.promptVersion) {
    checks.push(
      issue(
        "metadata.prompt_version_present",
        "fail",
        "contract_failure",
        "Generation metadata is missing promptVersion.",
      ),
    );
  } else if (generation.promptVersion !== TRAVEL_ANSWER_PROMPT_VERSION) {
    checks.push(
      issue(
        "metadata.prompt_version_present",
        "fail",
        "contract_failure",
        `Expected promptVersion ${TRAVEL_ANSWER_PROMPT_VERSION}, received ${generation.promptVersion}.`,
      ),
    );
  }

  if (!generation.promptProfile || generation.promptProfile !== testCase.profile) {
    checks.push(
      issue(
        "metadata.profile_present",
        "fail",
        "contract_failure",
        `Expected promptProfile ${testCase.profile}, received ${generation.promptProfile || "missing"}.`,
      ),
    );
  }

  if (generation.sources.length > 3) {
    checks.push(
      issue(
        "metadata.sources_valid_when_rag_enabled",
        "fail",
        "retrieval_contract_failure",
        `Expected at most 3 sources, found ${generation.sources.length}.`,
      ),
    );
  }

  if (
    generation.retrieval.enabled &&
    expected.requiresSourcesWhenRagEnabled &&
    generation.sources.length === 0
  ) {
    checks.push(
      issue(
        "metadata.sources_valid_when_rag_enabled",
        "fail",
        "retrieval_contract_failure",
        "RAG was enabled but no answer sources were returned.",
      ),
    );
  }

  if (generation.truncated) {
    checks.push(
      issue(
        "completion.not_truncated",
        "fail",
        "truncated",
        "The provider reported a truncated answer.",
      ),
    );
  } else if (generation.maybeTruncated) {
    checks.push(
      issue(
        "completion.maybe_truncated",
        "warning",
        "maybe_truncated",
        "The answer may be incomplete.",
      ),
    );
  }

  if (!CHINA_CONTEXT_PATTERN.test(content)) {
    checks.push(
      issue(
        "content.china_specific",
        "warning",
        "contract_failure",
        "The answer has weak China-specific context.",
      ),
    );
  }

  if (
    expected.shouldIncludeChinesePhrase &&
    !(content.match(CHINESE_CHARACTER_PATTERN)?.length ?? 0)
  ) {
    checks.push(
      issue(
        "content.chinese_phrase",
        "warning",
        "contract_failure",
        "The answer should include useful Chinese text.",
      ),
    );
  }

  if (LIVE_FACT_PATTERN.test(content)) {
    checks.push(
      issue(
        "content.no_live_fact_fabrication",
        "warning",
        "contract_failure",
        "The answer contains a potentially time-sensitive or absolute claim.",
      ),
    );
  }

  if (!generation.retrieval.enabled && generation.retrieval.failedReason) {
    checks.push(
      issue(
        "retrieval.available",
        "warning",
        "retrieval_degraded",
        `RAG degraded: ${generation.retrieval.failedReason}`,
      ),
    );
  }

  return {
    checks,
    status: deriveStatus(checks),
  };
}
