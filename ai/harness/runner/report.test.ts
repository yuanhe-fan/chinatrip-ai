import assert from "node:assert/strict";
import test from "node:test";
import {
  compareWithPrevious,
  createReport,
  renderMarkdownReport,
} from "./report";
import type {
  HarnessCaseResult,
  HarnessReport,
  HarnessStatus,
} from "./types";

function result(id: string, status: HarnessStatus): HarnessCaseResult {
  return {
    id,
    profile: "general_travel",
    language: "en",
    question: "Question",
    status,
    checks: [],
    answer: "Answer",
    answerSummary: "Answer",
    generation: null,
  };
}

function previousReport(results: HarnessCaseResult[]): HarnessReport {
  return createReport({
    mode: "smoke",
    provider: "deepseek",
    allowMock: false,
    concurrency: 1,
    results,
  });
}

test("compares new and fixed failures", () => {
  const comparison = compareWithPrevious(
    previousReport([result("a", "fail"), result("b", "pass")]),
    [result("a", "pass"), result("b", "fail")],
  );

  assert.deepEqual(comparison.newFailures, ["b"]);
  assert.deepEqual(comparison.fixedFailures, ["a"]);
  assert.equal(comparison.statusChanges.length, 2);
});

test("creates matching JSON summary and Markdown report", () => {
  const report = createReport({
    mode: "full",
    provider: "deepseek",
    allowMock: false,
    concurrency: 1,
    results: [result("pass-case", "pass"), result("fail-case", "fail")],
  });
  const markdown = renderMarkdownReport(report);

  assert.deepEqual(report.summary, {
    total: 2,
    pass: 1,
    warning: 0,
    fail: 1,
  });
  assert.match(markdown, /\| 2 \| 1 \| 0 \| 1 \|/);
  assert.match(markdown, /fail-case/);
});
