import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { classifyCoverage } from "../lib/seo/v3/coverageClassifier";
import { checkCitation, citationShapeIssues, sha256OfBytes, type ArtifactProvider, type Citation } from "../lib/seo/v3/evidenceCheck";
import { stableStringify } from "../lib/seo/v3/editorialCatalog";
import {
  FACT_FILE_SCHEMA, FACT_RECORD_SCHEMA, createDecision, decisionIdOf, decisionProblems, factContentHash, importFactStore,
  type DecisionAction, type DecisionRecord, type ImportInput, type ImportReport,
} from "../lib/seo/v3/factStore";
import { SOURCE_REGISTRY_SCHEMA, checkSourceForFact, isHumanActor, parseSourceRegistry } from "../lib/seo/v3/sourceRegistry";

/**
 * S5.3-A tests: local fact store, source registry, evidence check, human decisions.
 *
 * Every value is a FIXTURE: "fixture-city" does not exist, "Fixtureland" is not a country, ZZ is a reserved code,
 * publishers say "test only", the "archived page" is a made-up sentence. None of it is, or may become, a real fact.
 *
 *   npx tsx scripts/seo-v3-fact-store.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const CITY = "fixture-city";
const PUBLISHER = "Fixture Publisher (test only)";
const ARTIFACT_TEXT = "FIXTURE archived page. The fixture minimum stay rule applies in fixture-city (test only). End of the fixture page.";
const QUOTE = "The fixture minimum stay rule applies in fixture-city (test only).";
const ARTIFACT_BYTES = new TextEncoder().encode(ARTIFACT_TEXT);
const ARTIFACT_SHA = sha256OfBytes(ARTIFACT_BYTES);
const provider: ArtifactProvider = (sha) => (sha === ARTIFACT_SHA ? ARTIFACT_BYTES : null);
const noArtifacts: ArtifactProvider = () => null;

// --- fixtures -----------------------------------------------------------------------------------------------

const sourceEntry = (overrides: Record<string, unknown> = {}) => ({
  sourceId: "fixture-src-official", publisher: PUBLISHER, sourceType: "official_authority", status: "approved",
  terms: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
  rights: { publicTextUse: "permitted_with_attribution", derivativeFigures: "permitted" },
  requiredRestrictions: ["attribution_required"], allowedHosts: ["fixture.example"],
  reviewedBy: "role:owner", reviewedAt: "2026-08-01T00:00:00Z", reviewValidUntil: "2027-08-01T00:00:00Z", note: null, ...overrides,
});
const EDITORIAL_ENTRY = sourceEntry({ sourceId: "fixture-src-editorial", sourceType: "editorial_note", rights: { publicTextUse: "permitted", derivativeFigures: "permitted" }, requiredRestrictions: [], allowedHosts: [] });
const LICENSED_ENTRY = sourceEntry({ sourceId: "fixture-src-licensed", sourceType: "licensed_dataset", rights: { publicTextUse: "permitted", derivativeFigures: "permitted" }, requiredRestrictions: [], allowedHosts: [] });
const sourcesText = (entries: unknown[] = [sourceEntry(), EDITORIAL_ENTRY, LICENSED_ENTRY]) => JSON.stringify({ schemaVersion: SOURCE_REGISTRY_SCHEMA, sources: entries });

const CITATION: Citation = {
  artifactSha256: ARTIFACT_SHA, quote: QUOTE, locator: "section 1",
  applicability: { geographic: "FIXTURE: the page names fixture-city.", temporal: "FIXTURE: in force from 2026-01-01.", semantic: "FIXTURE: the quote states the minimum stay rule." },
};
type AnyRecord = Record<string, unknown>;
type Rec = AnyRecord & { factId: string };
const baseRecord = (overrides: Record<string, unknown>): Rec => ({
  schemaVersion: FACT_RECORD_SCHEMA, scope: { level: "city", countryCode: "ZZ", citySlug: CITY }, platform: null, propertyType: null, unit: null,
  collectedAt: "2026-09-01T10:00:00Z", observedPeriod: null, validUntil: "2026-12-01T00:00:00Z", confidence: { level: "high", rationale: "FIXTURE" },
  version: 1, supersedes: null, displayConstraints: [], citations: [], workOrderId: null, ...overrides,
}) as unknown as Rec;
const ruleSource = (overrides: Record<string, unknown> = {}) => ({
  sourceId: "fixture-src-official", sourceType: "official_authority", publisher: PUBLISHER, title: null,
  locator: { kind: "url", url: "https://fixture.example/rules" }, publishedAt: "2026-08-15", consultedAt: "2026-09-01T09:00:00Z",
  collectionMethod: { kind: "manual_reading", description: "fixture" }, termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
  publicationRestrictions: ["attribution_required"], evidence: [{ kind: "content_hash", algorithm: "sha256", value: ARTIFACT_SHA }], ...overrides,
});
function ruleRecord(overrides: Record<string, unknown> = {}) {
  return baseRecord({
    factId: "fact:fixture:fixture-city:rule:2026:v1", kind: "regulatory", source: ruleSource(), relevantTopics: ["long-stay-guide"],
    displayConstraints: ["attribute_source"], citations: [CITATION],
    value: { ruleType: "minimum_stay", rule: "FIXTURE rule statement without any figure.", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE-ref" },
    ...overrides,
  });
}
const editorialSource = () => ({
  sourceId: "fixture-src-editorial", sourceType: "editorial_note", publisher: PUBLISHER, title: null, locator: { kind: "internal_reference", reference: "fixture-note" },
  publishedAt: null, consultedAt: "2026-09-01T09:00:00Z", collectionMethod: { kind: "editorial_judgement", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: [],
  evidence: [{ kind: "internal_record", reference: "fixture-record" }],
});
function guestRecord(overrides: Record<string, unknown> = {}) {
  return baseRecord({
    factId: "fact:fixture:fixture-city:guest:2026:v1", kind: "qualitative", platform: "airbnb", source: editorialSource(),
    relevantTopics: ["family-travel-guide", "amenities-guide"], displayConstraints: ["label_as_editorial_note"],
    value: { category: "guest_expectation", statement: "FIXTURE sentence without any figure.", language: "en", basis: "editorial_observation" }, ...overrides,
  });
}
function priceRecord(overrides: Record<string, unknown> = {}) {
  return baseRecord({
    factId: "fact:fixture:fixture-city:price:2026q3:v1", kind: "quantitative", platform: "airbnb", observedPeriod: { start: "2026-06-01", end: "2026-08-31" },
    source: ruleSource({ sourceId: "fixture-src-licensed", sourceType: "licensed_dataset", locator: { kind: "document_citation", citation: "FIXTURE dataset" }, publicationRestrictions: [], collectionMethod: { kind: "dataset_download", description: "fixture" } }),
    relevantTopics: ["pricing-guide"], displayConstraints: ["show_sample_size", "show_observation_period", "show_confidence"],
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, sampleSize: 25 }, ...overrides,
  });
}

const factFile = (...records: AnyRecord[]) => ({ name: "facts/fixture.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: records }) });
const hashOf = (record: AnyRecord) => factContentHash(record);

type Step = { action: DecisionAction; at: string; actor?: string; note?: string | null; scope?: "any_topic" | string[]; reviewed?: string[] };
/** A chain of explicit decisions for one record, linked by previousDecisionId. */
function chainFor(record: AnyRecord, steps: Step[], hash = hashOf(record)): DecisionRecord[] {
  const out: DecisionRecord[] = [];
  for (const step of steps) {
    out.push(createDecision({
      factId: record.factId as string, factContentHash: hash, action: step.action, actor: step.actor ?? "role:owner", at: step.at,
      note: step.note ?? (step.action === "reject" || step.action === "revoke" ? "FIXTURE reason" : null),
      checks: step.action === "validate" ? { geographic: true, temporal: true, semantic: true } : null,
      reviewedCitationSha256s: step.action === "validate" ? (step.reviewed ?? ((record.citations as Citation[]) ?? []).map((c) => c.artifactSha256)) : null,
      publicUseScope: step.action === "approve_public_use" ? (step.scope ?? "any_topic") : null,
      previousDecisionId: out.length === 0 ? null : out[out.length - 1]!.decisionId,
    }));
  }
  return out;
}
const SUBMIT: Step = { action: "submit", at: "2026-09-02T09:00:00Z" };
const VALIDATE: Step = { action: "validate", at: "2026-09-02T10:00:00Z", note: "FIXTURE review" };
const APPROVE = (scope: "any_topic" | string[] = "any_topic"): Step => ({ action: "approve_public_use", at: "2026-09-03T10:00:00Z", scope });
const logOf = (...decisions: DecisionRecord[]) => ({ name: "decisions/fixture.jsonl", text: decisions.map((d) => JSON.stringify(d)).join("\n") });

function runImport(records: AnyRecord[], decisions: DecisionRecord[] = [], overrides: Partial<ImportInput> = {}) {
  return importFactStore({
    factFiles: [factFile(...records)], decisionLogs: decisions.length === 0 ? [] : [logOf(...decisions)], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF, ...overrides,
  });
}
const codesOf = (report: ImportReport, factId: string) => report.refused.filter((r) => r.factId === factId).flatMap((r) => r.issues.map((i) => i.code));

// --- records carry no self-attested status ---------------------------------------------------------------------

test("S5.3-A record: a valid record without decisions is accepted as a draft that needs human approval", () => {
  const { registry, report } = runImport([ruleRecord()]);
  assert.deepEqual(report.refused, []);
  assert.equal(report.accepted.length, 1);
  assert.equal(report.accepted[0]!.state, "draft");
  assert.equal(report.accepted[0]!.publicUse, "requires_human_approval");
  assert.equal(report.accepted[0]!.evidence, "verified");
  const fact = registry.list()[0]!;
  assert.equal(fact.validation.status, "draft");
  assert.equal(fact.usage.use.publicUse, "requires_human_approval");
});

test("S5.3-A record: a file cannot grant itself validation or public use", () => {
  const validated = { ...ruleRecord(), validation: { status: "human_validated", validatedBy: "role:owner", validatedAt: "2026-09-02T10:00:00Z", note: null } };
  const approved = { ...ruleRecord({ factId: "fact:fixture:fixture-city:rule-b:2026:v1" }), usage: { use: { publicUse: "approved", approval: { approvedBy: "role:owner", approvedAt: "2026-09-03T10:00:00Z", scope: "any_topic" } }, displayConstraints: [] } };
  const { registry, report } = runImport([validated, approved]);
  assert.equal(registry.size(), 0);
  assert.equal(report.accepted.length, 0);
  for (const r of report.refused) assert.ok(r.issues.some((i) => i.code === "forbidden_self_attested_status"));
});

test("S5.3-A record: unknown keys, missing keys, wrong schema and malformed files are refused with static codes", () => {
  assert.ok(codesOf(runImport([{ ...ruleRecord(), extra: 1 }]).report, "fact:fixture:fixture-city:rule:2026:v1").includes("record_unknown_key"));
  const { citations: _omitted, ...missing } = ruleRecord();
  assert.ok(codesOf(runImport([missing]).report, "fact:fixture:fixture-city:rule:2026:v1").includes("record_missing_key"));
  assert.ok(codesOf(runImport([ruleRecord({ schemaVersion: "other/9" })]).report, "fact:fixture:fixture-city:rule:2026:v1").includes("record_schema_unsupported"));
  const broken = importFactStore({ factFiles: [{ name: "facts/a.json", text: "{not json" }, { name: "facts/b.json", text: JSON.stringify({ schemaVersion: "x", facts: [] }) }], decisionLogs: [], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  assert.deepEqual(broken.report.fileIssues.map((i) => i.code).sort(), ["fact_file_not_json", "fact_file_schema_invalid"]);
  assert.equal(broken.registry.size(), 0);
});

// --- decisions ---------------------------------------------------------------------------------------------------

test("S5.3-A decisions: submit, validate, approve derive validation and public use; S2 then treats the fact as usable", () => {
  const record = ruleRecord();
  const { registry, report } = runImport([record], chainFor(record, [SUBMIT, VALIDATE, APPROVE(["long-stay-guide"])]));
  assert.deepEqual(report.refused, []);
  assert.equal(report.accepted[0]!.state, "human_validated");
  assert.equal(report.accepted[0]!.publicUse, "approved");
  const fact = registry.list()[0]!;
  assert.equal(fact.validation.status, "human_validated");
  assert.equal((fact.validation as { validatedBy: string }).validatedBy, "role:owner");
  assert.equal(fact.usage.use.publicUse, "approved");
});

test("S5.3-A decisions: validation needs the three applicability checks and exactly the citations of the record", () => {
  const record = ruleRecord();
  const incomplete = { ...chainFor(record, [SUBMIT, VALIDATE])[1]!, checks: { geographic: true, temporal: true, semantic: false } };
  assert.ok(decisionProblems(incomplete).includes("validation_checks_incomplete"));
  assert.throws(() => createDecision({ factId: "fact:x:y:z:1234", factContentHash: hashOf(record), action: "validate", actor: "role:owner", at: "2026-09-02T10:00:00Z", checks: null, reviewedCitationSha256s: [] }), /validation_checks_incomplete/);
  const otherSha = "b".repeat(64);
  const notRead = chainFor(record, [SUBMIT, { ...VALIDATE, reviewed: [otherSha] }]);
  const { report } = runImport([record], notRead);
  assert.ok(codesOf(report, record.factId as string).includes("decision_citations_not_reviewed"));
  const partial = chainFor(record, [SUBMIT, { ...VALIDATE, reviewed: [] }]);
  assert.ok(codesOf(runImport([record], partial).report, record.factId as string).includes("decision_citations_not_reviewed"));
});

test("S5.3-A decisions: only a human role may decide; automated actors are refused", () => {
  for (const actor of ["role:system", "role:importer", "role:claude", "role:auto-import", "importer", "Alice", "", "role:"]) assert.equal(isHumanActor(actor), false, actor);
  for (const actor of ["role:owner", "role:reviewer", "role:editor"]) assert.equal(isHumanActor(actor), true, actor);
  assert.throws(() => createDecision({ factId: "fact:x:y:z:1234", factContentHash: "a".repeat(64), action: "submit", actor: "role:importer", at: "2026-09-02T10:00:00Z" }), /decision_actor_not_human/);
});

test("S5.3-A decisions: a decision bound to an older record is blocked once the record is edited in place", () => {
  const original = ruleRecord();
  const decisions = chainFor(original, [SUBMIT, VALIDATE]);
  const edited = ruleRecord({ value: { ruleType: "minimum_stay", rule: "FIXTURE edited statement without any figure.", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE-ref" } });
  const { registry, report } = runImport([edited], decisions);
  assert.ok(codesOf(report, original.factId as string).includes("decision_hash_mismatch"));
  assert.equal(registry.size(), 0);
});

test("S5.3-A decisions: contradictory decisions (a fork), orphans and illegal transitions block the fact", () => {
  const record = ruleRecord();
  const [submit] = chainFor(record, [SUBMIT]);
  const validate = createDecision({ factId: record.factId, factContentHash: hashOf(record), action: "validate", actor: "role:owner", at: "2026-09-02T10:00:00Z", checks: { geographic: true, temporal: true, semantic: true }, reviewedCitationSha256s: [ARTIFACT_SHA], previousDecisionId: submit!.decisionId });
  const reject = createDecision({ factId: record.factId, factContentHash: hashOf(record), action: "reject", actor: "role:reviewer", at: "2026-09-02T11:00:00Z", note: "FIXTURE no", previousDecisionId: submit!.decisionId });
  assert.ok(codesOf(runImport([record], [submit!, validate, reject]).report, record.factId).includes("decision_fork"));
  const approveFirst = chainFor(record, [APPROVE()]);
  assert.ok(codesOf(runImport([record], approveFirst).report, record.factId).includes("decision_transition_invalid"));
  const orphan = createDecision({ factId: record.factId, factContentHash: hashOf(record), action: "submit", actor: "role:owner", at: "2026-09-02T09:00:00Z", previousDecisionId: "c".repeat(64) });
  assert.ok(codesOf(runImport([record], [orphan]).report, record.factId).includes("decision_chain_broken"));
  const backwards = chainFor(record, [SUBMIT, { ...VALIDATE, at: "2026-09-01T00:00:00Z" }]);
  assert.ok(codesOf(runImport([record], backwards).report, record.factId).includes("decision_time_regression"));
});

test("S5.3-A decisions: a tampered or malformed decision line is reported and blocks its fact; unknown facts are only reported", () => {
  const record = ruleRecord();
  const good = chainFor(record, [SUBMIT]);
  const tampered = { ...good[0]!, actor: "role:reviewer" };
  const res = importFactStore({ factFiles: [factFile(record)], decisionLogs: [{ name: "decisions/a.jsonl", text: `${JSON.stringify(tampered)}\nnot json\n` }], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  assert.ok(res.report.decisionIssues.some((i) => i.code === "decision_id_mismatch"));
  assert.ok(res.report.decisionIssues.some((i) => i.code === "decision_line_not_json"));
  assert.ok(codesOf(res.report, record.factId as string).includes("decision_invalid"));
  const stray = chainFor({ ...record, factId: "fact:fixture:unknown:rule:2026:v1" }, [SUBMIT]);
  const other = runImport([record], stray);
  assert.deepEqual(other.report.decisionIssues.map((i) => i.code), ["decision_unknown_fact"]);
  assert.equal(other.report.accepted.length, 1, "an unrelated decision does not block a fact");
});

test("S5.3-A decisions: revocation and rejection forbid public use; a revoked fact is not usable", () => {
  const record = ruleRecord();
  const revoked = runImport([record], chainFor(record, [SUBMIT, VALIDATE, APPROVE(), { action: "revoke", at: "2026-09-10T10:00:00Z" }]));
  assert.equal(revoked.report.accepted[0]!.state, "revoked");
  assert.equal(revoked.report.accepted[0]!.publicUse, "forbidden");
  const rejected = runImport([record], chainFor(record, [SUBMIT, { action: "reject", at: "2026-09-02T10:00:00Z" }]));
  assert.equal(rejected.report.accepted[0]!.state, "rejected");
  const withdrawn = runImport([record], chainFor(record, [SUBMIT, VALIDATE, APPROVE(), { action: "withdraw_public_use", at: "2026-09-05T10:00:00Z" }]));
  assert.equal(withdrawn.report.accepted[0]!.publicUse, "requires_human_approval");
});

test("S5.3-A decisions: the same decision appended twice changes nothing (idempotent)", () => {
  const record = ruleRecord();
  const chain = chainFor(record, [SUBMIT, VALIDATE]);
  const once = runImport([record], chain).report;
  const twice = runImport([record], [...chain, ...chain]).report;
  assert.equal(stableStringify(once), stableStringify(twice));
});

test("S5.3-A importer: it never creates a decision and no fact becomes validated without one", () => {
  const records = [ruleRecord(), guestRecord(), priceRecord()];
  const { report } = runImport(records);
  assert.equal(report.decisionsCreated, 0);
  assert.equal(report.counts.decisions, 0);
  assert.ok(report.accepted.length > 0);
  assert.ok(report.accepted.every((fact) => fact.state === "draft" && fact.publicUse === "requires_human_approval"));
  const source = readFileSync(new URL("../lib/seo/v3/factStore.ts", import.meta.url), "utf8");
  assert.ok(!source.slice(source.indexOf("export function importFactStore")).includes("createDecision("), "the importer must not build decisions");
  assert.ok(!readFileSync(new URL("./seo-v3-import-facts.ts", import.meta.url), "utf8").includes("createDecision"));
  assert.equal(report.publicationAuthorised, false);
  assert.equal(report.indexingAuthorised, false);
});

// --- sources ---------------------------------------------------------------------------------------------------

test("S5.3-A sources: unregistered, excluded, suspended, expired and rights-insufficient sources are refused", () => {
  const id = "fact:fixture:fixture-city:rule:2026:v1";
  const refuse = (entries: unknown[], expected: string, asOf = AS_OF) => assert.ok(codesOf(runImport([ruleRecord()], [], { sourceRegistryText: sourcesText(entries), asOf }).report, id).includes(expected), expected);
  refuse([], "source_not_registered");
  refuse([sourceEntry({ status: "excluded" })], "source_excluded");
  refuse([sourceEntry({ status: "suspended" })], "source_suspended");
  refuse([sourceEntry()], "source_review_expired", "2027-09-01T00:00:00Z");
  refuse([sourceEntry({ rights: { publicTextUse: "not_permitted", derivativeFigures: "permitted" } })], "source_not_registered"); // approved + no rights: entry itself invalid
  refuse([sourceEntry({ status: "suspended", rights: { publicTextUse: "unverified", derivativeFigures: "unverified" } })], "source_rights_insufficient");
  refuse([sourceEntry({ sourceType: "published_research" })], "source_type_mismatch");
  refuse([sourceEntry({ publisher: "Someone Else" })], "source_publisher_mismatch");
  refuse([sourceEntry({ terms: { status: "verified_restrictive", summary: null, reference: null }, status: "suspended" })], "source_terms_mismatch");
  refuse([sourceEntry({ allowedHosts: ["other.example"] })], "source_host_not_allowed");
  refuse([sourceEntry({ requiredRestrictions: ["attribution_required", "aggregate_only"] })], "source_restrictions_missing");
  assert.equal(runImport([ruleRecord()], [], { sourceRegistryText: null }).report.accepted.length, 0);
});

test("S5.3-A sources: figures need figure rights; an approved entry needs proven terms; bad or duplicate entries are unusable", () => {
  const figure = runImport([priceRecord()], [], { sourceRegistryText: sourcesText([{ ...LICENSED_ENTRY, status: "suspended", rights: { publicTextUse: "permitted", derivativeFigures: "unverified" } }]) });
  assert.ok(codesOf(figure.report, "fact:fixture:fixture-city:price:2026q3:v1").includes("source_figure_rights_insufficient"));
  const unverified = parseSourceRegistry(sourcesText([sourceEntry({ terms: { status: "unverified", summary: null, reference: null } })]));
  assert.equal(unverified.entries.size, 0);
  assert.ok(unverified.issues.some((i) => i.includes("approved_requires_verified_permissive_terms")));
  const duplicate = parseSourceRegistry(sourcesText([sourceEntry(), sourceEntry()]));
  assert.equal(duplicate.entries.size, 0);
  assert.ok(duplicate.issues.some((i) => i.includes("duplicate_source_id")));
  const badActor = parseSourceRegistry(sourcesText([sourceEntry({ reviewedBy: "role:system" })]));
  assert.equal(badActor.entries.size, 0);
  assert.equal(parseSourceRegistry("{").issues[0], "registry_not_valid_json");
  const entry = parseSourceRegistry(sourcesText());
  assert.deepEqual(checkSourceForFact(entry, { kind: "regulatory", source: ruleSource() as never }, AS_OF), []);
  assert.ok(checkSourceForFact(entry, { kind: "regulatory", source: ruleSource({ locator: { kind: "url", url: "http://fixture.example/x" } }) as never }, AS_OF).includes("source_host_not_allowed"));
});

// --- citations ---------------------------------------------------------------------------------------------------

test("S5.3-A evidence: the quote must occur exactly in the artifact whose hash is cited", () => {
  assert.equal(checkCitation(CITATION, provider).status, "verified");
  assert.equal(checkCitation({ ...CITATION, quote: QUOTE.toUpperCase() }, provider).status, "quote_not_found", "no case folding");
  assert.equal(checkCitation({ ...CITATION, quote: "The fixture  minimum stay rule applies in fixture-city (test only)." }, provider).status, "quote_not_found", "no whitespace folding");
  assert.equal(checkCitation(CITATION, noArtifacts).status, "artifact_unavailable");
  assert.equal(checkCitation(CITATION, () => new TextEncoder().encode("another file")).status, "hash_mismatch");
  assert.equal(checkCitation(CITATION, () => { throw new Error("io"); }).status, "artifact_unavailable");
  assert.equal(checkCitation({ ...CITATION, quote: "short" }, provider).status, "quote_length_invalid");
  assert.equal(checkCitation({ ...CITATION, quote: "x".repeat(401) }, provider).status, "quote_length_invalid");
  assert.equal(checkCitation({ ...CITATION, artifactSha256: "nothex" }, provider).status, "malformed");
  assert.ok(citationShapeIssues({ ...CITATION, applicability: { geographic: "x", temporal: " ", semantic: "z" } }).includes("citation_applicability_temporal_missing"));
  const accented = new TextEncoder().encode("Café fixture rule applies here (test only).");
  const sha = sha256OfBytes(accented);
  assert.equal(checkCitation({ ...CITATION, artifactSha256: sha, quote: "Café fixture rule applies here" }, (s) => (s === sha ? accented : null)).status, "verified", "NFC normalisation only");
});

test("S5.3-A evidence: a failed or unanchored citation refuses the fact; missing artifacts refuse unless explicitly allowed", () => {
  const id = "fact:fixture:fixture-city:rule:2026:v1";
  assert.ok(codesOf(runImport([ruleRecord({ citations: [{ ...CITATION, quote: "A quote that is not in the archived page at all." }] })]).report, id).includes("citation_quote_not_found"));
  assert.ok(codesOf(runImport([ruleRecord({ citations: [] })]).report, id).includes("citation_required"));
  assert.ok(codesOf(runImport([ruleRecord({ source: ruleSource({ evidence: [{ kind: "internal_record", reference: "r" }] }) })]).report, id).includes("citation_hash_not_anchored"));
  assert.ok(codesOf(runImport([ruleRecord()], [], { artifacts: noArtifacts }).report, id).includes("citation_artifact_unavailable"));
  const lenient = runImport([ruleRecord()], [], { artifacts: noArtifacts, requireArtifacts: false });
  assert.equal(lenient.report.accepted[0]!.evidence, "unverified");
  assert.ok(codesOf(runImport([ruleRecord()], [], { artifacts: () => new TextEncoder().encode("wrong file") }).report, id).includes("citation_hash_mismatch"));
});

test("S5.3-A evidence: a quote found in a document is not enough, a human must confirm applicability before validation counts", () => {
  const record = ruleRecord();
  // verified quote, but no validation decision: the fact stays a draft and the S2 registry would not use it
  const { registry, report } = runImport([record]);
  assert.equal(report.accepted[0]!.evidence, "verified");
  assert.equal(registry.list()[0]!.validation.status, "draft");
  // a validation that did not read the cited artifact does not count
  const unread = chainFor(record, [SUBMIT, { ...VALIDATE, reviewed: [] }]);
  assert.equal(runImport([record], unread).registry.size(), 0);
});

// --- versions, conflicts, duplicates ---------------------------------------------------------------------------------

test("S5.3-A versions: a correction is a new record that supersedes; the old one stays, nothing is overwritten", () => {
  const v1 = ruleRecord();
  const v2 = ruleRecord({ factId: "fact:fixture:fixture-city:rule:2026:v2", version: 2, supersedes: v1.factId, collectedAt: "2026-09-15T10:00:00Z" });
  const { registry, report } = runImport([v2, v1]);
  assert.deepEqual(report.refused, []);
  assert.equal(registry.size(), 2);
  assert.equal(registry.isSuperseded(v1.factId as never), true);
  assert.equal(registry.getSuccessor(v1.factId as never)?.factId, v2.factId);
});

test("S5.3-A versions: broken chains are refused by the S2 registry and reported", () => {
  const v1 = ruleRecord();
  const gap = ruleRecord({ factId: "fact:fixture:fixture-city:rule:2026:v3", version: 3, supersedes: v1.factId });
  assert.ok(codesOf(runImport([v1, gap]).report, gap.factId as string).some((c) => c.startsWith("registry_")));
  const unknown = ruleRecord({ factId: "fact:fixture:fixture-city:rule:2026:v2", version: 2, supersedes: "fact:fixture:missing:rule:2026:v1" });
  assert.ok(codesOf(runImport([unknown]).report, unknown.factId as string).some((c) => c.startsWith("registry_")));
});

test("S5.3-A conflicts: duplicate ids, duplicate content and conflicting values are blocked, never merged", () => {
  const a = ruleRecord();
  const dup = runImport([a, a]);
  assert.equal(dup.registry.size(), 0);
  assert.equal(dup.report.refused.length, 2);
  assert.ok(dup.report.refused.every((r) => r.issues.some((i) => i.code === "duplicate_fact_id")));
  const twin = ruleRecord({ factId: "fact:fixture:fixture-city:rule:2026:twin" });
  const sameContent = runImport([a, twin]);
  assert.equal(sameContent.registry.size(), 1);
  assert.ok(sameContent.report.refused[0]!.issues.some((i) => i.code.startsWith("registry_")));
  const p1 = priceRecord();
  const p2 = priceRecord({ factId: "fact:fixture:fixture-city:price:2026q3:other", value: { metric: "nightly_price_distribution", currency: "EUR", median: 150, sampleSize: 25 } });
  const conflict = runImport([p1, p2]);
  assert.equal(conflict.registry.size(), 1);
  assert.ok(conflict.report.refused[0]!.issues.some((i) => i.detail?.includes("conflicting_values")));
});

test("S5.3-A edits in place: a record whose content differs from a previous accepted import is blocked", () => {
  const first = runImport([ruleRecord()]).report;
  const previousHashes = Object.fromEntries(first.accepted.map((f) => [f.factId, f.contentHash]));
  const same = runImport([ruleRecord()], [], { previousHashes });
  assert.equal(same.report.accepted.length, 1);
  const edited = ruleRecord({ confidence: { level: "moderate", rationale: "FIXTURE changed" } });
  const blocked = runImport([edited], [], { previousHashes });
  assert.equal(blocked.registry.size(), 0);
  assert.ok(codesOf(blocked.report, edited.factId as string).includes("fact_content_changed_in_place"));
});

test("S5.3-A S2 stays the judge: a record the registry refuses is reported with its codes and never stored", () => {
  const bad = guestRecord({ value: { category: "guest_expectation", statement: "FIXTURE sentence.", language: "en", basis: "editorial_observation" }, platform: "not-a-platform" });
  const { registry, report } = runImport([bad]);
  assert.equal(registry.size(), 0);
  assert.ok(report.refused[0]!.issues.some((i) => i.code.startsWith("registry_")));
  assert.equal(importFactStore({ factFiles: [], decisionLogs: [], sourceRegistryText: null, artifacts: provider, asOf: "yesterday" }).report.fileIssues[0]!.code, "as_of_invalid");
});

// --- determinism ---------------------------------------------------------------------------------------------------

test("S5.3-A determinism: file order, record order and repeated runs give byte-identical reports", () => {
  const rule = ruleRecord();
  const guest = guestRecord();
  const price = priceRecord();
  const decisions = [...chainFor(rule, [SUBMIT, VALIDATE, APPROVE()]), ...chainFor(guest, [SUBMIT])];
  const a = importFactStore({ factFiles: [factFile(rule, guest), { name: "facts/second.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [price] }) }], decisionLogs: [logOf(...decisions)], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  const b = importFactStore({ factFiles: [{ name: "facts/second.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [price] }) }, factFile(guest, rule)], decisionLogs: [logOf(...[...decisions].reverse())], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  assert.equal(stableStringify(a.report), stableStringify(b.report));
  assert.equal(a.report.registrySnapshotId, b.report.registrySnapshotId);
  assert.equal(Buffer.from(stableStringify(a.report)).equals(Buffer.from(stableStringify(importFactStore({ factFiles: [factFile(rule, guest), { name: "facts/second.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [price] }) }], decisionLogs: [logOf(...decisions)], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF }).report))), true);
  assert.notEqual(runImport([rule], [], { asOf: "2026-10-02T00:00:00Z" }).report.reportHash, runImport([rule]).report.reportHash, "the reference date is part of the report");
});

test("S5.3-A determinism: the importer reads no clock and mutates nothing it was given", () => {
  const rule = ruleRecord();
  const input: ImportInput = { factFiles: [factFile(rule)], decisionLogs: [logOf(...chainFor(rule, [SUBMIT, VALIDATE]))], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF, previousHashes: {} };
  const before = JSON.stringify(input);
  const RealDate = Date;
  const Guarded = class extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) throw new Error("clock read");
      super(...(args as [number]));
    }
    static override now(): number {
      throw new Error("clock read");
    }
  };
  (globalThis as { Date: DateConstructor }).Date = Guarded as unknown as DateConstructor;
  try {
    assert.doesNotThrow(() => importFactStore(input));
  } finally {
    (globalThis as { Date: DateConstructor }).Date = RealDate;
  }
  assert.equal(JSON.stringify(input), before);
  assert.equal(decisionIdOf(chainFor(rule, [SUBMIT])[0]!), chainFor(rule, [SUBMIT])[0]!.decisionId, "decision ids are content hashes");
});

// --- integration with S5.2 --------------------------------------------------------------------------------------------

test("S5.3-A + S5.2: an undecided fact never unlocks a page; a validated and approved one does so only experimentally", () => {
  const cities = [{ slug: CITY, country: "Fixtureland" }];
  const base = { cities, asOf: AS_OF, propertyType: null, countryIsoTable: { Fixtureland: "ZZ" } } as const;
  const guest = guestRecord();
  const draft = runImport([guest]);
  const draftEntry = classifyCoverage({ ...base, registry: draft.registry, thresholdProfile: "experimental-pipeline-validation" }).entries.find((e) => e.topic === "family-travel-guide")!;
  assert.equal(draftEntry.coverageClass, "needs_review_queue");
  assert.equal(draftEntry.publicationAuthorised, false);
  const decided = runImport([guest], chainFor(guest, [SUBMIT, { action: "validate", at: "2026-09-02T10:00:00Z", note: "FIXTURE review" }, APPROVE(["family-travel-guide", "amenities-guide"])]));
  const strict = classifyCoverage({ ...base, registry: decided.registry, thresholdProfile: "draft-provisional" });
  assert.equal(strict.entries.find((e) => e.topic === "family-travel-guide")!.coverageClass, "needs_human_decision");
  const experimental = classifyCoverage({ ...base, registry: decided.registry, thresholdProfile: "experimental-pipeline-validation" });
  const entry = experimental.entries.find((e) => e.topic === "family-travel-guide")!;
  assert.equal(entry.coverageClass, "experimental_candidate");
  assert.equal(experimental.stats.readyCount, 0);
  assert.equal(entry.indexingAuthorised, false);
});

// --- command line ---------------------------------------------------------------------------------------------------

test("S5.3-A script: reads a store offline, prints a canonical report, exits 2 on refusals, writes nothing", () => {
  const root = mkdtempSync(join(tmpdir(), "norixo-s53a-"));
  const store = join(root, "store");
  const evidence = join(root, "evidence");
  for (const sub of ["facts", "decisions"]) mkdirSync(join(store, sub), { recursive: true });
  mkdirSync(evidence);
  writeFileSync(join(evidence, ARTIFACT_SHA), ARTIFACT_BYTES);
  writeFileSync(join(store, "sources.json"), sourcesText());
  const rule = ruleRecord();
  writeFileSync(join(store, "facts", "fixture.json"), factFile(rule).text);
  writeFileSync(join(store, "decisions", "fixture.jsonl"), `${chainFor(rule, [SUBMIT, VALIDATE]).map((d) => JSON.stringify(d)).join("\n")}\n`);
  const script = new URL("./seo-v3-import-facts.ts", import.meta.url).pathname;
  const run = (args: string[]) => spawnSync("npx", ["--no-install", "tsx", script, ...args], { encoding: "utf8" });
  const first = run(["--first-import", "--allowed-actors", "role:owner", "--as-of", AS_OF, "--dir", store, "--evidence-dir", evidence]);
  const second = run(["--first-import", "--allowed-actors", "role:owner", "--as-of", AS_OF, "--dir", store, "--evidence-dir", evidence]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout, "byte-identical across runs");
  const report = JSON.parse(first.stdout) as ImportReport;
  assert.equal(report.accepted[0]!.state, "human_validated");
  assert.equal(report.decisionsCreated, 0);
  assert.equal(run(["--first-import", "--allowed-actors", "role:owner", "--as-of", AS_OF, "--dir", store]).status, 2, "without the artifacts the fact is refused");
  const lenient = JSON.parse(run(["--first-import", "--allowed-actors", "role:owner", "--as-of", AS_OF, "--dir", store, "--allow-unverified-evidence"]).stdout) as ImportReport;
  assert.ok(lenient.refused[0]!.issues.some((i) => i.code === "evidence_unverified_blocks_validation"), "unverified evidence never carries a validation");
  assert.equal(run(["--first-import", "--as-of", AS_OF, "--dir", "--evidence-dir", evidence]).status, 0, "a flag is never taken as the value of another");
  const previousFile = join(root, "previous.json");
  writeFileSync(previousFile, "{not json");
  assert.equal(run(["--as-of", AS_OF, "--dir", store, "--evidence-dir", evidence, "--previous-report", previousFile]).status, 1, "an unreadable baseline is a usage error");
  assert.equal(run(["--first-import", "--as-of", AS_OF, "--dir", join(root, "missing")]).status, 0, "a missing directory is an empty store");
  assert.equal(run(["--dir", store]).status, 1, "--as-of is required");
  writeFileSync(join(store, "facts", "bad.json"), JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [{ ...guestRecord(), validation: { status: "human_validated" } }] }));
  assert.equal(run(["--first-import", "--allowed-actors", "role:owner", "--as-of", AS_OF, "--dir", store, "--evidence-dir", evidence]).status, 2);
});

// --- review follow-ups ---------------------------------------------------------------------------------------------

test("S5.3-A fail closed: a lost or misaddressed decision line never leaves a fact approved", () => {
  const record = ruleRecord();
  const chain = chainFor(record, [SUBMIT, VALIDATE, APPROVE()]);
  const revoke = createDecision({ factId: record.factId, factContentHash: hashOf(record), action: "revoke", actor: "role:owner", at: "2026-09-10T10:00:00Z", note: "FIXTURE reason", previousDecisionId: chain[2]!.decisionId });
  const base = (extra: string) => importFactStore({ factFiles: [factFile(record)], decisionLogs: [{ name: "decisions/a.jsonl", text: `${[...chain].map((d) => JSON.stringify(d)).join("\n")}\n${extra}\n` }], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  assert.ok(codesOf(base('{"schemaVersion":"seo-v3-decision/1","decisionId":"trunc').report, record.factId).includes("decision_log_defective"), "truncated line");
  assert.ok(codesOf(base(JSON.stringify({ ...revoke, factId: ` ${record.factId}` })).report, record.factId).includes("decision_log_defective"), "misspelt fact id");
  assert.ok(codesOf(base(JSON.stringify(createDecision({ factId: "fact:fixture:other:rule:2026:v1", factContentHash: hashOf(record), action: "revoke", actor: "role:owner", at: "2026-09-10T10:00:00Z", note: "FIXTURE reason" }))).report, record.factId).includes("decision_log_defective"), "decision for an unknown fact");
  assert.equal(base(JSON.stringify(revoke)).report.accepted[0]!.state, "revoked", "the intact revocation is applied");
  const draftOnly = importFactStore({ factFiles: [factFile(record)], decisionLogs: [{ name: "decisions/a.jsonl", text: "not json\n" }], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  assert.equal(draftOnly.report.accepted.length, 1, "a fact with no decision has nothing to lose");
});

test("S5.3-A actors: an allow-list of role ids is the barrier against an invented role", () => {
  const record = ruleRecord();
  const chain = chainFor(record, [SUBMIT, VALIDATE]);
  assert.equal(runImport([record], chain, { allowedActors: ["role:owner"] }).report.refused.length, 0);
  const outsider = chainFor(record, [{ ...SUBMIT, actor: "role:pipeline" }]);
  assert.equal(runImport([record], outsider).report.refused.length, 0, "without a list only the pattern and the denylist apply");
  const blocked = runImport([record], outsider, { allowedActors: ["role:owner"] });
  assert.ok(blocked.report.decisionIssues.some((i) => i.code === "decision_actor_not_allowed"));
  assert.equal(blocked.registry.size(), 0, "a fact whose decisions are blocked is not registered");
  assert.ok(codesOf(blocked.report, record.factId).includes("decision_invalid"));
});

test("S5.3-A history: a rewritten decision chain or a deleted fact is detected against the previous report", () => {
  const record = ruleRecord();
  const chain = chainFor(record, [SUBMIT, VALIDATE, APPROVE()]);
  const first = runImport([record], chain).report;
  const previousHashes = Object.fromEntries(first.accepted.map((f) => [f.factId, f.contentHash]));
  const previousChainHeads = Object.fromEntries(first.accepted.map((f) => [f.factId, f.chainHead]));
  assert.equal(first.accepted[0]!.chainHead, chain[2]!.decisionId);
  assert.equal(first.baselineProvided, false);
  const same = runImport([record], chain, { previousHashes, previousChainHeads }).report;
  assert.equal(same.baselineProvided, true);
  assert.deepEqual(same.refused, []);
  const rewritten = chainFor(record, [SUBMIT, { ...VALIDATE, note: "FIXTURE a different review" }, APPROVE()]);
  assert.ok(codesOf(runImport([record], rewritten, { previousHashes, previousChainHeads }).report, record.factId).includes("decision_history_rewritten"));
  const deleted = runImport([], [], { previousHashes, previousChainHeads }).report;
  assert.ok(deleted.fileIssues.some((i) => i.code === "fact_missing_since_previous" && i.detail === record.factId));
});

test("S5.3-A decision dates: a decision after asOf or before the record was collected is refused", () => {
  const record = ruleRecord();
  const future = chainFor(record, [SUBMIT, { ...VALIDATE, at: "2026-11-01T00:00:00Z" }]);
  assert.ok(codesOf(runImport([record], future).report, record.factId).includes("decision_in_future"));
  const early = chainFor(record, [{ ...SUBMIT, at: "2026-08-01T00:00:00Z" }]);
  assert.ok(codesOf(runImport([record], early).report, record.factId).includes("decision_before_collection"));
});

test("S5.3-A evidence: unverified evidence may stay a draft or pending, never validated or revoked-after-validation", () => {
  const record = ruleRecord();
  const lenient = { artifacts: noArtifacts, requireArtifacts: false };
  assert.equal(runImport([record], [], lenient).report.accepted[0]!.evidence, "unverified");
  assert.equal(runImport([record], chainFor(record, [SUBMIT]), lenient).report.accepted[0]!.state, "pending_review");
  assert.ok(codesOf(runImport([record], chainFor(record, [SUBMIT, VALIDATE]), lenient).report, record.factId).includes("evidence_unverified_blocks_validation"));
});

test("S5.3-A robustness: prototype keys, null entries and malformed sources never crash or bypass a check", () => {
  const poisoned = JSON.parse(`{"schemaVersion":"${FACT_FILE_SCHEMA}","facts":[null,[],3,{"__proto__":{"validation":{"status":"human_validated"}},"factId":"fact:fixture:fixture-city:proto:2026:v1"},${JSON.stringify(ruleRecord({ source: null }))},${JSON.stringify(ruleRecord({ factId: " fact:fixture:fixture-city:rule:2026:v9" }))}]}`);
  const res = importFactStore({ factFiles: [{ name: "facts/p.json", text: JSON.stringify(poisoned) }], decisionLogs: [{ name: "decisions/p.jsonl", text: "null\n[]\n3\n\r\n" }], sourceRegistryText: sourcesText(), artifacts: provider, asOf: AS_OF });
  assert.equal(res.registry.size(), 0);
  assert.ok(res.report.refused.length >= 4);
  assert.ok(res.report.refused.some((r) => r.issues.some((i) => i.code === "source_malformed")));
  assert.ok(res.report.refused.some((r) => r.issues.some((i) => i.code === "fact_id_missing")));
  const registry = parseSourceRegistry(JSON.stringify({ schemaVersion: SOURCE_REGISTRY_SCHEMA, sources: [null, [], { sourceId: "__proto__" }, sourceEntry()] }));
  assert.equal(registry.entries.size, 1);
});

test("S5.3-A evidence: a non-text artifact is reported as such, and the quote length is measured after NFC", () => {
  const binary = new Uint8Array([0xff, 0xfe, 0x00, 0xc3, 0x28]);
  const sha = sha256OfBytes(binary);
  assert.equal(checkCitation({ ...CITATION, artifactSha256: sha }, (s) => (s === sha ? binary : null)).status, "artifact_not_text");
  const decomposed = "e\u0301".repeat(7);
  assert.equal(checkCitation({ ...CITATION, quote: decomposed }, provider).status, "quote_length_invalid", "7 composed characters are below the minimum");
});
