import assert from "node:assert/strict";
import test from "node:test";

import { APPROVED_EDITORIAL_CATALOG, createEditorialCatalog, sha256Hex, stableStringify, type EditorialCatalog } from "../lib/seo/v3/editorialCatalog";
import {
  applyRepetitionPolicy, approvalLevelOf, assembleEditorialPage, compareEditorialPages, DRAFT_BLUEPRINTS, measureRepetition, planHashOf,
  PROVISIONAL_REPETITION_THRESHOLDS, type ApprovalConfig, type Blueprints, type EditorialPage, type PageBlueprint,
} from "../lib/seo/v3/editorialPage";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import { IMPORT_REPORT_SCHEMA, IMPORTER_VERSION, registrySnapshotIdOf } from "../lib/seo/v3/factStore";
import type { LocalFact } from "../lib/seo/v3/localFact";
import { TOPIC_REQUIREMENTS } from "../lib/seo/v3/topicRequirements";
import { withLongStayRuleRequired } from "./seo-v3-longstay-required";
import { withSimulatedThresholdDecision } from "./seo-v3-demo-thresholds";

/**
 * S5.4-D tests: hardening of the editorial layer. FICTIONAL data only (fixture-a/b, ZZ). Nothing here is an approval by a
 * person: "approvers", verifiers and import reports are synthetic and prove GATE LOGIC only. The synthetic import reports
 * are hand-built with a consistent hash; the editorial layer cannot tell them from a real one (no authentication), which
 * is stated in the report and not hidden by these tests.
 *
 *   npx tsx scripts/seo-v3-editorial-hardening.test.ts
 */

const ASOF = "2026-10-01T00:00:00Z";
const MEASURED = ["show_sample_size", "show_observation_period", "show_confidence"];
const scopeOf = (slug: string) => ({ level: "city", countryCode: "ZZ", citySlug: slug }) as const;

const licensed = (publisher: string) => ({
  sourceId: "fixture-licensed", sourceType: "licensed_dataset", publisher, title: null, locator: { kind: "document_citation", citation: "FIXTURE" },
  publishedAt: "2026-08-15", consultedAt: "2026-09-01T09:00:00Z", collectionMethod: { kind: "dataset_download", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: [], evidence: [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }],
});
const editorialSource = (publisher: string) => ({
  ...licensed(publisher), sourceId: "fixture-editorial", sourceType: "editorial_note", locator: { kind: "internal_reference", reference: "fixture-editorial-note" },
  collectionMethod: { kind: "editorial_judgement", description: "fixture" }, evidence: [{ kind: "internal_record", reference: "fixture-record" }],
});
const approved = (topics: string[]) => ({ use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-03T10:00:00Z", scope: topics } } });
const common = (slug: string, id: string) => ({
  factId: `fact:fixture:${slug}:${id}:2026q3:v1`, scope: scopeOf(slug), platform: "airbnb", propertyType: null, unit: null, collectedAt: "2026-09-01T10:00:00Z", validUntil: "2026-12-01T00:00:00Z",
  confidence: { level: "high", rationale: "FIXTURE" }, validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-02T10:00:00Z", note: null }, version: 1, supersedes: null,
});
const price = (slug: string, median: number, publisher: string): LocalFact =>
  ({ ...common(slug, "price"), kind: "quantitative", source: licensed(publisher), observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, usage: { ...approved(["pricing-guide"]), displayConstraints: MEASURED }, relevantTopics: ["pricing-guide"],
    value: { metric: "nightly_price_distribution", currency: "EUR", median, p25: Math.round(median * 0.8), p75: Math.round(median * 1.2), sampleSize: 25 } }) as unknown as LocalFact;
const demand = (slug: string, statement: string, publisher: string): LocalFact =>
  ({ ...common(slug, "demand"), kind: "qualitative", source: editorialSource(publisher), observedPeriod: null, usage: { ...approved(["pricing-guide"]), displayConstraints: ["label_as_editorial_note"] }, relevantTopics: ["pricing-guide"],
    value: { category: "demand_driver", statement, language: "en", basis: "editorial_observation" } }) as unknown as LocalFact;
const registryOf = (...facts: LocalFact[]): FactRegistry => {
  const registry = createFactRegistry();
  for (const fact of facts) assert.equal(registry.register(fact).ok, true);
  return registry;
};

type BlockSpec = { blockId: string; kind: "editorial_non_factual" | "methodological_advice" | "explicit_hypothesis"; text: string; marker?: string };
const BLOCKS: readonly BlockSpec[] = [
  { blockId: "block:pricing-guide:introduction:1", kind: "editorial_non_factual", text: "This guide looks at how local price evidence can inform a nightly rate decision." },
  { blockId: "block:pricing-guide:method:1", kind: "methodological_advice", text: "Compare the figures on this page with the features of your own listing before you change anything." },
  { blockId: "block:pricing-guide:recommend:1", kind: "methodological_advice", text: "When a local demand note applies, check whether your listing speaks to that audience." },
  { blockId: "block:pricing-guide:hypothesis:1", kind: "explicit_hypothesis", text: "The local demand note may help guests to understand the area.", marker: "may" },
  { blockId: "block:pricing-guide:conclusion:1", kind: "editorial_non_factual", text: "These points are a starting checklist for your own listing." },
];
const catalogOf = (blocks: readonly BlockSpec[] = BLOCKS, approvedBy = "fixture-reviewer (test only)"): EditorialCatalog =>
  createEditorialCatalog(blocks.map((b) => ({
    blockId: b.blockId, language: "en", kind: b.kind, text: b.text, topics: ["pricing-guide"], hypothesisMarker: b.marker ?? null,
    approval: { status: "approved", approvedBy, approvedAt: "2026-09-10T00:00:00Z", textHash: sha256Hex(b.text) },
  })));

const A = "FIXTURE note for the first fictional city: mostly weekend visitors from nearby towns, written for tests only.";
const B = "FIXTURE note for the second fictional city: a yearly trade fair draws professionals, written for tests only.";
const fixtureRegistry = (publisher = "Fixture Publisher (test only)") =>
  registryOf(price("fixture-a", 111.11, publisher), demand("fixture-a", A, publisher), price("fixture-b", 142.5, publisher), demand("fixture-b", B, publisher));

type Extra = { catalog?: EditorialCatalog; blueprints?: Blueprints; provenance?: { importReport: unknown }; approvals?: ApprovalConfig };
const build = (registry: FactRegistry, slug: string, extra: Extra = {}): EditorialPage =>
  assembleEditorialPage({ registry, catalog: extra.catalog ?? catalogOf(), target: scopeOf(slug), platform: "airbnb", propertyType: null, topic: "pricing-guide", asOf: ASOF, language: "en",
    ...(extra.blueprints === undefined ? {} : { blueprints: extra.blueprints }), ...(extra.provenance === undefined ? {} : { provenance: extra.provenance }), ...(extra.approvals === undefined ? {} : { approvals: extra.approvals }) });

const withPlan = (patch: Partial<PageBlueprint>): Blueprints => ({ "pricing-guide": { ...DRAFT_BLUEPRINTS["pricing-guide"]!, ...patch } });
const PENDING: Blueprints = withPlan({ reviewStatus: "pending_human_approval" });

/** A consistent import report for a registry: SYNTHETIC. It proves the gate's logic, not that a real import happened. */
function reportFor(registry: FactRegistry, overrides: Record<string, unknown> = {}, accepted?: Record<string, unknown>[]): unknown {
  const body = {
    schemaVersion: IMPORT_REPORT_SCHEMA, importerVersion: IMPORTER_VERSION, asOf: ASOF, sourceRegistryHash: "0".repeat(64), strict: true, baselineStatus: "provided", decisions: [], decisionLogHash: "0".repeat(64),
    baselineProvided: true, storeHash: "0".repeat(64), registrySnapshotId: registrySnapshotIdOf(registry),
    accepted: accepted ?? registry.list().map((fact) => ({ factId: fact.factId, version: fact.version, contentHash: "1".repeat(64), chainHead: null, state: "human_validated", publicUse: "approved", evidence: "verified" })),
    refused: [], fileIssues: [], decisionIssues: [], counts: { accepted: registry.list().length, refused: 0, decisions: 0 }, decisionsCreated: 0, publicationAuthorised: false, indexingAuthorised: false, ...overrides,
  };
  return { ...body, reportHash: sha256Hex(stableStringify(body)) };
}
const OWNER: ApprovalConfig = { allowedActors: ["role:owner"] };
const VERIFIED: ApprovalConfig = { allowedActors: ["role:owner"], verifier: () => true };

// --- A. fixtures cannot become production --------------------------------------------------------------------------

test("S5.4-D A: renaming the publisher and the approver never leaves fixture mode", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry("Acme Data");
    const page = build(registry, "fixture-a", { catalog: catalogOf(BLOCKS, "alice") });
    assert.equal(page.status, "fixture_demo_only");
    assert.equal(page.mode, "fixture");
    assert.equal(page.fixtureOnly, true);
    assert.deepEqual(page.reasons, ["fixture_mode"]);
    // even with an allow-list that names the approver and a verifier that says yes
    const listed = build(registry, "fixture-a", { catalog: catalogOf(BLOCKS, "role:owner"), approvals: VERIFIED });
    assert.equal(listed.status, "fixture_demo_only", "approvals alone do not make production data");
    assert.equal(listed.fixtureOnly, true);
  });
});

test("S5.4-D A: a production claim must be backed by an intact strict import report of exactly this registry", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry("Plain Publisher");
    const ok = reportFor(registry);
    const cat = catalogOf(BLOCKS, "role:owner");
    const run = (report: unknown) => build(registry, "fixture-a", { catalog: cat, blueprints: PENDING, provenance: { importReport: report }, approvals: OWNER });
    const reasonsOf = (report: unknown) => run(report).reasons;
    assert.equal(run(ok).status, "pending_human_approval", "a consistent report passes the provenance gate (no authentication: see the report)");
    assert.ok(reasonsOf({ ...(ok as object), counts: { accepted: 99, refused: 0, decisions: 0 } }).includes("provenance:report_not_intact"), "an edited report");
    assert.ok(reasonsOf(reportFor(registry, { strict: false })).includes("provenance:import_not_strict"));
    assert.ok(reasonsOf(reportFor(registry, { baselineStatus: "absent_refused" })).includes("provenance:baseline_not_acceptable"));
    assert.ok(reasonsOf(reportFor(registry, { fileIssues: [{ code: "x", file: "f", line: null, detail: null }] })).includes("provenance:import_has_issues"));
    assert.ok(reasonsOf(reportFor(registry, { registrySnapshotId: "2".repeat(64) })).includes("provenance:registry_snapshot_mismatch"));
    assert.ok(reasonsOf(reportFor(fixtureRegistry("Other Publisher"))).includes("provenance:registry_snapshot_mismatch"), "a report of another registry");
    const missing = reportFor(registry, {}, registry.list().slice(1).map((f) => ({ factId: f.factId, version: 1, contentHash: "1".repeat(64), chainHead: null, state: "human_validated", publicUse: "approved", evidence: "verified" })));
    assert.ok(run(missing).reasons.some((r) => r.startsWith("provenance:fact_not_in_report:")));
    const unverified = reportFor(registry, {}, registry.list().map((f) => ({ factId: f.factId, version: 1, contentHash: "1".repeat(64), chainHead: null, state: "human_validated", publicUse: "approved", evidence: "unverified" })));
    assert.ok(run(unverified).reasons.some((r) => r.startsWith("provenance:fact_evidence_unverified:")));
    assert.equal(run("not a report").status, "refused");
    assert.equal(run(null).status, "refused");
  });
});

test("S5.4-D A: a 'test only' label inside a production-claimed page is refused (tripwire, never a grant)", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry();
    const page = build(registry, "fixture-a", { provenance: { importReport: reportFor(registry) }, approvals: OWNER });
    assert.equal(page.status, "refused");
    assert.ok(page.reasons.includes("fixture_marker_in_production"));
    assert.equal(page.mode, "fixture");
  });
});

// --- B. approvals --------------------------------------------------------------------------------------------------

test("S5.4-D B: an approval is declared, then identity-listed, then proven; approvedBy alone proves nothing", () => {
  const subject = (approvedBy: string) => ({ kind: "block" as const, id: "block:pricing-guide:introduction:1", subjectHash: "3".repeat(64), approvedBy, approvedAt: "2026-09-10T00:00:00Z" });
  assert.equal(approvalLevelOf(null, OWNER), "none");
  assert.equal(approvalLevelOf(subject(""), OWNER), "none");
  assert.equal(approvalLevelOf(subject("alice"), OWNER), "declared");
  assert.equal(approvalLevelOf(subject("role:owner"), undefined), "declared", "no allow-list");
  assert.equal(approvalLevelOf(subject("role:reviewer"), OWNER), "declared", "a human role that is not listed");
  assert.equal(approvalLevelOf(subject("role:owner"), OWNER), "identity_listed", "listed, but nothing proves it was really them");
  assert.equal(approvalLevelOf(subject("role:bot"), { allowedActors: ["role:bot"] }), "declared", "an automated actor is never a person");
  assert.equal(approvalLevelOf(subject("role:owner"), { ...OWNER, verifier: () => false }), "identity_listed");
  assert.equal(approvalLevelOf(subject("role:owner"), { ...OWNER, verifier: () => "yes" as never }), "identity_listed", "only exactly true counts");
  assert.equal(approvalLevelOf(subject("role:owner"), { ...OWNER, verifier: () => { throw new Error("boom"); } }), "identity_listed");
  assert.equal(approvalLevelOf(subject("alice"), { allowedActors: ["alice"], verifier: () => true }), "declared", "a name is not a role");
  assert.equal(approvalLevelOf(subject("role:owner"), VERIFIED), "proof_verified");
});

test("S5.4-D B: without a verifier no block, plan or page ever reaches proof_verified", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry("Plain Publisher");
    const page = build(registry, "fixture-a", { catalog: catalogOf(BLOCKS, "role:owner"), blueprints: PENDING, provenance: { importReport: reportFor(registry) }, approvals: OWNER });
    assert.equal(page.status, "pending_human_approval");
    assert.ok(Object.values(page.approvals.blocks).every((level) => level === "identity_listed"));
    assert.ok(page.reasons.includes("plan_approval_not_verified"));
    assert.ok(page.reasons.some((r) => r.startsWith("block_approval_not_verified:block:pricing-guide:")));
    assert.equal(page.publishable, false);
  });
});

test("S5.4-D B: the unapproved catalogue yields no page: blocks without a valid approval record are excluded", () => {
  withSimulatedThresholdDecision(() => {
    const unapproved = createEditorialCatalog(BLOCKS.map((b) => ({ blockId: b.blockId, language: "en", kind: b.kind, text: b.text, topics: ["pricing-guide"], hypothesisMarker: b.marker ?? null })));
    assert.equal(unapproved.blocks.length, 0);
    assert.equal(build(fixtureRegistry(), "fixture-a", { catalog: unapproved }).status, "refused");
    assert.equal(build(fixtureRegistry(), "fixture-a", { catalog: APPROVED_EDITORIAL_CATALOG }).status, "refused");
    const pending = createEditorialCatalog(BLOCKS.map((b) => ({ blockId: b.blockId, language: "en", kind: b.kind, text: b.text, topics: ["pricing-guide"], hypothesisMarker: b.marker ?? null,
      approval: { status: "pending", approvedBy: "role:owner", approvedAt: "2026-09-10T00:00:00Z", textHash: sha256Hex(b.text) } })));
    assert.equal(pending.blocks.length, 0);
  });
});

// --- C. plan status ------------------------------------------------------------------------------------------------


test("S5.4-D C: draft, pending and approved plans: only a verified approval of the exact plan counts", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry("Plain Publisher");
    const cat = catalogOf(BLOCKS, "role:owner");
    const prod = (blueprints: Blueprints, approvals: ApprovalConfig = VERIFIED) => build(registry, "fixture-a", { catalog: cat, blueprints, provenance: { importReport: reportFor(registry) }, approvals });
    const draft = prod(withPlan({ reviewStatus: "draft" }));
    assert.equal(draft.status, "refused");
    assert.ok(draft.reasons.includes("blueprint_draft"));
    assert.equal(draft.blueprintStatus, "draft");
    const pendingPlan = prod(withPlan({ reviewStatus: "pending_human_approval" }));
    assert.equal(pendingPlan.status, "pending_human_approval");
    assert.ok(pendingPlan.reasons.includes("plan_approval_not_verified"));
    const base = DRAFT_BLUEPRINTS["pricing-guide"]!;
    const claim = { approvedBy: "role:owner", approvedAt: "2026-09-11T00:00:00Z", planHash: planHashOf(base) };
    const unsigned = prod(withPlan({ reviewStatus: "approved", approval: null }));
    assert.ok(unsigned.reasons.includes("plan_approval_missing") && unsigned.status === "refused");
    const edited = prod(withPlan({ reviewStatus: "approved", approval: { ...claim, planHash: "4".repeat(64) } }));
    assert.ok(edited.reasons.includes("plan_hash_mismatch") && edited.status === "refused");
    const notVerified = prod(withPlan({ reviewStatus: "approved", approval: claim }), OWNER);
    assert.equal(notVerified.status, "pending_human_approval");
    assert.equal(notVerified.approvals.plan, "identity_listed");
    const proven = prod(withPlan({ reviewStatus: "approved", approval: claim }));
    assert.equal(proven.approvals.plan, "proof_verified");
    assert.equal(proven.status, "ready_for_human_editorial_review", "synthetic proof: gate logic only");
    assert.equal(proven.mode, "production");
    assert.equal(proven.publishable, false);
    assert.equal(proven.publicationAuthorised, false);
    assert.equal(proven.indexingAuthorised, false);
    // a draft plan is accepted only as a demonstration
    assert.equal(build(fixtureRegistry(), "fixture-a", { blueprints: withPlan({ reviewStatus: "draft" }) }).status, "fixture_demo_only");
  });
});

// --- D. variants -------------------------------------------------------------------------------------------------

test("S5.4-D D: two blocks for one slot are refused, none is chosen", () => {
  withSimulatedThresholdDecision(() => {
    const twin: BlockSpec = { blockId: "block:pricing-guide:introduction:2", kind: "editorial_non_factual", text: "This page explains what a local nightly price figure shows and what it leaves out, so that it can be read with care." };
    const page = build(fixtureRegistry(), "fixture-a", { catalog: catalogOf([...BLOCKS, twin]) });
    assert.equal(page.status, "refused");
    assert.ok(page.reasons.includes("ambiguous_slot_variants"));
    assert.deepEqual(page.metrics!.ambiguousSlots, ["introduction"]);
    const texts = page.sections.flatMap((s) => s.claims.map((c) => c.text));
    assert.ok(!texts.includes(BLOCKS[0]!.text) && !texts.includes(twin.text), "neither variant reaches the page");
    assert.ok(page.metrics!.unplacedClaimIds.includes("claim:blk:pricing-guide:introduction:1"));
    // one block per slot: fine
    assert.equal(build(fixtureRegistry(), "fixture-a").status, "fixture_demo_only");
  });
});

// --- E. repetition -----------------------------------------------------------------------------------------------

test("S5.4-D E: repetition is measured on placed claims only, with facts-based differences", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry();
    const a = build(registry, "fixture-a");
    const b = build(registry, "fixture-b");
    const report = measureRepetition([{ key: "b", page: b }, { key: "a", page: a }]);
    assert.deepEqual(report.pages.map((p) => p.key), ["a", "b"]);
    const pair = report.pairs[0]!;
    assert.equal(pair.identicalSentences, 5, "the five approved sentences are the same on both pages");
    assert.equal(pair.commonClaimIds, 9, "claim ids follow the slots: the price claims and the note share their ids although their texts differ");
    assert.equal(pair.identicalTemplateClaims, 5 + 3, "the median and quartile sentences are identical once city and amounts are masked");
    assert.equal(pair.factDifferences, 4, "no fact is shared: two per page");
    const pageA = report.pages[0]!;
    assert.equal(pageA.placedClaims, 9, "five blocks, median, two quartiles and the demand note");
    assert.equal(pageA.family, "data_dependent");
    assert.ok(pageA.sharedTemplateShare! > 0 && pageA.sharedTemplateShare! < 1);
    assert.equal(round(pageA.sharedTemplateShare! + pageA.specificShare!), 1);
    assert.equal(pageA.specificClaimIds.length, 1, "only the local demand note is specific");
    assert.deepEqual(pageA.factIdsOnlyHere, a.placedFactIds, "every placed fact is specific to the city");
    assert.equal(report.thresholdsApplied, false);
    assert.equal(PROVISIONAL_REPETITION_THRESHOLDS.basis, "provisional_pending_human_decision");
    assert.deepEqual(report.aboveProvisional.map((x) => x.key), ["a", "b"], "above the provisional 0.6, as a description");
    assert.deepEqual(JSON.parse(JSON.stringify(measureRepetition([{ key: "a", page: a }, { key: "b", page: b }]))), JSON.parse(JSON.stringify(report)), "order-independent");
  });
});

const round = (n: number) => Math.round(n * 10000) / 10000;

test("S5.4-D E: unplaced claims and facts are not measured and not compared", () => {
  withSimulatedThresholdDecision(() => {
    const full = DRAFT_BLUEPRINTS["pricing-guide"]!;
    // a plan without the demand slot: the demand fact is on the S4 page but not on the editorial page
    const slim: Blueprints = withPlan({ slots: full.slots.filter((s) => s.slotId !== "demand" && s.slotId !== "recommend" && s.slotId !== "hypothesis"), depth: { ...full.depth, minDistinctFacts: 1, minDistinctFactCategories: 1, requiresContextFact: false, distinctiveSlotIds: [] } });
    const registry = fixtureRegistry();
    const page = build(registry, "fixture-a", { blueprints: slim });
    assert.equal(page.status, "fixture_demo_only", JSON.stringify(page.reasons));
    assert.ok(page.base!.usedFactIds.length === 2, "the S4 page holds both facts");
    assert.equal(page.placedFactIds.length, 1, "only the price is placed");
    assert.ok(page.metrics!.unplacedClaimIds.some((id) => id.includes("fact") || !id.startsWith("claim:blk:")), "the demand claim is reported as unplaced");
    const other = build(registry, "fixture-b", { blueprints: slim });
    const report = measureRepetition([{ key: "a", page }, { key: "b", page: other }]);
    assert.equal(report.pages[0]!.placedClaims, 6, "introduction, the three price claims, method and conclusion only");
    assert.equal(report.pairs[0]!.factDifferences, 2, "only placed facts count: one per page");
    const cmp = compareEditorialPages([{ key: "a", page }, { key: "b", page: other }]);
    assert.deepEqual(cmp.pairs[0]!.sharedFactIds, []);
  });
});

test("S5.4-D E: the repetition policy is report-only unless an explicitly approved policy is proven", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry();
    const report = measureRepetition([{ key: "a", page: build(registry, "fixture-a") }, { key: "b", page: build(registry, "fixture-b") }]);
    const enforce = { mode: "enforce" as const, maxSharedTemplateShare: { data_dependent: 0.5 }, approvedBy: "role:owner", approvedAt: "2026-09-12T00:00:00Z" };
    const none = applyRepetitionPolicy(report, { mode: "report_only" });
    assert.deepEqual([none.effectiveMode, none.refused, none.flagged], ["report_only", [], ["a", "b"]]);
    for (const config of [undefined, OWNER, { allowedActors: [] as string[], verifier: () => true }] as const) {
      const v = applyRepetitionPolicy(report, enforce, config as ApprovalConfig | undefined);
      assert.equal(v.effectiveMode, "report_only");
      assert.deepEqual(v.refused, []);
      assert.ok(v.notes.includes("policy_not_approved"));
    }
    const proven = applyRepetitionPolicy(report, enforce, VERIFIED);
    assert.equal(proven.effectiveMode, "enforce");
    assert.deepEqual(proven.refused, ["a", "b"], "synthetic proof: shows only that an approved policy refuses");
    assert.deepEqual(applyRepetitionPolicy(report, { ...enforce, maxSharedTemplateShare: { local_qualitative: 0.1 } }, VERIFIED).refused, [], "no threshold for the family: nothing refused");
  });
});

test("S5.4-D E: refused pages are ignored by the measures", () => {
  withSimulatedThresholdDecision(() => {
    const registry = registryOf(price("fixture-a", 111.11, "Fixture Publisher (test only)"));
    const thin = build(registry, "fixture-a");
    assert.equal(thin.status, "refused");
    assert.deepEqual(measureRepetition([{ key: "thin", page: thin }]).pages, []);
  });
});

// --- F. test helpers -----------------------------------------------------------------------------------------------

test("S5.4-D F: the threshold simulator restores after success, after an exception and after an asynchronous attempt", async () => {
  const table = TOPIC_REQUIREMENTS as Record<string, unknown>;
  const before = { guide: table["pricing-guide"], market: table["market-analysis"] };
  const same = () => table["pricing-guide"] === before.guide && table["market-analysis"] === before.market;
  let inside = true;
  withSimulatedThresholdDecision(() => { inside = table["pricing-guide"] !== before.guide; });
  assert.equal(inside, true, "the table really is swapped inside");
  assert.equal(same(), true, "restored after success");
  assert.throws(() => withSimulatedThresholdDecision(() => { throw new Error("boom"); }), /boom/);
  assert.equal(same(), true, "restored after an exception");
  assert.throws(() => withSimulatedThresholdDecision((async () => { await Promise.resolve(); }) as never), TypeError);
  assert.equal(same(), true, "restored after an asynchronous attempt, which is refused");
  assert.throws(() => withSimulatedThresholdDecision(() => withSimulatedThresholdDecision(() => 1)), /nested use refused/);
  assert.equal(same(), true, "restored after a nested attempt");
  assert.equal(withSimulatedThresholdDecision(() => 42), 42, "usable again, and returns the callback's value");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(same(), true);
});

test("S5.4-D F: the long-stay helper has the same guarantees", () => {
  const table = TOPIC_REQUIREMENTS as Record<string, unknown>;
  const before = table["long-stay-guide"];
  withLongStayRuleRequired(() => assert.notEqual(table["long-stay-guide"], before));
  assert.equal(table["long-stay-guide"], before);
  assert.throws(() => withLongStayRuleRequired(() => { throw new Error("boom"); }), /boom/);
  assert.equal(table["long-stay-guide"], before);
  assert.throws(() => withLongStayRuleRequired((async () => undefined) as never), TypeError);
  assert.equal(table["long-stay-guide"], before);
  assert.throws(() => withLongStayRuleRequired(() => withLongStayRuleRequired(() => 1)), /nested use refused/);
  assert.equal(table["long-stay-guide"], before);
});

test("S5.4-D F: outside the helpers the real engine renders no optional context: a plain page is refused", () => {
  const page = build(fixtureRegistry(), "fixture-a");
  assert.equal(page.status, "refused");
  assert.ok(page.reasons.includes("context_fact_missing"));
});

// --- G. nothing is ever authorised ---------------------------------------------------------------------------------

test("S5.4-D G: whatever the status, nothing is publishable, publishing or indexable", () => {
  withSimulatedThresholdDecision(() => {
    const registry = fixtureRegistry("Plain Publisher");
    const cat = catalogOf(BLOCKS, "role:owner");
    const claim = { approvedBy: "role:owner", approvedAt: "2026-09-11T00:00:00Z", planHash: planHashOf(DRAFT_BLUEPRINTS["pricing-guide"]!) };
    const pages = [
      build(registry, "fixture-a"),
      build(registry, "fixture-a", { catalog: cat, blueprints: PENDING, provenance: { importReport: reportFor(registry) }, approvals: OWNER }),
      build(registry, "fixture-a", { catalog: cat, blueprints: withPlan({ reviewStatus: "approved", approval: claim }), provenance: { importReport: reportFor(registry) }, approvals: VERIFIED }),
      build(registry, "fixture-a", { catalog: APPROVED_EDITORIAL_CATALOG }),
    ];
    assert.deepEqual(pages.map((p) => p.status), ["fixture_demo_only", "pending_human_approval", "ready_for_human_editorial_review", "refused"]);
    for (const page of pages) {
      assert.equal(page.publishable, false);
      assert.equal(page.publicationAuthorised, false);
      assert.equal(page.indexingAuthorised, false);
    }
  });
});
