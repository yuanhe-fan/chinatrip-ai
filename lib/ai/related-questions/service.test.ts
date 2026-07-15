import test from "node:test";
import assert from "node:assert/strict";
import { parseRelatedQuestionsContent } from "./service";

test("parses one to three related questions from fenced JSON", () => {
  const questions = parseRelatedQuestionsContent(
    '```json\n{"questions":["How do I get there?","What should I book?"]}\n```',
    "Plan a Beijing trip",
  );

  assert.deepEqual(questions, ["How do I get there?", "What should I book?"]);
});

test("removes duplicate and original questions", () => {
  const questions = parseRelatedQuestionsContent(
    JSON.stringify({
      questions: [
        "Plan a Beijing trip",
        "What should I book?",
        "What should I book?",
      ],
    }),
    "Plan a Beijing trip",
  );

  assert.deepEqual(questions, ["What should I book?"]);
});

test("rejects more than three questions", () => {
  const questions = parseRelatedQuestionsContent(
    JSON.stringify({ questions: ["One?", "Two?", "Three?", "Four?"] }),
    "Original question",
  );

  assert.deepEqual(questions, []);
});
