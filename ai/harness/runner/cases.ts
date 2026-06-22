import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  harnessCaseFileSchema,
  smokeCaseIdsSchema,
} from "./schema";
import type { HarnessCase } from "./types";

const runnerDir = path.dirname(fileURLToPath(import.meta.url));
export const harnessRoot = path.resolve(runnerDir, "..");
export const repoRoot = path.resolve(harnessRoot, "..", "..");
const casesDir = path.join(harnessRoot, "cases");

const PROFILE_CASE_FILES = [
  "payment-survival.json",
  "internet-apps.json",
  "transport-workflow.json",
  "tickets-booking.json",
  "emergency-help.json",
  "itinerary-planning.json",
  "language-cards.json",
  "food-ordering.json",
  "general-travel.json",
] as const;

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export function validateUniqueCaseIds(cases: HarnessCase[]) {
  const seen = new Set<string>();

  for (const testCase of cases) {
    if (seen.has(testCase.id)) {
      throw new Error(`Duplicate Harness case id: ${testCase.id}`);
    }
    seen.add(testCase.id);
  }
}

export async function loadAllCases() {
  const caseGroups = await Promise.all(
    PROFILE_CASE_FILES.map(async (fileName) =>
      harnessCaseFileSchema.parse(
        await readJson(path.join(casesDir, fileName)),
      ),
    ),
  );
  const cases = caseGroups.flat() as HarnessCase[];

  validateUniqueCaseIds(cases);
  return cases;
}

export async function loadSmokeCaseIds(allCases: HarnessCase[]) {
  const smokeIds = smokeCaseIdsSchema.parse(
    await readJson(path.join(casesDir, "smoke.json")),
  );
  const knownIds = new Set(allCases.map((testCase) => testCase.id));

  for (const id of smokeIds) {
    if (!knownIds.has(id)) {
      throw new Error(`Smoke suite references unknown case: ${id}`);
    }
  }

  if (new Set(smokeIds).size !== smokeIds.length) {
    throw new Error("Smoke suite contains duplicate case ids.");
  }

  return smokeIds;
}
