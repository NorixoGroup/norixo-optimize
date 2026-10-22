import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { sha256Hex } from "../lib/seo/v3/editorialCatalog";

/**
 * S5.4-H tests of the offline preparation tool. The "complete" dossier built here is FICTIONAL (publisher "test only",
 * invented values) and only proves that the tool recognises a complete dossier; it creates no approval and no decision.
 * Directories are created under the system temp directory.
 *
 *   npx tsx scripts/seo-v3-prepare-data.test.ts
 */

const AS_OF = "2026-10-22T00:00:00Z";
const run = (...args: string[]) => spawnSync("npx", ["--no-install", "tsx", "scripts/seo-v3-prepare-data.ts", ...args], { encoding: "utf8", cwd: process.cwd() });
const tmp = () => join(mkdtempSync(join(tmpdir(), "seo-v3-prep-")), "dossier");
const gitState = () => spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).stdout;
const init = (out: string, city = "paris", topic = "pricing-guide") => run("init", "--city", city, "--topic", topic, "--as-of", AS_OF, "--out", out);
const check = (dir: string, extra: string[] = []) => run("check", "--dir", dir, "--as-of", AS_OF, ...extra);
type Report = { readyForHumanDecisions: boolean; blockingIssues: string[]; notes: string[]; humanDecisionsStillRequired: { requirementId: string; required: boolean; steps: string[] }[]; createsFacts: boolean; createsDecisions: boolean; approvesSources: boolean; imports: boolean; publicationAuthorised: boolean; indexingAuthorised: boolean };
const reportOf = (result: ReturnType<typeof run>) => JSON.parse(result.stdout) as Report;
const listing = (dir: string): string[] => readdirSync(dir, { recursive: true, encoding: "utf8" }).sort();
const hashes = (dir: string) => Object.fromEntries(listing(dir).filter((f) => /\.(json|md)$/.test(f)).map((f) => [f, sha256Hex(readFileSync(join(dir, f), "utf8"))]));
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

// --- a FICTIONAL complete dossier ----------------------------------------------------------------------------------------
const entry = (sourceId: string, sourceType: string, overrides: Record<string, unknown> = {}) => ({
  sourceId, publisher: "Fixture Publisher (test only)", sourceType, status: "approved", terms: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
  rights: { publicTextUse: "permitted_with_attribution", derivativeFigures: "permitted" }, requiredRestrictions: ["attribution_required"], allowedHosts: [],
  reviewedBy: "role:owner", reviewedAt: "2026-08-01T00:00:00Z", reviewValidUntil: "2027-08-01T00:00:00Z", note: null, ...overrides,
});
const sourceBlock = (sourceId: string, sourceType: string, kind: "licensed" | "editorial") => ({
  sourceId, sourceType, publisher: "Fixture Publisher (test only)", title: null,
  locator: kind === "licensed" ? { kind: "document_citation", citation: "FIXTURE - not a real publication" } : { kind: "internal_reference", reference: "fixture-note" },
  publishedAt: "2026-08-15", consultedAt: "2026-09-10T09:00:00Z",
  collectionMethod: kind === "licensed" ? { kind: "dataset_download", description: "fixture" } : { kind: "editorial_judgement", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: ["attribution_required"],
  evidence: kind === "licensed" ? [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }] : [{ kind: "internal_record", reference: "fixture-record" }],
});

/** Fills the prepared dossier by hand-like edits: removes the markers, writes sources and values. */
function complete(dir: string, options: { skipPrice?: boolean; sourceStatus?: string; derivativeFigures?: string } = {}): void {
  const sources = [
    entry("fixture-licensed", "licensed_dataset", { ...(options.sourceStatus === undefined ? {} : { status: options.sourceStatus }), ...(options.derivativeFigures === undefined ? {} : { rights: { publicTextUse: "permitted_with_attribution", derivativeFigures: options.derivativeFigures } }) }),
    entry("fixture-editorial", "editorial_note"),
  ];
  writeFileSync(join(dir, "sources.json"), JSON.stringify({ schemaVersion: "seo-v3-source-registry/1", sources }));
  for (const name of readdirSync(join(dir, "facts"))) {
    const path = join(dir, "facts", name);
    const file = readJson(path) as { facts: Record<string, unknown>[] };
    const record = { ...file.facts[0]!, factId: `fact:${name.replace(/^fact_/, "").replace(/\.json$/, "").replace(/_/g, ":")}`.replace("nightly-price-distribution", "price").replace("demand-driver", "demand").replace("neighbourhood-context", "area") };
    const requirement = name.includes("nightly-price") ? "price" : name.includes("demand") ? "demand" : "area";
    if (requirement === "price" && options.skipPrice) {
      writeFileSync(path, JSON.stringify({ schemaVersion: "seo-v3-fact-file/1", facts: [] }));
      continue;
    }
    const filled = requirement === "price"
      ? { ...record, source: sourceBlock("fixture-licensed", "licensed_dataset", "licensed"), collectedAt: "2026-09-10T10:00:00Z", observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, validUntil: "2026-12-31T00:00:00Z",
          confidence: { level: "high", rationale: "FIXTURE" }, displayConstraints: ["show_sample_size", "show_observation_period", "show_confidence", "attribute_source"], citations: [],
          value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, p25: 90, p75: 130, sampleSize: 25 } }
      : { ...record, source: sourceBlock("fixture-editorial", "editorial_note", "editorial"), collectedAt: "2026-09-10T10:00:00Z", observedPeriod: null, validUntil: "2026-12-31T00:00:00Z",
          confidence: { level: "high", rationale: "FIXTURE" }, displayConstraints: ["label_as_editorial_note", "attribute_source"], citations: [],
          value: { category: requirement === "demand" ? "demand_driver" : "neighbourhood_context", statement: `FIXTURE ${requirement} note written for tests only.`, language: "en", basis: "editorial_observation" } };
    writeFileSync(path, JSON.stringify({ schemaVersion: "seo-v3-fact-file/1", facts: [filled] }));
  }
}

test("S5.4-H init: bad arguments, unknown city or topic, and an existing directory are refused with exit 1 and nothing written", () => {
  const out = tmp();
  const bad: string[][] = [
    [], ["init"], ["init", "--city", "paris"], ["init", "--city", "atlantis", "--topic", "pricing-guide", "--as-of", AS_OF, "--out", out],
    ["init", "--city", "paris", "--topic", "not-a-topic", "--as-of", AS_OF, "--out", out], ["init", "--city", "paris", "--topic", "pricing-guide", "--as-of", "yesterday", "--out", out],
    ["init", "--city", "paris", "--topic", "pricing-guide", "--as-of", AS_OF, "--out", out, "--extra", "x"], ["init", "--city", "paris", "--city", "paris", "--topic", "pricing-guide", "--as-of", AS_OF, "--out", out],
    ["init", "--city", "--topic", "pricing-guide", "--as-of", AS_OF, "--out", out], ["frobnicate"], ["check"], ["check", "--dir", out], ["check", "--dir", out, "--as-of", "nope"],
  ];
  for (const args of bad) {
    const result = run(...args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, "", JSON.stringify(args));
  }
  assert.equal(existsSync(out), false, "nothing was created");
});

test("S5.4-H init: prepares drafts for the three requirements, keeps required and optional apart, and creates no decision log", () => {
  const out = tmp();
  const result = init(out);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(listing(out), ["README_NON_VALIDE.md", "decisions-worksheet.json", "facts", "facts/fact_fr_paris_demand-driver_v1.json", "facts/fact_fr_paris_neighbourhood-context_v1.json", "facts/fact_fr_paris_nightly-price-distribution_v1.json", "prep.json", "sources.json"]);
  assert.equal(existsSync(join(out, "decisions")), false, "no decision log");
  const prep = readJson(join(out, "prep.json")) as { expected: { requirementId: string; required: boolean }[]; requirementsVersion: string };
  assert.deepEqual(prep.expected.map((e) => [e.requirementId, e.required]).sort(), [["demand_driver", false], ["neighbourhood_context", false], ["nightly_price_distribution", true]]);
  assert.equal(prep.requirementsVersion, "seo-v3-topic-requirements/draft-3");
  for (const file of ["sources.json", ...readdirSync(join(out, "facts")).map((n) => `facts/${n}`)]) assert.ok("_DRAFT" in readJson(join(out, file)), `${file} carries the draft marker`);
  const sources = readJson(join(out, "sources.json")) as { sources: { status: string; terms: { status: string }; rights: Record<string, string> }[] };
  assert.ok(sources.sources.every((s) => s.status === "suspended" && s.terms.status === "unverified" && s.rights.publicTextUse === "unverified"), "no source is approved");
  const record = (readJson(join(out, "facts/fact_fr_paris_nightly-price-distribution_v1.json")) as { facts: Record<string, unknown>[] }).facts[0]!;
  assert.equal(record.source, null);
  assert.equal(record.collectedAt, null);
  assert.ok(!("validation" in record) && !("usage" in record), "a template never carries a validation or an approval");
  const worksheet = readJson(join(out, "decisions-worksheet.json"));
  assert.ok("_NOT_A_DECISION" in worksheet);
  assert.equal(run("init", "--city", "paris", "--topic", "pricing-guide", "--as-of", AS_OF, "--out", out).status, 1, "a second init never overwrites");
});

test("S5.4-H check: a fresh dossier is refused, and the check writes nothing and changes nothing in the repository", () => {
  const out = tmp();
  init(out);
  const before = hashes(out);
  const git = gitState();
  const result = check(out);
  assert.equal(result.status, 2);
  const report = reportOf(result);
  assert.equal(report.readyForHumanDecisions, false);
  assert.ok(report.blockingIssues.includes("sources_draft_marker_present"));
  assert.ok(report.blockingIssues.some((i) => i.startsWith("fact_draft_marker_present:")));
  assert.ok(report.blockingIssues.includes("required_fact_not_ready:nightly_price_distribution"));
  assert.ok(report.notes.includes("optional_fact_not_ready:demand_driver"), "an optional fact is a note, not a blocker");
  assert.ok(!report.blockingIssues.some((i) => i.includes("demand_driver") && i.startsWith("required")));
  assert.deepEqual(report.humanDecisionsStillRequired, []);
  assert.deepEqual([report.createsFacts, report.createsDecisions, report.approvesSources, report.imports, report.publicationAuthorised, report.indexingAuthorised], [false, false, false, false, false, false]);
  assert.deepEqual(hashes(out), before, "no file of the dossier changed");
  assert.equal(existsSync(join(out, "decisions")), false);
  assert.equal(gitState(), git);
  assert.equal(existsSync("data/seo-v3"), false);
});

test("S5.4-H check: a complete FICTIONAL dossier is ready for human decisions only: nothing is approved, validated or imported", () => {
  const out = tmp();
  init(out);
  complete(out);
  const before = hashes(out);
  const result = check(out);
  assert.equal(result.status, 0, result.stdout);
  const report = reportOf(result);
  assert.equal(report.readyForHumanDecisions, true);
  assert.deepEqual(report.blockingIssues, []);
  assert.deepEqual(report.humanDecisionsStillRequired.map((d) => [d.requirementId, d.required]).sort(), [["demand_driver", false], ["neighbourhood_context", false], ["nightly_price_distribution", true]]);
  assert.ok(report.humanDecisionsStillRequired.every((d) => d.steps.join() === "submit,validate,approve_public_use"));
  assert.deepEqual([report.createsFacts, report.createsDecisions, report.approvesSources, report.imports, report.publicationAuthorised, report.indexingAuthorised], [false, false, false, false, false, false]);
  assert.deepEqual(hashes(out), before);
  assert.equal(existsSync(join(out, "decisions")), false, "no decision was created");
});

test("S5.4-H check: incomplete or doubtful dossiers are refused with the precise cause", () => {
  const cases: [string, Parameters<typeof complete>[1], (r: Report) => void][] = [
    ["required price fact missing", { skipPrice: true }, (r) => assert.ok(r.blockingIssues.includes("required_fact_not_ready:nightly_price_distribution"))],
    ["source left suspended", { sourceStatus: "suspended" }, (r) => assert.ok(r.blockingIssues.includes("source_not_approved:fixture-licensed"))],
    ["figure rights unverified", { derivativeFigures: "unverified" }, (r) => assert.ok(r.blockingIssues.some((i) => i.includes("fixture-licensed") && /rights|refused/.test(i)) || r.blockingIssues.some((i) => i.startsWith("fact_refused:")))],
  ];
  for (const [label, options, assertion] of cases) {
    const out = tmp();
    init(out);
    complete(out, options);
    const result = check(out);
    assert.equal(result.status, 2, label);
    const report = reportOf(result);
    assert.equal(report.readyForHumanDecisions, false, label);
    assertion(report);
  }
});

test("S5.4-H/I check: a different global version alone is a note; an edited requirement, a legacy order id or a legacy fact are refused", () => {
  const out = tmp();
  init(out);
  complete(out);
  const prepPath = join(out, "prep.json");
  const prep = readJson(prepPath) as { requirementsVersion: string; city: string; expected: { requirementId: string; requirementHash: string; workOrderId: string }[] };
  // only the global version differs (a bump that did not touch these requirements): still ready, and said so
  writeFileSync(prepPath, JSON.stringify({ ...prep, requirementsVersion: "seo-v3-topic-requirements/draft-2" }));
  const same = reportOf(check(out));
  assert.equal(same.readyForHumanDecisions, true, JSON.stringify(same.blockingIssues));
  assert.ok(same.notes.some((n) => n.startsWith("prep_requirements_version_differs:")));
  // an edited definition
  writeFileSync(prepPath, JSON.stringify({ ...prep, expected: prep.expected.map((e, i) => (i === 0 ? { ...e, requirementHash: "0".repeat(64) } : e)) }));
  assert.ok(reportOf(check(out)).blockingIssues.some((i) => i.startsWith("requirement_definition_changed:")));
  // an order id from the legacy scheme (global version in the key): recognised as old, not accepted
  const legacyId = (e: { requirementId: string }, version: string) => sha256Hex(JSON.stringify({ kind: "fact", platform: "airbnb", propertyType: null, requirementId: e.requirementId, requirementsVersion: version, scope: { citySlug: prep.city, countryCode: "FR", level: "city" } }));
  writeFileSync(prepPath, JSON.stringify({ ...prep, expected: prep.expected.map((e) => ({ ...e, workOrderId: legacyId(e, "seo-v3-topic-requirements/draft-2") })) }));
  const legacy = reportOf(check(out));
  assert.equal(legacy.readyForHumanDecisions, false);
  assert.ok(legacy.blockingIssues.some((i) => i.startsWith("order_id_scheme_legacy:")));
  assert.ok(legacy.blockingIssues.some((i) => i.startsWith("fact_work_order_not_current:")), "the fact records still carry the current ids, which the legacy preparation no longer lists");
  // a fact record that carries an unknown work order id
  writeFileSync(prepPath, JSON.stringify(prep));
  assert.equal(reportOf(check(out)).readyForHumanDecisions, true);
  const factPath = join(out, "facts", "fact_fr_paris_demand-driver_v1.json");
  const file = readJson(factPath) as { facts: Record<string, unknown>[] };
  writeFileSync(factPath, JSON.stringify({ schemaVersion: "seo-v3-fact-file/1", facts: [{ ...file.facts[0]!, workOrderId: legacyId({ requirementId: "demand_driver" }, "seo-v3-topic-requirements/draft-2") }] }));
  assert.ok(reportOf(check(out)).blockingIssues.some((i) => i.startsWith("fact_work_order_not_current:")));
  writeFileSync(factPath, JSON.stringify({ schemaVersion: "seo-v3-fact-file/1", facts: [file.facts[0]!] }));
  // a leftover draft marker and a broken preparation file
  writeFileSync(factPath, JSON.stringify({ _DRAFT: "left", ...readJson(factPath) }));
  const marked = reportOf(check(out));
  assert.equal(marked.readyForHumanDecisions, false);
  assert.ok(marked.blockingIssues.some((i) => i.startsWith("fact_draft_marker_present:")));
  writeFileSync(prepPath, "{ not json");
  assert.ok(reportOf(check(out)).blockingIssues.includes("prep_missing_or_invalid"));
});

test("S5.4-H check: an unapproved source never lets a fact through, and a quote without its proof is refused", () => {
  const out = tmp();
  init(out);
  complete(out, { sourceStatus: "excluded" });
  const report = reportOf(check(out));
  assert.equal(report.readyForHumanDecisions, false);
  assert.ok(report.blockingIssues.some((i) => i.startsWith("fact_refused:") || i.startsWith("source_not_approved:")));
  // a tourism-body note needs an exact quote and its archived artifact
  const dir2 = tmp();
  init(dir2);
  complete(dir2);
  const path = join(dir2, "facts", "fact_fr_paris_demand-driver_v1.json");
  const file = readJson(path) as { facts: Record<string, unknown>[] };
  const record = file.facts[0]!;
  const source = { ...(record.source as Record<string, unknown>), sourceId: "fixture-tourism", sourceType: "official_tourism_body" };
  writeFileSync(path, JSON.stringify({ schemaVersion: "seo-v3-fact-file/1", facts: [{ ...record, source }] }));
  const sources = readJson(join(dir2, "sources.json")) as { sources: unknown[] };
  writeFileSync(join(dir2, "sources.json"), JSON.stringify({ schemaVersion: "seo-v3-source-registry/1", sources: [...sources.sources, entry("fixture-tourism", "official_tourism_body")] }));
  const result = reportOf(check(dir2));
  assert.equal(result.readyForHumanDecisions, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("citation_required")), JSON.stringify(result.blockingIssues));
});

test("S5.4-H the tool has no network, no clock, no model and writes only inside the new dossier", () => {
  const code = readFileSync("scripts/seo-v3-prepare-data.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["fetch(", "node:http", "node:https", "node:net", "node:child_process", "Date.now", "new Date(", "Math.random", "rmSync", "unlinkSync", "renameSync", "appendFileSync", "process.env"]) assert.ok(!code.includes(forbidden), forbidden);
  const writes = code.match(/writeFileSync\(([^,]+),/g) ?? [];
  assert.ok(writes.length > 0 && writes.every((w) => /join\(out,/.test(w)), "every write targets the output directory given to init");
});
