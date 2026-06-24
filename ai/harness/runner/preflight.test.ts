import assert from "node:assert/strict";
import test from "node:test";
import { loadAllCases } from "./cases";
import { runPreflight } from "./preflight";

test("current Prompt version and all PromptProfiles pass preflight", async () => {
  const result = await runPreflight(await loadAllCases());

  assert.equal(result.promptVersion, "travel-answer-v12-payment-failure-safety");
  assert.equal(result.profileCount, 9);
});
