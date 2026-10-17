/**
 * Offline checker for a persisted discovery run. READ-ONLY and fully local: it opens one JSON file that
 * the operator exported (see scripts/backlink-discovery-run-validation.sql) and never connects to a
 * database or a network. It answers one question: "do the persisted candidates have any defect beyond
 * the identified trailing-whitespace truncation issue?"
 *
 *   npx tsx scripts/backlink-discovery-output-check.ts <export.json>
 *
 * Exit code 0 only if every candidate is acceptable to BOTH the qualification and the promotion builders
 * after the text repair AND no candidate has a defect other than repairable text whitespace.
 */
import { readFileSync } from "node:fs";

import { buildBacklinkPromotionInputFromDependencies } from "../lib/automation/backlink-promotion-input-builder";
import { buildBacklinkQualificationInputFromDependency } from "../lib/automation/backlink-qualification-input-builder";
import { normalizeDiscoveryCandidateText } from "../lib/automation/backlink-text-normalization";
import { validateBacklinkDiscoveryRequest } from "../lib/automation/backlink-discovery-validation";

type Json = Record<string, unknown>;
export type CandidateReport = {
  index: number;
  candidateKey: string;
  repairableTextFields: string[];
  verdict: "valid" | "valid_after_text_repair" | "BLOCKING_DEFECT";
  blockingFields: string[];
  detail: string | null;
};
export type DiscoveryExportReport = {
  runLevelIssues: string[];
  candidates: CandidateReport[];
  tasks: { taskKind: string; status: string; attemptCount: number; maxAttempts: number; availableAt: string | null }[];
  ok: boolean;
};

const UUID = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const IDS = { workspace: UUID(1), run: UUID(3), discovery: UUID(2), qualification: UUID(4), promotion: UUID(5) };

// A known-good candidate used only to LOCALIZE a defect (swap one field group, re-run the real builders).
const GOOD: Json = {
  candidateKey: `discovery:${"0".repeat(64)}`, hostname: "example.com", sourceUrl: "https://example.com/page", pageTitle: "Title", snippet: "Snippet",
  queryIndex: 0, rank: 1, countryCode: null, languageCode: null, suggestedAssetKey: null, evidenceSummary: "Evidence", discoveryScore: 100,
};
const FIELD_GROUPS: readonly (readonly string[])[] = [
  ["candidateKey"], ["hostname", "sourceUrl"], ["pageTitle"], ["snippet"], ["queryIndex"], ["rank"], ["countryCode"], ["languageCode"],
  ["suggestedAssetKey"], ["evidenceSummary"], ["discoveryScore"],
];
const TEXT_FIELDS = ["pageTitle", "snippet", "evidenceSummary"] as const;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function buildersAccept(input: Json, output: Json, candidates: unknown[]): Promise<string | null> {
  const discoveryTask = { id: IDS.discovery, workspaceId: IDS.workspace, runId: IDS.run, taskKind: "backlinks.discovery.preview", status: "completed", input, output: { ...output, candidates } };
  const qualificationTask = { id: IDS.qualification, workspaceId: IDS.workspace, runId: IDS.run, taskKind: "backlinks.qualification.preview", status: "running", dependsOnTaskId: IDS.discovery };
  try {
    await buildBacklinkQualificationInputFromDependency({ qualificationTask } as never, { getTaskByIdInRun: async () => discoveryTask } as never);
  } catch (error) {
    return `qualification: ${(error as Error).message}`;
  }
  const promotionTask = { id: IDS.promotion, workspaceId: IDS.workspace, runId: IDS.run, taskKind: "backlinks.promotion.preview", status: "running", dependsOnTaskId: IDS.qualification };
  const qualification = {
    id: IDS.qualification, workspaceId: IDS.workspace, runId: IDS.run, taskKind: "backlinks.qualification.preview", status: "completed", dependsOnTaskId: IDS.discovery,
    output: { version: 1, kind: "backlinks.qualification.preview", dryRun: true, policyVersion: "backlink-qualification-v1", summary: {}, results: [] },
  };
  try {
    await buildBacklinkPromotionInputFromDependencies(
      { promotionTask } as never,
      { getTaskByIdInRun: async (arg: { taskId: string }) => (arg.taskId === IDS.qualification ? qualification : discoveryTask) } as never,
    );
  } catch (error) {
    return `promotion: ${(error as Error).message}`;
  }
  return null;
}

export async function checkDiscoveryExport(data: unknown): Promise<DiscoveryExportReport> {
  const runLevelIssues: string[] = [];
  const report: DiscoveryExportReport = { runLevelIssues, candidates: [], tasks: [], ok: false };
  if (!isRecord(data) || !isRecord(data.input) || !isRecord(data.output) || !Array.isArray(data.output.candidates)) {
    runLevelIssues.push("export must be an object with `input` and `output` (with a `candidates` array)");
    return report;
  }
  const { input, output } = data;
  const candidates = output.candidates as unknown[];

  try {
    validateBacklinkDiscoveryRequest(input);
  } catch (error) {
    runLevelIssues.push(`discovery input invalid: ${(error as Error).message}`);
  }
  if (Array.isArray(input.searches) && input.searches.length > 10) runLevelIssues.push("more than 10 queries");
  if (candidates.length > 50) runLevelIssues.push("more than 50 candidates");
  if (new TextEncoder().encode(JSON.stringify(output)).length > 64 * 1024) runLevelIssues.push("output larger than 64 KiB (qualification input limit)");
  if (new Set(candidates.map((c) => (isRecord(c) ? c.candidateKey : c))).size !== candidates.length) runLevelIssues.push("duplicate candidateKey");
  if (new Set(candidates.map((c) => (isRecord(c) ? c.sourceUrl : c))).size !== candidates.length) runLevelIssues.push("duplicate sourceUrl");

  if (Array.isArray(data.tasks)) {
    report.tasks = data.tasks.filter(isRecord).map((task) => ({
      taskKind: String(task.taskKind), status: String(task.status), attemptCount: Number(task.attemptCount), maxAttempts: Number(task.maxAttempts),
      availableAt: typeof task.availableAt === "string" ? task.availableAt : null,
    }));
  }

  for (const [index, raw] of candidates.entries()) {
    if (!isRecord(raw)) {
      report.candidates.push({ index, candidateKey: "?", repairableTextFields: [], verdict: "BLOCKING_DEFECT", blockingFields: ["(not an object)"], detail: null });
      continue;
    }
    const normalized = normalizeDiscoveryCandidateText(raw as never) as Json;
    const repairableTextFields = TEXT_FIELDS.filter((field) => raw[field] !== normalized[field]);
    const failure = await buildersAccept(input, output, [raw]);
    if (failure === null) {
      report.candidates.push({ index, candidateKey: String(raw.candidateKey), repairableTextFields: [...repairableTextFields], verdict: repairableTextFields.length > 0 ? "valid_after_text_repair" : "valid", blockingFields: [], detail: null });
      continue;
    }
    // Localize: which field group, once replaced by a known-good value, makes the real builders accept it?
    const blockingFields: string[] = [];
    for (const group of FIELD_GROUPS) {
      const swapped = { ...raw, ...Object.fromEntries(group.map((field) => [field, GOOD[field]])) };
      if ((await buildersAccept(input, output, [swapped])) === null) blockingFields.push(group.join("+"));
    }
    if (blockingFields.length === 0) blockingFields.push("(unlocalized: structural or multiple fields)");
    report.candidates.push({ index, candidateKey: String(raw.candidateKey), repairableTextFields: [...repairableTextFields], verdict: "BLOCKING_DEFECT", blockingFields, detail: failure });
  }

  report.ok = runLevelIssues.length === 0 && report.candidates.length > 0 && report.candidates.every((c) => c.verdict !== "BLOCKING_DEFECT");
  return report;
}

function printReport(report: DiscoveryExportReport): void {
  console.log("RUN-LEVEL ISSUES:", report.runLevelIssues.length === 0 ? "none" : report.runLevelIssues.join("; "));
  for (const c of report.candidates) {
    console.log(
      `candidate #${c.index + 1} ${c.candidateKey.slice(0, 20)}…  ${c.verdict}` +
        (c.repairableTextFields.length > 0 ? `  repairable text: ${c.repairableTextFields.join(",")}` : "") +
        (c.blockingFields.length > 0 ? `  BLOCKING: ${c.blockingFields.join(" | ")} (${c.detail})` : ""),
    );
  }
  if (report.tasks.length > 0) {
    console.log("TASK STATE (informational, resume preconditions):");
    for (const t of report.tasks) console.log(`  ${t.taskKind}  status=${t.status}  attempts=${t.attemptCount}/${t.maxAttempts}  availableAt=${t.availableAt}`);
  }
  console.log(report.ok ? "RESULT: OK — only repairable text whitespace (if any); resume may be considered." : "RESULT: NOT OK — do NOT resume; investigate the defects above.");
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: npx tsx scripts/backlink-discovery-output-check.ts <export.json>");
    process.exit(2);
  }
  checkDiscoveryExport(JSON.parse(readFileSync(file, "utf8")))
    .then((report) => {
      printReport(report);
      process.exit(report.ok ? 0 : 1);
    })
    .catch((error) => {
      console.error("checker failed:", (error as Error).message);
      process.exit(2);
    });
}
