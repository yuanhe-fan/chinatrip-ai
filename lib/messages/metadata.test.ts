import test from "node:test";
import assert from "node:assert/strict";
import { createGenerationMetadata } from "./metadata";

test("createGenerationMetadata preserves clarification context", () => {
  const metadata = createGenerationMetadata({
    promptProfile: "itinerary_planning",
    clarificationUsed: true,
    clarifiedTripContext: {
      destination: "Beijing",
      days: 5,
      interests: ["history", "food"],
    },
  });

  assert.deepEqual(metadata, {
    promptProfile: "itinerary_planning",
    clarificationUsed: true,
    clarifiedTripContext: {
      destination: "Beijing",
      days: 5,
      interests: ["history", "food"],
    },
  });
});

test("createGenerationMetadata ignores invalid clarification context", () => {
  const metadata = createGenerationMetadata({
    promptProfile: "itinerary_planning",
    clarificationUsed: true,
    clarifiedTripContext: {
      days: 0,
    },
  });

  assert.deepEqual(metadata, {
    promptProfile: "itinerary_planning",
  });
});
