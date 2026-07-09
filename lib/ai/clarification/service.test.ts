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

test("clarification schema accepts date_time questions", () => {
  const result = clarificationFlowSchema.safeParse({
    intent: "itinerary_planning",
    needsClarification: true,
    reason: "Missing arrival time.",
    extractedContext: {
      destination: "Beijing",
      days: 1,
    },
    questions: [
      {
        id: "arrival_time",
        title: "When will you arrive?",
        type: "date_time",
        required: true,
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

test("treats China as a broad scope instead of a concrete destination", () => {
  const context = extractClarifiedTripContext(
    "Can you help me plan a simple five-day China itinerary?",
  );

  assert.equal(context.destination, undefined);
  assert.equal(context.days, 5);
  assert.match(context.notes ?? "", /China/);
});

test("extracts known traveler, area, interests, dietary needs, and special needs", () => {
  const context = extractClarifiedTripContext(
    "上海5日游，带老人，不要太累，住人民广场附近，喜欢历史和美食，不吃辣",
  );

  assert.equal(context.destination, "Shanghai");
  assert.equal(context.days, 5);
  assert.equal(context.travelers, "Includes senior travelers");
  assert.equal(context.startArea, "人民广场");
  assert.deepEqual(context.interests, ["history", "food"]);
  assert.deepEqual(context.dietaryNeeds, ["no spicy"]);
  assert.deepEqual(context.specialNeeds, ["less walking"]);
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

test("filters AI questions that ask for known start area and dietary needs", () => {
  const flow = normalizeClarificationFlow(
    {
      intent: "itinerary_planning",
      needsClarification: true,
      reason: "Need more details.",
      extractedContext: {},
      questions: [
        {
          id: "hotel_area",
          title: "Where are you staying?",
          type: "text",
          required: true,
        },
        {
          id: "diet",
          title: "Any spicy food restrictions?",
          type: "text",
          required: true,
        },
        {
          id: "interests",
          title: "What do you care about most?",
          type: "multi_choice",
          required: true,
          options: [
            { label: "History", value: "history" },
            { label: "Food", value: "food" },
          ],
        },
      ],
    },
    {
      destination: "Shanghai",
      days: 5,
      startArea: "People's Square",
      dietaryNeeds: ["no spicy"],
    },
  );

  assert.deepEqual(
    flow.questions.map((question) => question.id),
    ["interests"],
  );
});

test("filters timing questions before a concrete destination is known", () => {
  const flow = normalizeClarificationFlow(
    {
      intent: "itinerary_planning",
      needsClarification: true,
      reason: "Need timing.",
      extractedContext: {},
      questions: [
        {
          id: "arrival_time",
          title: "When will you arrive?",
          description: "Choose the date you expect to start.",
          type: "date_time",
          required: true,
        },
      ],
    },
    {
      days: 5,
      notes: "Destination scope: China",
    },
  );

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "destination");
  assert.equal(flow.questions[0]?.type, "single_choice");
  assert.deepEqual(
    flow.questions.map((question) => question.id),
    ["destination", "interests", "travelers", "pace"],
  );
});

test("supplements broad country-scope flows with high-value baseline questions", () => {
  const flow = normalizeClarificationFlow(
    {
      intent: "itinerary_planning",
      needsClarification: true,
      reason: "Need destination.",
      extractedContext: {},
      questions: [
        {
          id: "destination",
          title: "Which city or cities do you want to include?",
          type: "single_choice",
          required: true,
          options: [
            { label: "Beijing", value: "Beijing" },
            { label: "Shanghai", value: "Shanghai" },
          ],
        },
      ],
    },
    {
      days: 5,
      notes: "Destination scope: China",
    },
  );

  assert.deepEqual(
    flow.questions.map((question) => question.id),
    ["destination", "interests", "travelers", "pace"],
  );
});

test("fallback asks city, interests, travelers, and pace before timing when days are known", () => {
  const flow = createFallbackClarificationFlow({ days: 3 });

  assert.equal(flow.needsClarification, true);
  assert.deepEqual(
    flow.questions.map((question) => question.id),
    ["destination", "interests", "travelers", "pace"],
  );
  assert.equal(flow.questions[0]?.id, "destination");
  assert.equal(flow.questions[0]?.type, "single_choice");
  assert.deepEqual(
    flow.questions[0]?.options?.map((option) => option.value),
    ["Beijing", "Shanghai", "Chengdu", "Xi'an"],
  );
  assert.equal(flow.questions[0]?.allowOther, true);
});

test("fallback asks city choices for broad China scope with known days", () => {
  const context = extractClarifiedTripContext(
    "Can you help me plan a simple five-day China itinerary?",
  );
  const flow = createFallbackClarificationFlow(context);

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "destination");
  assert.equal(flow.questions[0]?.type, "single_choice");
  assert.deepEqual(
    flow.questions.map((question) => question.id),
    ["destination", "interests", "travelers", "pace"],
  );
  assert.notEqual(flow.questions[0]?.id, "arrival_time");
});

test("broad China fallback asks more than a single city question", () => {
  const context = extractClarifiedTripContext(
    "Can you help me plan a simple five-day China itinerary?",
  );
  const flow = createFallbackClarificationFlow(context);

  assert.equal(flow.needsClarification, true);
  assert.deepEqual(
    flow.questions.map((question) => question.id),
    ["destination", "interests", "travelers", "pace"],
  );
  assert.equal(flow.questions.length >= 4, true);
});

test("does not repeat known Shanghai senior relaxed context", () => {
  const knownContext = extractClarifiedTripContext(
    "上海5日游，带老人，不要太累，住人民广场附近，喜欢历史和美食，不吃辣",
  );
  const flow = normalizeClarificationFlow(
    {
      intent: "itinerary_planning",
      needsClarification: true,
      reason: "Need more details.",
      extractedContext: {},
      questions: [
        {
          id: "destination",
          title: "Which city should I plan for?",
          type: "single_choice",
          required: true,
          options: [
            { label: "Shanghai", value: "Shanghai" },
            { label: "Beijing", value: "Beijing" },
          ],
        },
        {
          id: "travelers",
          title: "Who is traveling with you?",
          type: "single_choice",
          required: true,
          options: [
            { label: "Senior travelers", value: "senior" },
            { label: "Solo", value: "solo" },
          ],
        },
        {
          id: "pace",
          title: "What pace do you prefer?",
          type: "single_choice",
          required: true,
          options: [
            { label: "Relaxed", value: "relaxed" },
            { label: "Packed", value: "packed" },
          ],
        },
        {
          id: "hotel_area",
          title: "Where are you staying?",
          type: "text",
          required: true,
        },
      ],
    },
    knownContext,
  );

  assert.equal(flow.extractedContext.destination, "Shanghai");
  assert.equal(flow.extractedContext.days, 5);
  assert.equal(flow.extractedContext.travelers, "Includes senior travelers");
  assert.equal(flow.extractedContext.pace, "Relaxed");
  assert.equal(flow.extractedContext.startArea, "人民广场");
  assert.deepEqual(flow.extractedContext.interests, ["history", "food"]);
  assert.deepEqual(flow.extractedContext.dietaryNeeds, ["no spicy"]);
  assert.deepEqual(flow.extractedContext.specialNeeds, ["less walking"]);
  assert.equal(
    flow.questions.some((question) =>
      ["destination", "travelers", "pace", "hotel_area"].includes(question.id),
    ),
    false,
  );
});

test("keeps information-rich requests eligible to skip clarification", () => {
  const knownContext = extractClarifiedTripContext(
    "北京5日游，两个人，住王府井附近，喜欢历史和美食，不吃辣，arrive at 2pm and leave at 10am",
  );
  const flow = normalizeClarificationFlow(
    {
      intent: "itinerary_planning",
      needsClarification: false,
      reason: "Enough context.",
      extractedContext: {},
      questions: [],
    },
    knownContext,
  );

  assert.equal(flow.needsClarification, false);
  assert.equal(flow.questions.length, 0);
  assert.equal(flow.extractedContext.destination, "Beijing");
  assert.equal(flow.extractedContext.days, 5);
  assert.equal(flow.extractedContext.travelers, "Two travelers");
  assert.equal(flow.extractedContext.startArea, "王府井");
  assert.deepEqual(flow.extractedContext.interests, ["history", "food"]);
  assert.deepEqual(flow.extractedContext.dietaryNeeds, ["no spicy"]);
});

test("fallback asks only for missing days when destination is known", () => {
  const flow = createFallbackClarificationFlow({ destination: "Shanghai" });

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "days");
});

test("fallback asks date_time questions when destination and days are known", () => {
  const flow = createFallbackClarificationFlow({
    destination: "Chengdu",
    days: 1,
  });

  assert.equal(flow.needsClarification, true);
  assert.deepEqual(
    flow.questions.map((question) => [question.id, question.type]),
    [
      ["arrival_time", "date_time"],
      ["departure_time", "date_time"],
    ],
  );
});

test("fallback asks for destination and days only when both are missing", () => {
  const flow = createFallbackClarificationFlow();

  assert.equal(flow.needsClarification, true);
  assert.equal(flow.questions[0]?.id, "destination_and_days");
});
