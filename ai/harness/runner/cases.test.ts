import assert from "node:assert/strict";
import test from "node:test";
import { loadAllCases, loadSmokeCaseIds, validateUniqueCaseIds } from "./cases";
import type { HarnessCase } from "./types";

test("loads all cases and validates smoke references", async () => {
  const cases = await loadAllCases();
  const smokeIds = await loadSmokeCaseIds(cases);

  assert.equal(cases.length, 33);
  assert.equal(smokeIds.length, 12);
  assert.equal(new Set(cases.map((item) => item.profile)).size, 9);
});

test("duplicate case ids are rejected", () => {
  const testCase = {
    id: "duplicate",
    profile: "general_travel",
    language: "en",
    question: "A valid question?",
    expected: { maxWords: 100 },
    riskTags: ["test"],
  } satisfies HarnessCase;

  assert.throws(
    () => validateUniqueCaseIds([testCase, testCase]),
    /Duplicate Harness case id/,
  );
});
