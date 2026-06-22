import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  HarnessCaseResult,
  HarnessReport,
  HarnessRunMode,
  HarnessStatus,
} from "./types";
import { harnessRoot } from "./cases";

const reportsDir = path.join(harnessRoot, "reports");
const jsonReportPath = path.join(reportsDir, "latest.json");
const markdownReportPath = path.join(reportsDir, "latest.md");

function createStatusMap(report: HarnessReport | null) {
  return new Map(
    report?.results.map((result) => [result.id, result.status]) ?? [],
  );
}

export function compareWithPrevious(
  previous: HarnessReport | null,
  results: HarnessCaseResult[],
) {
  const previousStatuses = createStatusMap(previous);
  const currentStatuses = new Map(
    results.map((result) => [result.id, result.status]),
  );
  const newFailures = results
    .filter(
      (result) =>
        result.status === "fail" &&
        previousStatuses.get(result.id) !== "fail",
    )
    .map((result) => result.id);
  const fixedFailures = Array.from(previousStatuses.entries())
    .filter(
      ([id, status]) =>
        status === "fail" &&
        currentStatuses.has(id) &&
        currentStatuses.get(id) !== "fail",
    )
    .map(([id]) => id);
  const statusChanges = results.flatMap((result) => {
    const previousStatus = previousStatuses.get(result.id);
    return previousStatus && previousStatus !== result.status
      ? [
          {
            id: result.id,
            from: previousStatus as HarnessStatus,
            to: result.status,
          },
        ]
      : [];
  });

  return { newFailures, fixedFailures, statusChanges };
}

function summarizeResults(results: HarnessCaseResult[]) {
  return results.reduce(
    (summary, result) => {
      summary.total += 1;
      summary[result.status] += 1;
      return summary;
    },
    { total: 0, pass: 0, warning: 0, fail: 0 },
  );
}

function summarizeByProfile(results: HarnessCaseResult[]) {
  const summary: HarnessReport["byProfile"] = {};

  for (const result of results) {
    summary[result.profile] ??= {
      total: 0,
      pass: 0,
      warning: 0,
      fail: 0,
    };
    summary[result.profile].total += 1;
    summary[result.profile][result.status] += 1;
  }

  return summary;
}

function collectModels(results: HarnessCaseResult[]) {
  const models = new Map<string, HarnessReport["models"][number]>();

  for (const result of results) {
    if (!result.generation) {
      continue;
    }
    const item = {
      provider: result.generation.provider,
      model: result.generation.model,
      promptVersion: result.generation.promptVersion,
    };
    models.set(`${item.provider}:${item.model}:${item.promptVersion}`, item);
  }

  return Array.from(models.values());
}

export function createReport(input: {
  mode: HarnessRunMode;
  profile?: HarnessReport["filters"]["profile"];
  caseId?: string;
  provider: string;
  allowMock: boolean;
  concurrency: number;
  results: HarnessCaseResult[];
  previous?: HarnessReport | null;
}): HarnessReport {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    filters: {
      profile: input.profile,
      caseId: input.caseId,
    },
    environment: {
      node: process.version,
      provider: input.provider,
      allowMock: input.allowMock,
      concurrency: input.concurrency,
    },
    summary: summarizeResults(input.results),
    byProfile: summarizeByProfile(input.results),
    models: collectModels(input.results),
    comparison: compareWithPrevious(input.previous ?? null, input.results),
    results: input.results,
  };
}

function escapeTable(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderIdList(values: string[]) {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "-";
}

export function renderMarkdownReport(report: HarnessReport) {
  const lines = [
    "# ChinaTrip AI Harness Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: \`${report.mode}\``,
    `Provider: \`${report.environment.provider}\``,
    "",
    "## Summary",
    "",
    "| Total | Pass | Warning | Fail |",
    "| ---: | ---: | ---: | ---: |",
    `| ${report.summary.total} | ${report.summary.pass} | ${report.summary.warning} | ${report.summary.fail} |`,
    "",
    "## Profiles",
    "",
    "| Profile | Total | Pass | Warning | Fail |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(report.byProfile).map(
      ([profile, summary]) =>
        `| ${profile} | ${summary.total} | ${summary.pass} | ${summary.warning} | ${summary.fail} |`,
    ),
    "",
    "## Comparison",
    "",
    `New failures: ${renderIdList(report.comparison.newFailures)}`,
    "",
    `Fixed failures: ${renderIdList(report.comparison.fixedFailures)}`,
    "",
    "## Results",
    "",
    "| Case | Profile | Status | Model | Latency | RAG | Issues |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...report.results.map((result) => {
      const generation = result.generation;
      const issues =
        result.checks.length > 0
          ? result.checks
              .map((check) => `${check.ruleId}: ${check.message}`)
              .join("; ")
          : "-";
      return `| ${result.id} | ${result.profile} | **${result.status}** | ${
        generation ? escapeTable(generation.model) : "-"
      } | ${generation ? `${generation.latencyMs} ms` : "-"} | ${
        generation
          ? generation.retrieval.enabled
            ? `${generation.retrieval.matchedChunkCount} matches`
            : "degraded/off"
          : "-"
      } | ${escapeTable(issues)} |`;
    }),
    "",
  ];

  const detailedResults = report.results.filter(
    (result) => result.status !== "pass",
  );
  if (detailedResults.length > 0) {
    lines.push("## Failures And Warnings", "");
    for (const result of detailedResults) {
      lines.push(
        `### ${result.id}`,
        "",
        `Question: ${result.question}`,
        "",
        `Answer summary: ${result.answerSummary || "-"}`,
        "",
        ...result.checks.map(
          (check) =>
            `- **${check.status}** \`${check.ruleId}\`: ${check.message}`,
        ),
        "",
      );
    }
  }

  return lines.join("\n");
}

export async function readPreviousReport() {
  try {
    return JSON.parse(await readFile(jsonReportPath, "utf8")) as HarnessReport;
  } catch {
    return null;
  }
}

export async function writeReport(report: HarnessReport) {
  await mkdir(reportsDir, { recursive: true });
  await Promise.all([
    writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(markdownReportPath, `${renderMarkdownReport(report)}\n`),
  ]);

  return { jsonReportPath, markdownReportPath };
}
