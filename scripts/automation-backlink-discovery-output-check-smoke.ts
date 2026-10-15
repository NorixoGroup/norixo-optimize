import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeBacklinkDiscoveryPreview } from "../lib/automation";
import { checkDiscoveryExport } from "./backlink-discovery-output-check";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const QUERY = "vacation rental resource directory";
const INPUT = { version: 1, source: "manual_dashboard", provider: "brave_search", searches: [{ query: QUERY, countryCode: "US", languageCode: "en" }], maxResultsPerSearch: 5, maxCandidates: 5 };

async function productionLikeOutput() {
  const items = ["alpha", "bravo", "charlie", "delta", "echo"].map((name, index) => ({ url: `https://${name}.example/page`, title: `${name} hospitality`, snippet: `${name} snippet`, rank: index + 1 }));
  const provider = { name: "brave_search" as const, async search() { return { query: QUERY, queryIndex: 0, countryCode: "US", languageCode: "en", items }; } };
  const result = await executeBacklinkDiscoveryPreview(
    { providers: { brave_search: provider } },
    { workspaceId: "w", runId: "r", taskId: "t", taskKind: "backlinks.discovery.preview", attemptedAt: new Date().toISOString(), input: INPUT } as never,
  );
  return result.output as { candidates: Record<string, unknown>[] } & Record<string, unknown>;
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function main(): Promise<void> {
  const base = await productionLikeOutput();
  assert(base.candidates.length === 5, "fixture has five candidates");

  // A. The production situation: only candidate 5 has a 500-character evidence text ending in a space.
  const productionLike = clone(base);
  productionLike.candidates[4]!.evidenceSummary = `${"x".repeat(499)} `;
  const a = await checkDiscoveryExport({ input: INPUT, output: productionLike, tasks: [{ taskKind: "backlinks.qualification.preview", status: "queued", attemptCount: 1, maxAttempts: 3, availableAt: "2026-10-11T10:00:00Z" }] });
  assert(a.ok && a.runLevelIssues.length === 0, `production-like export must be OK: ${JSON.stringify(a)}`);
  assert(a.candidates.slice(0, 4).every((c) => c.verdict === "valid" && c.repairableTextFields.length === 0), "candidates 1-4 are valid as stored");
  assert(a.candidates[4]!.verdict === "valid_after_text_repair" && a.candidates[4]!.repairableTextFields.join() === "evidenceSummary", "candidate 5 differs only by repairable evidence whitespace");
  assert(a.tasks.length === 1 && a.tasks[0]!.attemptCount === 1, "task state is passed through");

  // B. A second, unrelated defect is NOT masked by the whitespace repair, and is localized.
  const hostDefect = clone(productionLike);
  hostDefect.candidates[1]!.hostname = "other.example";
  const b = await checkDiscoveryExport({ input: INPUT, output: hostDefect });
  assert(!b.ok && b.candidates[1]!.verdict === "BLOCKING_DEFECT" && b.candidates[1]!.blockingFields.join().includes("hostname+sourceUrl"), `hostname defect: ${JSON.stringify(b.candidates[1])}`);
  assert(b.candidates[4]!.verdict === "valid_after_text_repair", "the whitespace candidate is still reported as repairable");

  const titleDefect = clone(base);
  titleDefect.candidates[2]!.pageTitle = "t".repeat(301);
  const c = await checkDiscoveryExport({ input: INPUT, output: titleDefect });
  // A 301-character title is truncated by the repair; it is repairable text, not a blocking defect.
  assert(c.ok && c.candidates[2]!.verdict === "valid_after_text_repair" && c.candidates[2]!.repairableTextFields.join() === "pageTitle", "an over-long title is repairable text");

  const badRank = clone(base);
  badRank.candidates[0]!.rank = 0;
  const d = await checkDiscoveryExport({ input: INPUT, output: badRank });
  assert(!d.ok && d.candidates[0]!.blockingFields.join() === "rank", `rank defect: ${JSON.stringify(d.candidates[0])}`);

  const badCountry = clone(base);
  badCountry.candidates[3]!.countryCode = "usa";
  const e = await checkDiscoveryExport({ input: INPUT, output: badCountry });
  assert(!e.ok && e.candidates[3]!.blockingFields.join() === "countryCode", "country code defect is localized");

  const badUrl = clone(base);
  badUrl.candidates[0]!.sourceUrl = "https://alpha.example/page#fragment";
  const f = await checkDiscoveryExport({ input: INPUT, output: badUrl });
  assert(!f.ok && f.candidates[0]!.verdict === "BLOCKING_DEFECT", "a fragment in the URL is a blocking defect");

  // C. Run-level defects.
  const duplicate = clone(base);
  duplicate.candidates[1]!.candidateKey = duplicate.candidates[0]!.candidateKey;
  const g = await checkDiscoveryExport({ input: INPUT, output: duplicate });
  assert(!g.ok && g.runLevelIssues.some((issue) => issue.includes("duplicate candidateKey")), "duplicate candidate keys are reported");
  const dirtyQuery = await checkDiscoveryExport({ input: { ...INPUT, searches: [{ query: ` ${QUERY} `, countryCode: "US", languageCode: "en" }] }, output: base });
  assert(!dirtyQuery.ok, "an untrimmed stored query is a blocking defect (qualification requires a clean query)");
  assert(!(await checkDiscoveryExport({ input: {}, output: {} })).ok, "malformed export is not OK");
  assert(!(await checkDiscoveryExport({ input: INPUT, output: { ...base, candidates: [] } })).ok, "an empty candidate list is not OK");

  // D. The checker never modifies its input and works as a CLI with meaningful exit codes.
  const snapshot = JSON.stringify(productionLike);
  await checkDiscoveryExport({ input: INPUT, output: productionLike });
  assert(JSON.stringify(productionLike) === snapshot, "the checker must not mutate the export");
  const directory = mkdtempSync(join(tmpdir(), "discovery-check-"));
  try {
    const okFile = join(directory, "ok.json");
    const badFile = join(directory, "bad.json");
    writeFileSync(okFile, JSON.stringify({ input: INPUT, output: productionLike }));
    writeFileSync(badFile, JSON.stringify({ input: INPUT, output: hostDefect }));
    const okRun = spawnSync("npx", ["tsx", "scripts/backlink-discovery-output-check.ts", okFile], { encoding: "utf8" });
    const badRun = spawnSync("npx", ["tsx", "scripts/backlink-discovery-output-check.ts", badFile], { encoding: "utf8" });
    assert(okRun.status === 0 && okRun.stdout.includes("RESULT: OK") && okRun.stdout.includes("valid_after_text_repair"), `CLI ok run: ${okRun.status} ${okRun.stdout}`);
    assert(badRun.status === 1 && badRun.stdout.includes("RESULT: NOT OK") && badRun.stdout.includes("BLOCKING"), `CLI bad run: ${badRun.status}`);
    assert(spawnSync("npx", ["tsx", "scripts/backlink-discovery-output-check.ts"], { encoding: "utf8" }).status === 2, "usage error exits 2");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  console.log("PASS — Automation backlink discovery output check smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
