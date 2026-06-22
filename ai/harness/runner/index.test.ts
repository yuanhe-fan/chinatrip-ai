import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArgs } from "./index";

test("parses profile, concurrency, and strict warning options", () => {
  assert.deepEqual(
    parseCliArgs([
      "--profile",
      "payment_survival",
      "--concurrency",
      "2",
      "--fail-on-warning",
    ]),
    {
      profile: "payment_survival",
      concurrency: 2,
      failOnWarning: true,
      allowMock: false,
    },
  );
});

test("rejects unknown profiles and invalid concurrency", () => {
  assert.throws(
    () => parseCliArgs(["--profile", "unknown"]),
    /Unknown profile/,
  );
  assert.throws(
    () => parseCliArgs(["--concurrency", "0"]),
    /between 1 and 8/,
  );
});
