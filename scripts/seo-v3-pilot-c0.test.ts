import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildCollectionPlan, serializeCollectionPlan, type CollectionSheet, type SourceCoverageClaim } from "../lib/seo/v3/collectionSheet";
import { classifyCoverage, type CoverageReport, type ThresholdProfile } from "../lib/seo/v3/coverageClassifier";
import { stableStringify } from "../lib/seo/v3/editorialCatalog";
import { sha256OfBytes, type ArtifactProvider } from "../lib/seo/v3/evidenceCheck";
import {
  FACT_FILE_SCHEMA, createDecision, importFactStore, verifyImportReport, type DecisionAction, type DecisionRecord, type ImportInput, type ImportReport,
} from "../lib/seo/v3/factStore";
import type { GeographicScope } from "../lib/seo/v3/localFact";
import { SOURCE_REGISTRY_SCHEMA, parseSourceRegistry } from "../lib/seo/v3/sourceRegistry";
import { createFactRegistry } from "../lib/seo/v3/factRegistry";
import { TOPIC_REQUIREMENTS, type TopicRequirements } from "../lib/seo/v3/topicRequirements";

/**
 * S5.3-C0: hardened journal and a rehearsal of the pilot with FICTIONAL data.
 *
 * Paris, Barcelona and Amsterdam only lend their slugs and country names so that the real city list and the real
 * country-code table are exercised. Everything else is a fixture: the publisher says "test only", the source is made up,
 * the archived "page" is a sentence invented here, the time zone is the neutral "Etc/GMT-1", the rules say nothing real,
 * and every decision below was typed by this test, not by a person. Nothing here is, or may become, a real fact.
 *
 *   npx tsx scripts/seo-v3-pilot-c0.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const PILOT = [
  { slug: "paris", country: "France", countryCode: "FR" },
  { slug: "barcelona", country: "Spain", countryCode: "ES" },
  { slug: "amsterdam", country: "Netherlands", countryCode: "NL" },
] as const;
const TOPIC = "long-stay-guide";

// Since draft-2 the long-stay rule is OPTIONAL, so S5.2 raises no order for it. This file rehearses the whole chain
// (orders -> sheets -> import -> classification), so, in this test process only, the REAL long-stay requirement
// (same definition and type filter) is made required, as a future editorial decision could do. Nothing is written.
{
  const table = TOPIC_REQUIREMENTS as Record<string, TopicRequirements>;
  const current = table[TOPIC]!;
  const rule = current.optional.find((r) => r.requirementId === "long_stay_rule")!;
  table[TOPIC] = { ...current, required: [rule], optional: current.optional.filter((r) => r !== rule), standalonePolicy: "requires_all_required_facts" };
}
const ACTORS = ["role:owner"];
const PUBLISHER = "Fixture Publisher (test only)";

// --- fictional artifacts: one invented page per city, holding two invented sentences --------------------------------
const ruleQuote = (slug: string) => `The fixture stay rule for ${slug} is stated here (test only).`;
const zoneQuote = (slug: string) => `The fixture zone for ${slug} is Etc/GMT-1 (test only).`;
const pageText = (slug: string) => `FIXTURE archived page for ${slug}. ${ruleQuote(slug)} ${zoneQuote(slug)} End of the fixture page.`;
const bytesOf = (slug: string) => new TextEncoder().encode(pageText(slug));
const shaOf = (slug: string) => sha256OfBytes(bytesOf(slug));
const provider: ArtifactProvider = (sha) => PILOT.map((c) => c.slug).find((slug) => shaOf(slug) === sha) === undefined ? null : bytesOf(PILOT.find((c) => shaOf(c.slug) === sha)!.slug);

const sourceEntry = (overrides: Record<string, unknown> = {}) => ({
  sourceId: "fixture-source-official", publisher: PUBLISHER, sourceType: "official_authority", status: "approved",
  terms: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
  rights: { publicTextUse: "permitted_with_attribution", derivativeFigures: "permitted" }, requiredRestrictions: ["attribution_required"],
  allowedHosts: ["fixture.example"], reviewedBy: "role:owner", reviewedAt: "2026-08-01T00:00:00Z", reviewValidUntil: "2027-08-01T00:00:00Z", note: null, ...overrides,
});
const sourcesText = (entries: unknown[] = [sourceEntry()]) => JSON.stringify({ schemaVersion: SOURCE_REGISTRY_SCHEMA, sources: entries });
const scopeOf = (c: (typeof PILOT)[number]): GeographicScope => ({ level: "city", countryCode: c.countryCode, citySlug: c.slug });
const claims = (): SourceCoverageClaim[] => [{
  sourceId: "fixture-source-official", scopes: PILOT.map(scopeOf), requirementIds: ["long_stay_rule", "timezone"],
  declaredBy: "role:owner", declaredAt: "2026-09-01T00:00:00Z", basis: "FIXTURE: declared by this test only",
}];

// --- pipeline steps -----------------------------------------------------------------------------------------------------
type Rec = Record<string, unknown> & { factId: string };

function source(slug: string) {
  return {
    sourceId: "fixture-source-official", sourceType: "official_authority", publisher: PUBLISHER, title: null,
    locator: { kind: "url", url: "https://fixture.example/pilot" }, publishedAt: "2026-08-15", consultedAt: "2026-09-10T09:00:00Z",
    collectionMethod: { kind: "manual_reading", description: "fixture" }, termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
    publicationRestrictions: ["attribution_required"], evidence: [{ kind: "content_hash", algorithm: "sha256", value: shaOf(slug) }],
  };
}
const citation = (slug: string, quote: string) => ({
  artifactSha256: shaOf(slug), quote, locator: "fixture section",
  applicability: { geographic: `FIXTURE: the invented page names ${slug}.`, temporal: "FIXTURE: invented, in force for the test.", semantic: "FIXTURE: the invented sentence states the fixture fact." },
});

/** Turns a sheet's template into a complete record. The values are invented here; nothing is read from anywhere. */
function fill(sheet: CollectionSheet): Rec {
  const slug = (sheet.scope as { citySlug: string }).citySlug;
  const isZone = sheet.kind === "timezone";
  return {
    ...sheet.recordTemplate, factId: sheet.suggestedFactId, source: source(slug), collectedAt: "2026-09-10T10:00:00Z", observedPeriod: null,
    validUntil: "2026-12-31T00:00:00Z", confidence: { level: "high", rationale: "FIXTURE" },
    displayConstraints: isZone ? [] : ["attribute_source"], citations: [citation(slug, isZone ? zoneQuote(slug) : ruleQuote(slug))],
    value: isZone
      ? { attribute: "timezone", value: "Etc/GMT-1" }
      : { ruleType: "minimum_stay", rule: `FIXTURE rule for ${slug}, invented, without any figure.`, effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE-ref" },
  } as Rec;
}

type Step = { action: DecisionAction; at: string; scope?: string[] };
function decide(record: Rec, steps: Step[], actor = "role:owner"): DecisionRecord[] {
  const hash = stableStringify(record) && importHash(record);
  const out: DecisionRecord[] = [];
  const cites = (record.citations as { artifactSha256: string }[]).map((c) => c.artifactSha256);
  for (const step of steps) {
    out.push(createDecision({
      factId: record.factId, factContentHash: hash, action: step.action, actor, at: step.at,
      note: step.action === "validate" ? "FIXTURE review typed by the test" : null,
      checks: step.action === "validate" ? { geographic: true, temporal: true, semantic: true } : null,
      reviewedCitationSha256s: step.action === "validate" ? cites : null,
      publicUseScope: step.action === "approve_public_use" ? (step.scope ?? "any_topic") : null,
      previousDecisionId: out.length === 0 ? null : out[out.length - 1]!.decisionId,
    }));
  }
  return out;
}
import { factContentHash } from "../lib/seo/v3/factStore";
const importHash = (record: Rec) => factContentHash(record);
const FULL: Step[] = [{ action: "submit", at: "2026-09-11T09:00:00Z" }, { action: "validate", at: "2026-09-11T10:00:00Z" }, { action: "approve_public_use", at: "2026-09-12T10:00:00Z", scope: [TOPIC] }];
const TZ: Step[] = [{ action: "submit", at: "2026-09-13T09:00:00Z" }, { action: "validate", at: "2026-09-13T10:00:00Z" }];

const factFile = (records: Rec[], name = "facts/pilot.json") => ({ name, text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: records }) });
const logFile = (decisions: DecisionRecord[], name = "decisions/pilot.jsonl") => ({ name, text: decisions.map((d) => JSON.stringify(d)).join("\n") });

type StoreState = { records: Rec[]; decisions: DecisionRecord[] };
function doImport(state: StoreState, overrides: Partial<ImportInput> = {}) {
  return importFactStore({
    factFiles: [factFile(state.records)], decisionLogs: [logFile(state.decisions)], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF,
    strict: true, allowedActors: ACTORS, firstImport: true, ...overrides,
  });
}
const baselineOf = (report: ImportReport): Partial<ImportInput> => ({
  firstImport: false,
  previousHashes: Object.fromEntries(report.accepted.map((f) => [f.factId, f.contentHash])),
  previousChainHeads: Object.fromEntries(report.accepted.map((f) => [f.factId, f.chainHead])),
  previousDecisions: report.decisions,
});
const classify = (registry: ReturnType<typeof createFactRegistry>, thresholdProfile: ThresholdProfile): CoverageReport =>
  classifyCoverage({ cities: PILOT.map((c) => ({ slug: c.slug, country: c.country })), topics: [TOPIC], registry, asOf: AS_OF, thresholdProfile, propertyType: null });
const planFor = (report: CoverageReport, registry = createFactRegistry()) =>
  buildCollectionPlan({ orders: report.workOrders, asOf: AS_OF, sourceRegistry: parseSourceRegistry(sourcesText()), sourceCoverage: claims(), registry, importBaseline: null });
const sheetsOf = (plan: ReturnType<typeof planFor>, kind: "fact" | "timezone", requirementId: string) => plan.sheets.filter((s) => s.kind === kind && s.requirementId === requirementId);

/** The whole rehearsal, phase by phase. Returns every artefact so tests can inspect or alter them. */
function rehearsal() {
  const empty = createFactRegistry();
  const phase0 = classify(empty, "draft-provisional");
  const plan0 = planFor(phase0);
  const ruleSheets = sheetsOf(plan0, "fact", "long_stay_rule");
  const rules = ruleSheets.map(fill);
  const ruleDecisions = rules.flatMap((r) => decide(r, FULL));
  const store1: StoreState = { records: rules, decisions: ruleDecisions };
  const import1 = doImport(store1);
  const phase1 = classify(import1.registry, "draft-provisional");
  const plan1 = planFor(phase1, import1.registry);
  const zoneSheets = sheetsOf(plan1, "timezone", "timezone");
  const zones = zoneSheets.map(fill);
  const store2: StoreState = { records: [...rules, ...zones], decisions: [...ruleDecisions, ...zones.flatMap((z) => decide(z, TZ))] };
  const import2 = doImport(store2, baselineOf(import1.report));
  return { phase0, plan0, ruleSheets, rules, store1, import1, phase1, plan1, zoneSheets, zones, store2, import2 };
}
const codes = (report: ImportReport, factId?: string) => report.refused.filter((r) => factId === undefined || r.factId === factId).flatMap((r) => r.issues.map((i) => i.code));

// --- the rehearsal ------------------------------------------------------------------------------------------------------

test("C0 pilot, step 1: S5.2 orders for the three cities become S5.3-B sheets grouped under the declared fictional source", () => {
  const { phase0, plan0, ruleSheets } = rehearsal();
  assert.equal(phase0.workOrders.length, 3, "the pilot topic needs one official rule per city");
  assert.ok(phase0.entries.every((e) => e.countryCode !== null && !e.blockers.includes("country_iso_unknown")), "the real ISO table resolves France, Spain and the Netherlands");
  assert.deepEqual(phase0.entries.map((e) => e.countryCode).sort(), ["ES", "FR", "NL"]);
  assert.equal(ruleSheets.length, 3);
  assert.deepEqual(ruleSheets.map((s) => (s.scope as { countryCode: string }).countryCode).sort(), ["ES", "FR", "NL"]);
  for (const sheet of ruleSheets) {
    assert.equal(sheet.platform, "airbnb");
    assert.deepEqual(sheet.acceptedSourceTypes, ["official_authority"]);
    assert.deepEqual(sheet.candidateSources.map((c) => c.sourceId), ["fixture-source-official"]);
    assert.deepEqual(sheet.pages.map((p) => p.topic), [TOPIC]);
    assert.equal(sheet.status, "ready_to_collect");
    assert.ok(sheet.humanSteps.includes("confirm_provisional_thresholds"));
  }
  const batch = plan0.batches.find((b) => b.sourceId === "fixture-source-official")!;
  assert.equal(batch.units.length, 3, "one research unit per country: a source is never assumed to cover another city");
  assert.ok(batch.units.every((u) => u.cityCount === 1));
  assert.deepEqual(plan0.sheets.filter((s) => s.requirementId === "timezone"), [], "no timezone order exists before a rule needs one");
});

test("C0 pilot, step 2: with validated rules a time zone becomes the next blocker, then a platform-neutral sheet", () => {
  const { import1, phase1, zoneSheets } = rehearsal();
  assert.deepEqual(import1.report.refused, []);
  assert.ok(import1.report.accepted.every((f) => f.state === "human_validated" && f.evidence === "verified"));
  assert.equal(import1.report.baselineStatus, "absent_first_import");
  for (const c of PILOT) {
    const entry = phase1.entries.find((e) => e.citySlug === c.slug && e.topic === TOPIC)!;
    assert.ok(entry.blockers.includes("timezone_unvalidated"), c.slug);
    assert.equal(entry.coverageClass, "needs_data");
  }
  assert.equal(zoneSheets.length, 3);
  for (const sheet of zoneSheets) {
    assert.equal(sheet.platform, null);
    assert.equal(sheet.requirementId, "timezone");
    assert.deepEqual(sheet.candidateSources.map((c) => c.sourceId), ["fixture-source-official"]);
  }
});

test("C0 pilot, step 3: the chain ends in S5.2 with pages that are experimental at best and never publishable", () => {
  const { import2, store2 } = rehearsal();
  assert.deepEqual(import2.report.refused, []);
  assert.equal(import2.report.accepted.length, 6);
  assert.equal(import2.report.baselineStatus, "provided");
  assert.equal(import2.report.counts.decisions, store2.decisions.length);
  const strict = classify(import2.registry, "draft-provisional");
  const experimental = classify(import2.registry, "experimental-pipeline-validation");
  for (const c of PILOT) {
    const s = strict.entries.find((e) => e.citySlug === c.slug)!;
    assert.deepEqual(s.blockers, ["threshold_unconfirmed"], "only the unconfirmed threshold remains");
    assert.equal(s.coverageClass, "needs_human_decision");
    const x = experimental.entries.find((e) => e.citySlug === c.slug)!;
    assert.equal(x.coverageClass, "experimental_candidate");
    assert.equal(x.experimentalOnly, true);
    assert.equal(x.rawAssemblyStatus, "not_assembled");
    assert.equal(x.publicationAuthorised, false);
    assert.equal(x.indexingAuthorised, false);
  }
  assert.equal(experimental.stats.readyCount, 0);
  assert.equal(experimental.workOrders.filter((o) => o.kind === "timezone").length, 0);
});

test("C0 pilot: every output is byte-identical across runs and across input order", () => {
  const a = rehearsal();
  const b = rehearsal();
  assert.equal(stableStringify(a.import2.report), stableStringify(b.import2.report));
  assert.equal(serializeCollectionPlan(a.plan1), serializeCollectionPlan(b.plan1));
  assert.equal(stableStringify(classify(a.import2.registry, "experimental-pipeline-validation")), stableStringify(classify(b.import2.registry, "experimental-pipeline-validation")));
  const shuffled = importFactStore({
    factFiles: [factFile([...a.store2.records].reverse(), "facts/b.json")], decisionLogs: [logFile([...a.store2.decisions].reverse(), "decisions/b.jsonl")],
    sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF, strict: true, allowedActors: ACTORS, ...baselineOf(a.import1.report),
  });
  assert.equal(shuffled.report.registrySnapshotId, a.import2.report.registrySnapshotId);
  assert.equal(shuffled.report.decisionLogHash, a.import2.report.decisionLogHash);
  assert.ok(verifyImportReport(a.import2.report));
});

// --- refusals ------------------------------------------------------------------------------------------------------------

test("C0 refusal: a source that is not registered, excluded or past its review lets no fact through", () => {
  const { store2, import1 } = rehearsal();
  for (const [label, text] of [["unregistered", sourcesText([])], ["excluded", sourcesText([sourceEntry({ status: "excluded" })])], ["expired", sourcesText([sourceEntry({ reviewValidUntil: "2026-09-01T00:00:00Z" })])]] as const) {
    const res = doImport(store2, { sourceRegistryText: text, ...baselineOf(import1.report) });
    assert.equal(res.registry.size(), 0, label);
    assert.ok(classify(res.registry, "experimental-pipeline-validation").entries.every((e) => e.coverageClass === "needs_data"), label);
  }
});

test("C0 refusal: a fact without proof, or with a quote that is not in the archived page, is refused", () => {
  const { store1 } = rehearsal();
  const bare = { ...store1.records[0]!, citations: [] } as Rec;
  assert.ok(codes(doImport({ records: [bare], decisions: [] }).report, bare.factId).includes("citation_required"));
  const forged = { ...store1.records[0]!, citations: [{ ...citation("paris", "A sentence the invented page does not contain at all."), artifactSha256: shaOf("paris") }] } as Rec;
  assert.ok(codes(doImport({ records: [forged], decisions: [] }).report, forged.factId).includes("citation_quote_not_found"));
  assert.ok(codes(doImport(store1, { artifacts: () => null }).report).includes("citation_artifact_unavailable"));
});

test("C0 refusal: an altered journal blocks the fact and is reported, whether a line is edited, deleted or invented", () => {
  const { store2, import2 } = rehearsal();
  const tamper = (mutate: (lines: string[]) => string[]) => importFactStore({
    factFiles: [factFile(store2.records)], decisionLogs: [{ name: "decisions/pilot.jsonl", text: mutate(store2.decisions.map((d) => JSON.stringify(d))).join("\n") }],
    sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF, strict: true, allowedActors: ACTORS, ...baselineOf(import2.report),
  }).report;
  const edited = tamper((lines) => lines.map((l, i) => (i === 1 ? l.replace("typed by the test", "typed by someone else") : l)));
  assert.ok(edited.decisionIssues.some((i) => i.code === "decision_id_mismatch"));
  assert.ok(edited.refused.length > 0);
  const lastParis = store2.decisions.filter((d) => d.factId === store2.records[0]!.factId);
  const removed = tamper((lines) => lines.filter((l) => !l.includes(lastParis[lastParis.length - 1]!.decisionId)));
  assert.ok(removed.decisionIssues.some((i) => i.code === "decision_removed_since_previous"), "a deleted decision is visible against the baseline");
  assert.ok(codes(removed, store2.records[0]!.factId).includes("decision_history_rewritten"));
  const invented = tamper((lines) => [...lines, '{"schemaVersion":"seo-v3-decision/1","decisionId":"x"}']);
  assert.ok(invented.refused.length > 0, "an unattributable line fails closed for every fact that has decisions");
  assert.equal(import2.report.decisionLogHash === removed.decisionLogHash, false, "the global decision digest changes when a decision disappears");
});

test("C0 refusal: strict mode demands a baseline after the first import and an allow-list for every decision", () => {
  const { store2, import1 } = rehearsal();
  const noBaseline = doImport(store2, { firstImport: false });
  assert.equal(noBaseline.registry.size(), 0, "without a baseline nothing is imported");
  assert.equal(noBaseline.report.baselineStatus, "absent_refused");
  assert.ok(noBaseline.report.fileIssues.some((i) => i.code === "baseline_required"));
  const noList = doImport(store2, { allowedActors: undefined, ...baselineOf(import1.report) });
  assert.ok(noList.report.decisionIssues.some((i) => i.code === "decision_actor_allowlist_missing"));
  assert.ok(noList.report.decisionIssues.every((i) => ["decision_actor_allowlist_missing", "decision_removed_since_previous"].includes(i.code)));
  assert.equal(noList.registry.size(), 0);
  const stranger = doImport(store2, { allowedActors: ["role:reviewer"], ...baselineOf(import1.report) });
  assert.ok(stranger.report.decisionIssues.some((i) => i.code === "decision_actor_not_allowed"));
  assert.equal(stranger.registry.size(), 0);
  const lenient = doImport(store2, { strict: false, allowedActors: undefined, firstImport: false });
  assert.equal(lenient.report.strict, false);
  assert.equal(lenient.report.baselineStatus, "absent_not_required");
  assert.equal(lenient.report.accepted.length, 6, "lenient mode works but says so in the report");
});

test("C0 refusal: a fact placed in the wrong country answers no page, and a sheet cannot cover a page outside its scope", () => {
  const { store1, ruleSheets } = rehearsal();
  const misplaced = { ...store1.records[0]!, scope: { level: "city", countryCode: "ES", citySlug: "paris" } } as Rec;
  const res = doImport({ records: [misplaced], decisions: decide(misplaced, FULL) });
  assert.equal(res.registry.size(), 1, "the registry knows no map of cities and accepts it");
  const paris = classify(res.registry, "experimental-pipeline-validation").entries.find((e) => e.citySlug === "paris")!;
  assert.equal(paris.countryCode, "FR");
  assert.equal(paris.coverageClass, "needs_data", "exact scope: a fact stored under ES never answers a page resolved to FR");
  const order = classify(createFactRegistry(), "draft-provisional").workOrders.find((o) => o.requirementId === "long_stay_rule" && o.scope.level === "city" && o.scope.citySlug === "paris")!;
  const wrong = buildCollectionPlan({ orders: [{ ...order, coversPages: [{ citySlug: "barcelona", topic: TOPIC }] }], asOf: AS_OF });
  assert.equal(wrong.sheets.length, 1);
  assert.ok(wrong.sheets[0]!.issues.includes("page_outside_scope"));
  assert.equal(wrong.sheets[0]!.status, "incomplete");
  assert.equal(ruleSheets.length, 3);
});

// --- journal hardening ----------------------------------------------------------------------------------------------------

test("C0 journal: a decision of the previous import that disappeared is detected per fact and globally", () => {
  const { store1, import1 } = rehearsal();
  const kept = store1.decisions.slice(0, store1.decisions.length - 1);
  const res = doImport({ records: store1.records, decisions: kept }, baselineOf(import1.report));
  assert.ok(res.report.decisionIssues.some((i) => i.code === "decision_removed_since_previous"));
  assert.notEqual(res.report.decisionLogHash, import1.report.decisionLogHash);
  // the decision list alone (no chain heads) is enough to flag the fact whose decisions vanished
  const onlyList = doImport({ records: store1.records, decisions: store1.decisions.filter((d) => d.factId !== store1.records[0]!.factId) }, { firstImport: false, previousHashes: baselineOf(import1.report).previousHashes!, previousDecisions: import1.report.decisions });
  assert.ok(codes(onlyList.report, store1.records[0]!.factId).includes("decision_history_rewritten"));
  assert.equal(doImport(store1, baselineOf(import1.report)).report.decisionLogHash, import1.report.decisionLogHash, "an unchanged log keeps its digest");
});

test("C0 journal: a second approval needs the first to be withdrawn; invalid transitions stay refused", () => {
  const { store1 } = rehearsal();
  const record = store1.records[0]!;
  const twice = decide(record, [...FULL, { action: "approve_public_use", at: "2026-09-14T10:00:00Z", scope: [TOPIC] }]);
  assert.ok(codes(doImport({ records: [record], decisions: twice }).report, record.factId).includes("decision_transition_invalid"));
  const withdrawn = decide(record, [...FULL, { action: "withdraw_public_use", at: "2026-09-14T10:00:00Z" }, { action: "approve_public_use", at: "2026-09-15T10:00:00Z", scope: [TOPIC] }]);
  assert.deepEqual(doImport({ records: [record], decisions: withdrawn }).report.refused, []);
  const early = decide(record, [{ action: "validate", at: "2026-09-11T10:00:00Z" }]);
  assert.ok(codes(doImport({ records: [record], decisions: early }).report, record.factId).includes("decision_transition_invalid"));
});

test("C0 journal: a baseline report that was edited by hand no longer verifies", () => {
  const { import2 } = rehearsal();
  assert.equal(verifyImportReport(import2.report), true);
  const edited = JSON.parse(JSON.stringify(import2.report)) as ImportReport & { accepted: { state: string }[] };
  edited.accepted[0]!.state = "human_validated";
  edited.accepted[0] = { ...edited.accepted[0]!, contentHash: "f".repeat(64) } as never;
  assert.equal(verifyImportReport(edited), false);
  assert.equal(verifyImportReport(null), false);
  assert.equal(verifyImportReport({ ...import2.report, reportHash: "0".repeat(64) }), false);
  assert.equal(verifyImportReport({ ...import2.report, schemaVersion: "other" }), false);
});

// --- the command line, end to end ----------------------------------------------------------------------------------------

test("C0 script: strict by default, verified baseline, recorded baseline hash", () => {
  const { store2, store1 } = rehearsal();
  const root = mkdtempSync(join(tmpdir(), "norixo-c0-"));
  const make = (name: string, state: StoreState) => {
    const dir = join(root, name);
    for (const sub of ["facts", "decisions"]) mkdirSync(join(dir, sub), { recursive: true });
    writeFileSync(join(dir, "sources.json"), sourcesText());
    writeFileSync(join(dir, "facts", "pilot.json"), factFile(state.records).text);
    writeFileSync(join(dir, "decisions", "pilot.jsonl"), `${logFile(state.decisions).text}\n`);
    return dir;
  };
  const evidence = join(root, "evidence");
  mkdirSync(evidence);
  for (const c of PILOT) writeFileSync(join(evidence, shaOf(c.slug)), bytesOf(c.slug));
  const script = new URL("./seo-v3-import-facts.ts", import.meta.url).pathname;
  const run = (args: string[]) => spawnSync("npx", ["--no-install", "tsx", script, "--as-of", AS_OF, "--evidence-dir", evidence, ...args], { encoding: "utf8" });
  const dir1 = make("store1", store1);
  const dir2 = make("store2", store2);

  assert.equal(run(["--dir", dir1, "--allowed-actors", "role:owner"]).status, 2, "no baseline and not declared as the first import: refused");
  assert.equal(run(["--dir", dir1, "--first-import"]).status, 2, "decisions without an allow-list: refused");
  const first = run(["--dir", dir1, "--first-import", "--allowed-actors", "role:owner"]);
  assert.equal(first.status, 0, first.stderr);
  const firstReport = JSON.parse(first.stdout) as ImportReport;
  assert.equal(firstReport.baselineStatus, "absent_first_import");
  assert.equal(firstReport.strict, true);

  const baselineFile = join(root, "baseline.json");
  writeFileSync(baselineFile, first.stdout);
  const second = run(["--dir", dir2, "--allowed-actors", "role:owner", "--previous-report", baselineFile, "--expect-baseline-hash", firstReport.reportHash]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).baselineStatus, "provided");
  assert.equal(second.stdout, run(["--dir", dir2, "--allowed-actors", "role:owner", "--previous-report", baselineFile, "--expect-baseline-hash", firstReport.reportHash]).stdout, "byte-identical");

  assert.equal(run(["--dir", dir2, "--allowed-actors", "role:owner", "--previous-report", baselineFile, "--expect-baseline-hash", "e".repeat(64)]).status, 1, "another baseline than the recorded one");
  const forged = JSON.parse(first.stdout) as ImportReport;
  (forged.accepted[0] as { contentHash: string }).contentHash = "d".repeat(64);
  const forgedFile = join(root, "forged.json");
  writeFileSync(forgedFile, JSON.stringify(forged));
  assert.equal(run(["--dir", dir2, "--allowed-actors", "role:owner", "--previous-report", forgedFile]).status, 1, "a baseline edited by hand is rejected");
  const lenient = JSON.parse(run(["--dir", dir1, "--lenient"]).stdout) as ImportReport;
  assert.equal(lenient.strict, false);
});
