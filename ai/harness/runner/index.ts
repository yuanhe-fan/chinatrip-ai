import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadAllCases, loadSmokeCaseIds, repoRoot } from "./cases";
import { evaluateHarnessCase } from "./checks";
import { generateForHarness } from "./generator";
import { runPreflight } from "./preflight";
import {
  createReport,
  readPreviousReport,
  writeReport,
} from "./report";
import {
  PROMPT_PROFILES,
  isPromptProfile,
  type PromptProfile,
} from "../../../lib/quick-questions/profiles";
import type {
  HarnessCase,
  HarnessCaseResult,
  HarnessRunMode,
} from "./types";

type CliOptions = {
  mode?: "smoke" | "full";
  profile?: PromptProfile;
  caseId?: string;
  allowMock: boolean;
  failOnWarning: boolean;
  concurrency: number;
};

function readValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    allowMock: false,
    failOnWarning: false,
    concurrency: 1,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--mode") {
      const mode = readValue(args, index, arg);
      if (mode !== "smoke" && mode !== "full") {
        throw new Error("--mode must be smoke or full.");
      }
      options.mode = mode;
      index += 1;
    } else if (arg === "--profile") {
      const profile = readValue(args, index, arg);
      if (!isPromptProfile(profile)) {
        throw new Error(
          `Unknown profile "${profile}". Use one of: ${PROMPT_PROFILES.join(", ")}.`,
        );
      }
      options.profile = profile;
      index += 1;
    } else if (arg === "--case") {
      options.caseId = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--concurrency") {
      const concurrency = Number(readValue(args, index, arg));
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
        throw new Error("--concurrency must be an integer between 1 and 8.");
      }
      options.concurrency = concurrency;
      index += 1;
    } else if (arg === "--allow-mock") {
      options.allowMock = true;
    } else if (arg === "--fail-on-warning") {
      options.failOnWarning = true;
    } else {
      throw new Error(`Unknown Harness option: ${arg}`);
    }
  }

  return options;
}

function resolveRunMode(options: CliOptions): HarnessRunMode {
  if (options.caseId) return "case";
  if (options.profile) return "profile";
  return options.mode ?? "smoke";
}

async function selectCases(options: CliOptions) {
  const allCases = await loadAllCases();
  const smokeIds = await loadSmokeCaseIds(allCases);
  const mode = resolveRunMode(options);
  let selected = mode === "smoke"
    ? allCases.filter((testCase) => smokeIds.includes(testCase.id))
    : allCases;

  if (options.profile) {
    selected = selected.filter(
      (testCase) => testCase.profile === options.profile,
    );
  }
  if (options.caseId) {
    selected = selected.filter((testCase) => testCase.id === options.caseId);
  }
  if (selected.length === 0) {
    throw new Error("No Harness cases matched the requested filters.");
  }

  return { allCases, selected, mode };
}

async function runCase(testCase: HarnessCase): Promise<HarnessCaseResult> {
  process.stdout.write(`Running ${testCase.id}... `);
  try {
    const generation = await generateForHarness(testCase);
    const evaluation = evaluateHarnessCase(testCase, generation);
    const answerSummary = generation.content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);
    console.log(evaluation.status);
    return {
      id: testCase.id,
      profile: testCase.profile,
      language: testCase.language,
      question: testCase.question,
      status: evaluation.status,
      checks: evaluation.checks,
      answer: generation.content,
      answerSummary,
      generation,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("fail");
    return {
      id: testCase.id,
      profile: testCase.profile,
      language: testCase.language,
      question: testCase.question,
      status: "fail",
      checks: [
        {
          ruleId: "generation.completed",
          status: "fail",
          category: "generation_error",
          message,
        },
      ],
      answer: "",
      answerSummary: "",
      generation: null,
      error: message,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runWorker(),
    ),
  );
  return results;
}

export async function runHarness(args = process.argv.slice(2)) {
  loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");
  const options = parseCliArgs(args);
  const provider = (process.env.AI_PROVIDER ?? "mock").trim();

  if (provider === "mock" && !options.allowMock) {
    throw new Error(
      'Harness requires a real AI_PROVIDER. Configure ".env.local" or pass --allow-mock for runner-only validation.',
    );
  }

  const { allCases, selected, mode } = await selectCases(options);
  await runPreflight(allCases);
  console.log(
    `ChinaTrip AI Harness: ${mode}, ${selected.length} case(s), provider=${provider}, concurrency=${options.concurrency}`,
  );

  const previous = await readPreviousReport();
  const results = await mapWithConcurrency(
    selected,
    options.concurrency,
    runCase,
  );
  const report = createReport({
    mode,
    profile: options.profile,
    caseId: options.caseId,
    provider,
    allowMock: options.allowMock,
    concurrency: options.concurrency,
    results,
    previous,
  });
  const paths = await writeReport(report);

  console.log(
    `Summary: ${report.summary.pass} pass, ${report.summary.warning} warning, ${report.summary.fail} fail.`,
  );
  console.log(`JSON: ${path.relative(repoRoot, paths.jsonReportPath)}`);
  console.log(`Markdown: ${path.relative(repoRoot, paths.markdownReportPath)}`);

  if (
    report.summary.fail > 0 ||
    (options.failOnWarning && report.summary.warning > 0)
  ) {
    process.exitCode = 1;
  }

  return report;
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  runHarness().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
