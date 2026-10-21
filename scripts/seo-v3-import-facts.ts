import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { stableStringify } from "../lib/seo/v3/editorialCatalog";
import { SHA256_HEX, type ArtifactProvider } from "../lib/seo/v3/evidenceCheck";
import { importFactStore, verifyImportReport } from "../lib/seo/v3/factStore";

/**
 * Offline import of the local V3 fact store into an in-memory S2 registry. It READS files and prints a report.
 * It writes nothing, uses no network, and never creates a decision: validation and public-use approval only come
 * from decisions a person has appended to the log.
 *
 *   npx tsx scripts/seo-v3-import-facts.ts --as-of 2026-10-21T00:00:00Z [--dir data/seo-v3] [--evidence-dir <dir>]
 *                                          [--previous-report <report.json> [--expect-baseline-hash <sha256>]] [--first-import]
 *                                          [--allowed-actors role:owner,role:reviewer] [--allow-unverified-evidence] [--lenient]
 *
 * Strict by default: every decision needs --allowed-actors, and an import needs --previous-report unless --first-import
 * declares it the first one (without a baseline nothing is imported). --lenient turns this off and says so in the report.
 * None of this authenticates a person or makes the log tamper-proof; it makes silent changes visible.
 *
 * Layout under --dir (a missing directory is an empty store):
 *   sources.json          source registry
 *   facts/*.json          fact files
 *   decisions/*.jsonl     append-only decision logs
 * Archived artifacts live outside the repository, one file per SHA-256, in --evidence-dir.
 *
 * Exit code: 0 clean, 2 the report lists refused facts or file issues, 1 bad usage.
 */

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? null : (process.argv[index + 1] ?? null);
  return value !== null && value.startsWith("--") ? null : value;
}
const flag = (name: string): boolean => process.argv.includes(name);

const asOf = arg("--as-of");
if (asOf === null) {
  console.error("usage: seo-v3-import-facts.ts --as-of <ISO instant> [--dir <dir>] [--evidence-dir <dir>] [--previous-report <file>] [--allow-unverified-evidence]");
  process.exit(1);
}
const dir = resolve(arg("--dir") ?? "data/seo-v3");
const evidenceDir = arg("--evidence-dir") === null ? null : resolve(arg("--evidence-dir")!);

const readAll = (sub: string, extension: string) => {
  const folder = join(dir, sub);
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith(extension) && statSync(join(folder, name)).isFile())
    .sort()
    .map((name) => ({ name: `${sub}/${name}`, text: readFileSync(join(folder, name), "utf8") }));
};

// a hash that is not 64 lower-case hex digits never reaches the file system (no path traversal)
const artifacts: ArtifactProvider = (sha256) => {
  if (evidenceDir === null || !SHA256_HEX.test(sha256)) return null;
  const file = join(evidenceDir, sha256);
  return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
};

let previousHashes: Record<string, string> | undefined;
let previousChainHeads: Record<string, string | null> | undefined;
let previousDecisions: { decisionId: string; factId: string }[] | undefined;
if (arg("--previous-report") !== null) {
  try {
    const previous: unknown = JSON.parse(readFileSync(resolve(arg("--previous-report")!), "utf8"));
    // a baseline whose own hash does not match was edited by hand; one that differs from the recorded hash is another file
    if (!verifyImportReport(previous)) throw new Error("hash");
    const expected = arg("--expect-baseline-hash");
    if (expected !== null && previous.reportHash !== expected) throw new Error("expected");
    previousHashes = Object.fromEntries(previous.accepted.map((fact) => [fact.factId, fact.contentHash]));
    previousChainHeads = Object.fromEntries(previous.accepted.map((fact) => [fact.factId, fact.chainHead ?? null]));
    previousDecisions = previous.decisions.map((d) => ({ decisionId: d.decisionId, factId: d.factId }));
  } catch {
    console.error("--previous-report is not a readable, intact import report (or does not match --expect-baseline-hash)");
    process.exit(1);
  }
}
const actors = arg("--allowed-actors");

const sourcesFile = join(dir, "sources.json");
const { report } = importFactStore({
  factFiles: readAll("facts", ".json"),
  decisionLogs: readAll("decisions", ".jsonl"),
  sourceRegistryText: existsSync(sourcesFile) ? readFileSync(sourcesFile, "utf8") : null,
  artifacts,
  asOf,
  requireArtifacts: !flag("--allow-unverified-evidence"),
  ...(previousHashes === undefined ? {} : { previousHashes }),
  ...(previousChainHeads === undefined ? {} : { previousChainHeads }),
  ...(previousDecisions === undefined ? {} : { previousDecisions }),
  strict: !flag("--lenient"),
  firstImport: flag("--first-import"),
  ...(actors === null ? {} : { allowedActors: actors.split(",").filter((a) => a !== "") }),
});

process.stdout.write(`${stableStringify(report)}\n`);
// exitCode (not exit()) so a large report written to a pipe is not truncated
process.exitCode = report.refused.length > 0 || report.fileIssues.length > 0 || report.decisionIssues.length > 0 ? 2 : 0;
