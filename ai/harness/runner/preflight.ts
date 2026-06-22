import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PROMPT_PROFILES,
  type PromptProfile,
} from "../../../lib/quick-questions/profiles";
import { TRAVEL_ANSWER_PROMPT_VERSION } from "../../../lib/ai/prompts/travel-answer";
import type { HarnessCase } from "./types";
import { repoRoot } from "./cases";

export async function runPreflight(cases: HarnessCase[]) {
  if (!TRAVEL_ANSWER_PROMPT_VERSION.trim()) {
    throw new Error("TRAVEL_ANSWER_PROMPT_VERSION is empty.");
  }

  const versionFile = path.join(
    repoRoot,
    "ai",
    "prompts",
    "versions",
    `${TRAVEL_ANSWER_PROMPT_VERSION}.md`,
  );
  let versionDocument: string;

  try {
    versionDocument = await readFile(versionFile, "utf8");
  } catch {
    throw new Error(
      `Prompt version document is missing: ${path.relative(repoRoot, versionFile)}`,
    );
  }

  const firstHeading = versionDocument.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (firstHeading !== TRAVEL_ANSWER_PROMPT_VERSION) {
    throw new Error(
      `Prompt version document heading must be "${TRAVEL_ANSWER_PROMPT_VERSION}".`,
    );
  }

  const coveredProfiles = new Set<PromptProfile>(
    cases.map((testCase) => testCase.profile),
  );
  const missingProfiles = PROMPT_PROFILES.filter(
    (profile) => !coveredProfiles.has(profile),
  );

  if (missingProfiles.length > 0) {
    throw new Error(
      `Harness cases are missing PromptProfile coverage: ${missingProfiles.join(", ")}.`,
    );
  }

  return {
    promptVersion: TRAVEL_ANSWER_PROMPT_VERSION,
    profileCount: coveredProfiles.size,
  };
}
