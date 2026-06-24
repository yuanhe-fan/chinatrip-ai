import assert from "node:assert/strict";
import test from "node:test";
import { deriveStatus, evaluateHarnessCase } from "./checks";
import type {
  HarnessCase,
  HarnessGenerationResult,
} from "./types";

function createCase(overrides: Partial<HarnessCase> = {}): HarnessCase {
  return {
    id: "test-case",
    profile: "payment_survival",
    language: "en",
    question: "Can I use Alipay in China?",
    expected: {
      mustMention: ["Alipay"],
      requiredHeadings: ["Direct Answer", "Do This", "Watch Out"],
      requiresActionSteps: true,
      maxWords: 300,
    },
    riskTags: ["test"],
    ...overrides,
  };
}

function createGeneration(
  overrides: Partial<HarnessGenerationResult> = {},
): HarnessGenerationResult {
  return {
    content: [
      "## Direct Answer",
      "Alipay can work for foreign visitors in China, but keep a backup.",
      "",
      "## Do This",
      "1. Set up: Add your international card.",
      "2. Test payment: Try a small purchase.",
      "3. Keep backup: Carry some cash.",
      "",
      "## Watch Out",
      "- Acceptance can vary.",
    ].join("\n"),
    provider: "deepseek",
    model: "test-model",
    promptVersion: "travel-answer-v12-payment-failure-safety",
    promptProfile: "payment_survival",
    inputTokens: 100,
    outputTokens: 80,
    latencyMs: 20,
    fallbackUsed: false,
    finishReason: "stop",
    truncated: false,
    maybeTruncated: false,
    retrieval: {
      enabled: true,
      matchedChunkCount: 1,
    },
    sources: [
      {
        id: "source-1",
        title: "Payment",
        category: "payment_survival",
        updatedAt: null,
      },
    ],
    ...overrides,
  };
}

test("a compliant answer passes", () => {
  const result = evaluateHarnessCase(createCase(), createGeneration());
  assert.equal(result.status, "pass");
  assert.equal(result.checks.length, 0);
});

test("required and forbidden mentions fail", () => {
  const testCase = createCase({
    expected: {
      mustMention: ["passport"],
      mustNotMention: ["guaranteed"],
    },
  });
  const result = evaluateHarnessCase(
    testCase,
    createGeneration({ content: "This is guaranteed in China." }),
  );
  assert.equal(result.status, "fail");
  assert.ok(
    result.checks.some((check) => check.ruleId === "content.required_mentions"),
  );
  assert.ok(
    result.checks.some((check) => check.ruleId === "content.forbidden_mentions"),
  );
});

test("RAG degradation is a warning", () => {
  const result = evaluateHarnessCase(
    createCase(),
    createGeneration({
      retrieval: {
        enabled: false,
        matchedChunkCount: 0,
        failedReason: "Embedding configuration missing.",
      },
      sources: [],
    }),
  );
  assert.equal(result.status, "warning");
  assert.ok(
    result.checks.some((check) => check.category === "retrieval_degraded"),
  );
});

test("live fact warning ignores practical cash denomination advice", () => {
  const result = evaluateHarnessCase(
    createCase({
      expected: {
        mustMention: ["Alipay"],
        requiredHeadings: ["Direct Answer", "Do This", "Watch Out"],
        requiresActionSteps: true,
        maxWords: 300,
      },
    }),
    createGeneration({
      content: [
        "## Direct Answer",
        "Alipay can work in China, but keep cash as a backup.",
        "",
        "## Do This",
        "1. Check network: Retry with mobile data.",
        "2. Try card: Ask whether a foreign card works.",
        "3. Use cash: Carry smaller notes such as ¥10, ¥20, and ¥50.",
        "",
        "## Watch Out",
        "- Acceptance can vary.",
      ].join("\n"),
    }),
  );
  assert.equal(result.status, "pass");
  assert.ok(
    !result.checks.some(
      (check) => check.ruleId === "content.no_live_fact_fabrication",
    ),
  );
});

test("live fact warning catches exact price claims", () => {
  const result = evaluateHarnessCase(
    createCase(),
    createGeneration({
      content: [
        "## Direct Answer",
        "Alipay can work in China, but the current ticket price is ¥60.",
        "",
        "## Do This",
        "1. Set up: Add your international card.",
        "2. Test payment: Try a small purchase.",
        "3. Keep backup: Carry some cash.",
        "",
        "## Watch Out",
        "- Acceptance can vary.",
      ].join("\n"),
    }),
  );
  assert.equal(result.status, "warning");
  assert.ok(
    result.checks.some(
      (check) => check.ruleId === "content.no_live_fact_fabrication",
    ),
  );
});

test("live fact warning catches cash law claims", () => {
  const result = evaluateHarnessCase(
    createCase(),
    createGeneration({
      content: [
        "## Direct Answer",
        "Cash can help if Alipay fails, and merchants must accept cash by law.",
        "",
        "## Do This",
        "1. Set up: Add your international card.",
        "2. Test payment: Try a small purchase.",
        "3. Keep backup: Carry some cash.",
        "",
        "## Watch Out",
        "- Acceptance can vary.",
      ].join("\n"),
    }),
  );
  assert.equal(result.status, "warning");
  assert.ok(
    result.checks.some(
      (check) => check.ruleId === "content.no_live_fact_fabrication",
    ),
  );
});

test("English word limit does not count Chinese phrase card characters", () => {
  const content = [
    "## Direct Answer",
    "Alipay can work in China, but keep cash as a backup.",
    "",
    "## Do This",
    "1. Check payment: Retry with mobile data.",
    "2. Show phrase: 请问可以用现金或外国信用卡支付押金吗？谢谢。",
    "3. Keep backup: Carry some cash.",
    "",
    "## Watch Out",
    "- Acceptance can vary.",
  ].join("\n");
  const result = evaluateHarnessCase(
    createCase({
      expected: {
        mustMention: ["Alipay"],
        requiredHeadings: ["Direct Answer", "Do This", "Watch Out"],
        requiresActionSteps: true,
        maxWords: 45,
      },
    }),
    createGeneration({ content }),
  );
  assert.equal(result.status, "pass");
});

test("truncation and invalid sources fail", () => {
  const result = evaluateHarnessCase(
    createCase({
      expected: {
        requiresSourcesWhenRagEnabled: true,
      },
    }),
    createGeneration({
      truncated: true,
      sources: [],
    }),
  );
  assert.equal(result.status, "fail");
  assert.ok(result.checks.some((check) => check.category === "truncated"));
  assert.ok(
    result.checks.some(
      (check) => check.category === "retrieval_contract_failure",
    ),
  );
});

test("one-day itineraries reject nested lists", () => {
  const result = evaluateHarnessCase(
    createCase({
      profile: "itinerary_planning",
      question: "Plan a one-day Beijing itinerary.",
      expected: {},
    }),
    createGeneration({
      promptProfile: "itinerary_planning",
      content: [
        "## Direct Answer",
        "A practical China route.",
        "## Do This",
        "1. Morning: Tiananmen",
        "  - Enter from the east.",
        "2. Afternoon: Temple of Heaven",
        "## Watch Out",
        "- Verify tickets.",
      ].join("\n"),
    }),
  );
  assert.equal(result.status, "fail");
  assert.ok(
    result.checks.some(
      (check) => check.ruleId === "profile.itinerary_one_day_flat",
    ),
  );
});

test("multi-day itineraries require Day sections", () => {
  const result = evaluateHarnessCase(
    createCase({
      profile: "itinerary_planning",
      question: "Plan a 3-day Beijing itinerary.",
      expected: {},
    }),
    createGeneration({
      promptProfile: "itinerary_planning",
      content: [
        "## Direct Answer",
        "A practical China route.",
        "## Do This",
        "1. Day 1: Central Beijing",
        "2. Day 2: Great Wall",
        "## Watch Out",
        "- Verify tickets.",
      ].join("\n"),
    }),
  );
  assert.equal(result.status, "fail");
  assert.ok(
    result.checks.some(
      (check) => check.ruleId === "profile.itinerary_multi_day_sections",
    ),
  );
});

test("deriveStatus prioritizes failures over warnings", () => {
  assert.equal(
    deriveStatus([
      {
        ruleId: "warning",
        status: "warning",
        category: "retrieval_degraded",
        message: "warning",
      },
      {
        ruleId: "failure",
        status: "fail",
        category: "contract_failure",
        message: "failure",
      },
    ]),
    "fail",
  );
});
