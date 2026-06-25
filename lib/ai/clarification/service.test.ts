import test from "node:test";
import assert from "node:assert/strict";
import {
  clarificationFlowSchema,
  createFallbackClarificationFlow,
} from "./schema";
import { extractClarifiedTripContext } from "./context-extractor";
import { normalizeClarificationFlow } from "./question-filter";
import { parseClarificationContent } from "./service";

test("clarification schema accepts a valid flow", () => {
  const result = clarificationFlowSchema.safeParse({
    intent: "itinerary_planning",
    needsClarification: true,
    reason: "Missing trip preferences.",
    extractedContext: {
      destination: "Beijing",
      days: 5,
    },
    questions: [
      {
        id: "pace",
        title: "What pace do you prefer?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Relaxed", value: "relaxed" },
          { label: "Balanced", value: "balanced" },
        ],
      },
    ],
  });

  assert.equal(result.success, true);
});

test("clarification schema rejects unsupported choice questions without options", () => {
  const result = clarificationFlowSchema.safeParse({
    intent: "itinerary_planning",
    needsClarification: true,
    reason: "Missing trip preferences.",
    extractedContext: {},
    questions: [
      {
        id: "pace",
        title: "What pace do you prefer?",
        type: "single_choice",
        required: true,
      },
    ],
  });

  assert.equal(result.success, false);
});

test("clarification schema rejects more than six questions", () => {
  const result = clarificationFlowSchema.safeParse({
    intent: "itinerary_planning",
    needsClarification: true,
    reason: "Too many questions.",
    extractedContext: {},
    questions: Array.from({ length: 7 }, (_, index) => ({
      id: `q_${index}`,
      title: `Question ${index}`,
      type: "text",
      required: true,
    })),
  });

  assert.equal(result.success, false);
});

test("parseClarificationContent extracts JSON from code fences", () => {
  const flow = parseClarificationContent(`\`\`\`json
{
  "intent": "itinerary_planning",
  "needsClarification": false,
  "reason": "Enough context.",
  "extractedContext": { "destination": "Shanghai", "days": 5 },
  "questions": []
}
\`\`\``);

  assert.equal(flow.needsClarification, false);
  assert.equal(flow.extractedContext.destination, "Shanghai");
});

test("fallback clarification flow is valid", () => {
  const result = clarificationFlowSchema.safeParse(
    createFallbackClarificationFlow(),
  );

  assert.equal(result.success, true);
});

test("extracts destination and days from an English one-day city request", () => {
  const context = extractClarifiedTripContext(
    "Plan a one-day Chengdu itinerary for a first-time visitor.",
  );

  assert.equal(context.destination, "Chengdu");
  assert.equal(context.days, 1);
});

test("extracts destination and days from a Chinese multi-day request", () => {
  const context = extractClarifiedTripContext("北京五日游，带老人，节奏轻松");

  assert.equal(context.destination, "Beijing");
  assert.equal(context.days, 5);
  assert.equal(context.travelers, "Includes senior travelers");
  assert.equal(context.pace, "Relaxed");
});

test("filters AI questions that ask for known destination and days", () => {
  const flow = normalizeClarificationFlow(
    {
      intent: "itinerary_planning",
      needsClarification: true,
      reason: "Need more details.",
      extractedContext: {},
      questions: [
        {
          id: "destination_and_days",
          title: "Which city and how many days should I plan for?",
          type: "text",
          required: true,
        },
      ],
    },
    {
      destination: "Chengdu",
      days: 1,
    },
  );

  assert.equal(flow.extractedContext.destination, "Chengdu");
  assert.equal(flow.extractedContext.days, 1);
  assert.equal(flow.needsClarification, true);
  assert.notEqual(
    flow.questions[0]?.title,
    "Which city and how many days should I plan for?",
  );
  assert.match(flow.questions[0]?.id ?? "", /arrival|travelers|pace|interests/);
});

test("fallback asks only for missing destination when days are known", () => {
  const flow = createFallbackClarificationFlow({ days: 3 });

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "destination");
});

test("fallback asks only for missing days when destination is known", () => {
  const flow = createFallbackClarificationFlow({ destination: "Shanghai" });

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "days");
});

test("fallback asks for destination and days only when both are missing", () => {
  const flow = createFallbackClarificationFlow();

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "destination_and_days");
});
