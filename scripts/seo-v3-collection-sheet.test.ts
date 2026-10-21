import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { withLongStayRuleRequired } from "./seo-v3-longstay-required";

import { cities } from "../data/cities";
import { buildCollectionPlan, serializeCollectionPlan, type CollectionPlanInput, type SourceCoverageClaim } from "../lib/seo/v3/collectionSheet";
import { classifyCoverage, type WorkOrder } from "../lib/seo/v3/coverageClassifier";
import { stableStringify } from "../lib/seo/v3/editorialCatalog";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import { FACT_FILE_SCHEMA, importFactStore } from "../lib/seo/v3/factStore";
import type { GeographicScope, LocalFact } from "../lib/seo/v3/localFact";
import { SOURCE_REGISTRY_SCHEMA, parseSourceRegistry } from "../lib/seo/v3/sourceRegistry";
import { TOPIC_REQUIREMENTS } from "../lib/seo/v3/topicRequirements";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "../lib/seo/v3/topics";

/**
 * S5.3-B tests: collection sheets built from S5.2 work orders.
 *
 * Every value is a FIXTURE: "fixture-city" and "fixture-two" do not exist, "Fixtureland" is not a country, ZZ is
 * reserved, every source below is made up for these tests and exists nowhere else.
 *
 *   npx tsx scripts/seo-v3-collection-sheet.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const CITY = "fixture-city";
const SCOPE: GeographicScope = { level: "city", countryCode: "ZZ", citySlug: CITY };
const FIXTURE_ISO = { Fixtureland: "ZZ" };

function ordersFor(registry: FactRegistry, citySlugs: string[] = [CITY], extra: Record<string, unknown> = {}): readonly WorkOrder[] {
  return classifyCoverage({
    cities: citySlugs.map((slug) => ({ slug, country: "Fixtureland" })), registry, asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null,
    countryIsoTable: FIXTURE_ISO, ...extra,
  }).workOrders;
}
const emptyOrders = () => ordersFor(createFactRegistry());
const orderOf = (orders: readonly WorkOrder[], requirementId: string, slug = CITY) =>
  orders.find((o) => o.requirementId === requirementId && o.scope.level === "city" && o.scope.citySlug === slug)!;

const sourceEntry = (overrides: Record<string, unknown> = {}) => ({
  sourceId: "fixture-source-a", publisher: "Fixture Publisher (test only)", sourceType: "licensed_dataset", status: "approved",
  terms: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, rights: { publicTextUse: "permitted", derivativeFigures: "permitted" },
  requiredRestrictions: [], allowedHosts: [], reviewedBy: "role:owner", reviewedAt: "2026-08-01T00:00:00Z", reviewValidUntil: "2027-08-01T00:00:00Z", note: null, ...overrides,
});
const registryOf = (...entries: unknown[]) => parseSourceRegistry(JSON.stringify({ schemaVersion: SOURCE_REGISTRY_SCHEMA, sources: entries }));
const claim = (overrides: Partial<SourceCoverageClaim> = {}): SourceCoverageClaim => ({
  sourceId: "fixture-source-a", scopes: [SCOPE], requirementIds: null, declaredBy: "role:owner", declaredAt: "2026-09-01T00:00:00Z", basis: "FIXTURE: declared by a test", ...overrides,
});
const plan = (overrides: Partial<CollectionPlanInput> & { orders: readonly WorkOrder[] }) => buildCollectionPlan({ asOf: AS_OF, ...overrides });
const PRICE = "nightly_price_distribution";

// --- empty and valid ----------------------------------------------------------------------------------------------

test("S5.3-B empty: no orders give an empty plan that says what is missing and what it does not guarantee", () => {
  const empty = plan({ orders: [] });
  assert.equal(empty.sheets.length, 0);
  assert.deepEqual(empty.batches, []);
  assert.deepEqual(empty.meta.importBaseline, { status: "absent" });
  assert.deepEqual(empty.meta.warnings, ["import_baseline_absent", "source_registry_absent"]);
  assert.deepEqual(empty.meta.governance, { actorsAuthenticated: false, decisionLogTamperProof: false, sourceCoverageVerified: false });
  assert.equal(empty.createsFacts, false);
  assert.equal(empty.createsDecisions, false);
  assert.equal(empty.publicationAuthorised, false);
  const provided = plan({ orders: [], importBaseline: { reportHash: "a".repeat(64) }, sourceRegistry: registryOf() });
  assert.deepEqual(provided.meta.importBaseline, { status: "provided", reportHash: "a".repeat(64) });
  assert.deepEqual(provided.meta.warnings, []);
  assert.equal(plan({ orders: [], asOf: "yesterday" }).meta.warnings.includes("as_of_invalid"), true);
});

test("S5.3-B valid order: the sheet states scope, platform, requirement, sources, validity, pages and human steps", () => {
  withLongStayRuleRequired(() => {
  const orders = emptyOrders();
  assert.equal(orders.length, 8, "one order per requirement for the fixture city (the long-stay rule made required for this rehearsal)");
  const result = plan({ orders });
  assert.equal(result.sheets.length, 8);
  const sheet = result.sheets.find((s) => s.requirementId === PRICE)!;
  assert.deepEqual(sheet.scope, SCOPE);
  assert.equal(sheet.platform, "airbnb");
  assert.equal(sheet.propertyType, null);
  assert.equal(sheet.kind, "fact");
  assert.equal(sheet.mode, "new");
  assert.equal(sheet.status, "ready_to_collect");
  assert.deepEqual(sheet.acceptedSourceTypes, ["licensed_dataset"]);
  assert.equal(sheet.pages.length, 5);
  assert.deepEqual(sheet.approvalTopics, ["competitor-analysis", "market-analysis", "pricing-guide", "pricing-positioning", "revenue-optimization"]);
  assert.equal(sheet.validity.maxAgeDays, 90);
  assert.equal(sheet.validity.minimumSampleSize, 20);
  assert.equal(sheet.validity.observationMustEndAfter, "2026-07-03T00:00:00.000Z");
  assert.equal(sheet.validity.validUntilMustExceed, AS_OF);
  for (const step of ["human_validation", "public_use_approval", "audit_public_use_governance", "select_and_register_source"] as const) assert.ok(sheet.humanSteps.includes(step), step);
  assert.ok(sheet.proofFields.licensed_dataset!.some((f) => f.field === "source.sourceId"));
  const rule = result.sheets.find((s) => s.requirementId !== PRICE && s.proofFields.official_authority !== undefined)!;
  assert.ok(rule.proofFields.official_authority!.some((f) => f.field === "citations[].quote" && f.rule.includes("verbatim")));
  assert.ok(rule.proofFields.official_authority!.some((f) => f.field === "citations[].applicability.geographic"));
  const provisional = result.sheets.filter((s) => s.validity.thresholdBasis === "provisional_pending_human_decision");
  assert.ok(provisional.length > 0 && provisional.every((s) => s.humanSteps.includes("confirm_provisional_thresholds")));
  });
});

test("S5.3-B template: a sheet's record template is not importable and carries no validation or approval", () => {
  const sheet = plan({ orders: emptyOrders() }).sheets[0]!;
  assert.equal(sheet.recordTemplate.factId, null);
  assert.ok(!("validation" in sheet.recordTemplate) && !("usage" in sheet.recordTemplate));
  assert.equal(sheet.recordTemplate.workOrderId, sheet.workOrderId);
  assert.match(sheet.suggestedFactId, /^fact:[A-Za-z0-9][A-Za-z0-9:_.-]{7,199}$/);
  const imported = importFactStore({
    factFiles: [{ name: "facts/t.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [sheet.recordTemplate] }) }],
    decisionLogs: [], sourceRegistryText: null, artifacts: () => null, asOf: AS_OF,
  });
  assert.equal(imported.registry.size(), 0);
  assert.equal(imported.report.accepted.length, 0);
  assert.equal(imported.report.refused.length, 1);
});

// --- incomplete orders -----------------------------------------------------------------------------------------------

test("S5.3-B incomplete orders: invalid scope, kind, reason or no pages are rejected; platform and page conflicts are flagged", () => {
  const good = orderOf(emptyOrders(), PRICE);
  const rejected = (order: unknown) => plan({ orders: [order as WorkOrder] }).rejectedOrders[0]!.issues;
  assert.ok(rejected({ ...good, scope: { level: "city", countryCode: "zz", citySlug: CITY } }).includes("order_scope_invalid"));
  assert.ok(rejected({ ...good, scope: { level: "city", countryCode: "ZZ", citySlug: "Bad Slug" } }).includes("order_scope_invalid"));
  assert.ok(rejected({ ...good, kind: "other" }).includes("order_kind_invalid"));
  assert.ok(rejected({ ...good, reason: "whenever" }).includes("order_reason_invalid"));
  assert.ok(rejected({ ...good, coversPages: [] }).includes("order_has_no_pages"));
  assert.ok(rejected({ ...good, requirementId: "no_such_requirement" }).includes("requirement_unknown"));
  assert.deepEqual(plan({ orders: [null, 3, { id: "" }] as never }).rejectedOrders.map((r) => r.issues), [["order_malformed"], ["order_malformed"], ["order_malformed"]]);
  const wrongPlatform = plan({ orders: [{ ...good, platform: null }] });
  assert.equal(wrongPlatform.sheets[0]!.status, "incomplete");
  assert.ok(wrongPlatform.sheets[0]!.issues.includes("order_platform_invalid"));
  const outside = plan({ orders: [{ ...good, coversPages: [{ citySlug: "fixture-two", topic: "pricing-guide" as LocalSeoTopicSlug }] }] });
  assert.ok(outside.sheets[0]!.issues.includes("page_outside_scope"));
  assert.equal(outside.sheets[0]!.status, "incomplete");
  const wrongTopic = plan({ orders: [{ ...good, requirementId: "visual_character", coversPages: [{ citySlug: CITY, topic: "pricing-guide" as LocalSeoTopicSlug }] }] });
  assert.ok(wrongTopic.rejectedOrders[0]!.issues.includes("topic_without_requirement") || wrongTopic.rejectedOrders[0]!.issues.includes("requirement_unknown"));
  const timezone = plan({ orders: [{ ...good, kind: "timezone", requirementId: "timezone", platform: "airbnb" }] });
  assert.ok(timezone.sheets[0]!.issues.includes("order_platform_invalid"));
});

test("S5.3-B governance: an order with no collectible source type is blocked, not silently completed", () => {
  const good = orderOf(emptyOrders(), PRICE);
  const blocked = plan({ orders: [{ ...good, acceptedSourceTypes: [] }] });
  assert.equal(blocked.sheets[0]!.status, "blocked_by_governance");
  assert.ok(blocked.sheets[0]!.issues.includes("accepted_source_types_empty"));
  assert.equal(blocked.summary.byStatus.blocked_by_governance, 1);
});

// --- deduplication and conflicts --------------------------------------------------------------------------------------

test("S5.3-B deduplication: an order given twice gives one sheet; partial duplicates merge their pages", () => {
  const good = orderOf(emptyOrders(), PRICE);
  assert.equal(plan({ orders: [good, good, good] }).sheets.length, 1);
  const [a, b, ...rest] = good.coversPages;
  const merged = plan({ orders: [{ ...good, coversPages: [a!, b!] }, { ...good, coversPages: [b!, ...rest] }] });
  assert.equal(merged.sheets.length, 1);
  assert.equal(merged.sheets[0]!.pages.length, good.coversPages.length);
});

test("S5.3-B scope conflicts: the same order id with another scope, platform or source is rejected, never merged", () => {
  const good = orderOf(emptyOrders(), PRICE);
  for (const other of [{ ...good, scope: { level: "city", countryCode: "ZZ", citySlug: "fixture-two" } }, { ...good, acceptedSourceTypes: ["official_authority"] }, { ...good, closestFactId: "fact:other:other:other:1" }]) {
    const result = plan({ orders: [good, other as unknown as WorkOrder] });
    assert.equal(result.sheets.length, 0);
    assert.deepEqual(result.rejectedOrders[0]!.issues, ["duplicate_order_id_conflict"]);
  }
});

test("S5.3-B requirements: incompatible definitions are never merged into one sheet", () => {
  const byId = new Map<string, Map<string, LocalSeoTopicSlug[]>>();
  for (const topic of LOCAL_SEO_TOPIC_SLUGS) {
    for (const requirement of [...TOPIC_REQUIREMENTS[topic].required, ...TOPIC_REQUIREMENTS[topic].optional]) {
      const variants = byId.get(requirement.requirementId) ?? new Map<string, LocalSeoTopicSlug[]>();
      const key = stableStringify(requirement);
      variants.set(key, [...(variants.get(key) ?? []), topic]);
      byId.set(requirement.requirementId, variants);
    }
  }
  const base = orderOf(emptyOrders(), PRICE);
  for (const [requirementId, variants] of byId) {
    const pages = [...variants.values()].flat().map((topic) => ({ citySlug: CITY, topic }));
    const result = plan({ orders: [{ ...base, id: `id-${requirementId}`, requirementId, coversPages: pages }] });
    assert.equal(result.sheets.length, variants.size, `${requirementId}: one sheet per distinct definition`);
    assert.equal(new Set(result.sheets.map((s) => s.requirementHash)).size, variants.size);
    assert.equal(result.sheets.reduce((n, s) => n + s.pages.length, 0), pages.length);
    if (variants.size > 1) assert.ok(result.sheets.every((s) => s.issues.includes("requirement_variant_split")));
  }
  assert.ok(byId.size >= 8);
});

// --- grouping by source ---------------------------------------------------------------------------------------------------

test("S5.3-B sources: a sheet is grouped under a source only when it is approved, valid and declared to cover this exact scope", () => {
  const orders = emptyOrders();
  const sourceRegistry = registryOf(sourceEntry());
  const price = (p: CollectionPlanInput) => buildCollectionPlan(p).sheets.find((s) => s.requirementId === PRICE)!;
  const withClaim = price({ orders, asOf: AS_OF, sourceRegistry, sourceCoverage: [claim()] });
  assert.deepEqual(withClaim.candidateSources.map((c) => c.sourceId), ["fixture-source-a"]);
  assert.equal(withClaim.candidateSources[0]!.coverage, "declared_by_a_person");
  assert.ok(!withClaim.humanSteps.includes("select_and_register_source"));
  const none = (overrides: Partial<CollectionPlanInput>) => assert.deepEqual(price({ orders, asOf: AS_OF, sourceRegistry, sourceCoverage: [claim()], ...overrides }).candidateSources, [], JSON.stringify(Object.keys(overrides)));
  none({ sourceCoverage: [] });
  none({ sourceCoverage: [claim({ scopes: [{ level: "country", countryCode: "ZZ" }] })] });
  none({ sourceCoverage: [claim({ scopes: [{ level: "city", countryCode: "ZZ", citySlug: "fixture-two" }] })] });
  none({ sourceCoverage: [claim({ requirementIds: ["visual_character"] })] });
  none({ sourceCoverage: [claim({ sourceId: "fixture-unregistered" })] });
  none({ sourceRegistry: registryOf(sourceEntry({ status: "suspended" })) });
  none({ sourceRegistry: registryOf(sourceEntry({ status: "excluded" })) });
  none({ sourceRegistry: registryOf(sourceEntry({ reviewValidUntil: "2026-09-01T00:00:00Z" })) });
  none({ sourceRegistry: registryOf(sourceEntry({ sourceType: "editorial_note" })) });
  none({ sourceRegistry: undefined });
  const invalid = buildCollectionPlan({ orders, asOf: AS_OF, sourceRegistry, sourceCoverage: [claim({ declaredBy: "role:importer" }), claim({ basis: " " }), claim({ scopes: [{ level: "city", countryCode: "zz", citySlug: CITY } as never] })] });
  assert.equal(invalid.coverageIssues.length, 3);
  assert.deepEqual(invalid.sheets.find((s) => s.requirementId === PRICE)!.candidateSources, []);
});

test("S5.3-B batches: research is grouped per source and country while every sheet stays one local fact", () => {
  const two = ordersFor(createFactRegistry(), [CITY, "fixture-two"]);
  const sourceRegistry = registryOf(sourceEntry());
  const result = buildCollectionPlan({ orders: two, asOf: AS_OF, sourceRegistry, sourceCoverage: [claim({ requirementIds: [PRICE] })] });
  const named = result.batches.find((b) => b.sourceId === "fixture-source-a")!;
  assert.equal(named.units.length, 1);
  assert.equal(named.units[0]!.cityCount, 1, "the source was declared for one city only: it is never assumed to cover the other");
  const unassigned = result.batches.find((b) => b.sourceId === null)!;
  const priceUnit = unassigned.units.find((u) => u.requirementId === PRICE)!;
  assert.equal(priceUnit.cityCount, 1);
  assert.equal(result.sheets.filter((s) => s.requirementId === PRICE).length, 2);
  const noSource = buildCollectionPlan({ orders: two, asOf: AS_OF });
  assert.deepEqual(noSource.batches.map((b) => b.sourceId), [null]);
  const units = noSource.batches[0]!.units;
  assert.equal(units.length, 7, "one research unit per requirement for the single country");
  assert.ok(units.every((u) => u.cityCount === 2 && u.sheetIds.length === 2));
});

test("S5.3-B no invented source: the module contains no source, host or address, and a plan without a registry names none", () => {
  const code = readFileSync(new URL("../lib/seo/v3/collectionSheet.ts", import.meta.url), "utf8");
  assert.ok(!/https?:\/\//.test(code), "no URL in the module");
  const result = buildCollectionPlan({ orders: ordersFor(createFactRegistry(), [CITY, "fixture-two"]), asOf: AS_OF });
  assert.ok(result.sheets.every((s) => s.candidateSources.length === 0 && s.humanSteps.includes("select_and_register_source")));
  assert.ok(result.batches.every((b) => b.sourceId === null));
});

// --- renewal ---------------------------------------------------------------------------------------------------------------------

function priceFact(overrides: Record<string, unknown> = {}): LocalFact {
  return {
    factId: "fact:fixture:fixture-city:price:2026q3:v1", kind: "quantitative", scope: { ...SCOPE }, platform: "airbnb", propertyType: null, unit: null,
    source: {
      sourceId: "fixture-source-a", sourceType: "licensed_dataset", publisher: "Fixture Publisher (test only)", title: null,
      locator: { kind: "document_citation", citation: "FIXTURE" }, publishedAt: "2026-08-15", consultedAt: "2026-09-01T09:00:00Z",
      collectionMethod: { kind: "dataset_download", description: "fixture" }, termsOfUse: { status: "verified_permissive", summary: null, reference: "R" },
      publicationRestrictions: [], evidence: [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }],
    },
    collectedAt: "2026-09-01T10:00:00Z", observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, validUntil: "2026-10-15T00:00:00Z",
    confidence: { level: "high", rationale: "FIXTURE" }, validation: { status: "human_validated", validatedBy: "role:owner", validatedAt: "2026-09-02T10:00:00Z", note: null },
    usage: { use: { publicUse: "approved", approval: { approvedBy: "role:owner", approvedAt: "2026-09-03T10:00:00Z", scope: "any_topic" } }, displayConstraints: ["show_sample_size", "show_observation_period", "show_confidence"] },
    relevantTopics: ["pricing-guide", "pricing-positioning", "market-analysis", "competitor-analysis", "revenue-optimization"], version: 1, supersedes: null,
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, sampleSize: 25 }, ...overrides,
  } as LocalFact;
}

test("S5.3-B renewal: a fact near its refresh date yields a refresh sheet that names the fact to supersede", () => {
  const registry = createFactRegistry();
  assert.equal(registry.register(priceFact()).ok, true);
  const orders = ordersFor(registry);
  const renewal = orders.find((o) => o.reason === "renewal_due" && o.requirementId === PRICE)!;
  assert.ok(renewal);
  const withRegistry = plan({ orders: [renewal], registry });
  const sheet = withRegistry.sheets[0]!;
  assert.equal(sheet.mode, "refresh");
  assert.equal(sheet.existingFact?.factId, "fact:fixture:fixture-city:price:2026q3:v1");
  assert.equal(sheet.existingFact?.version, 1);
  assert.equal(sheet.recordTemplate.version, 2);
  assert.equal(sheet.recordTemplate.supersedes, "fact:fixture:fixture-city:price:2026q3:v1");
  assert.equal(sheet.refreshDueAt, renewal.refreshDueAt);
  assert.equal(sheet.status, "ready_to_collect");
  const blind = plan({ orders: [renewal] }).sheets[0]!;
  assert.equal(blind.recordTemplate.version, null, "without a registry the version is left to a person");
  assert.equal(blind.recordTemplate.supersedes, "fact:fixture:fixture-city:price:2026q3:v1");
  assert.ok(blind.issues.includes("existing_fact_unverified"));
  assert.equal(blind.status, "incomplete");
  const lost = plan({ orders: [{ ...renewal, closestFactId: "fact:fixture:fixture-city:missing:2026:v1" }], registry }).sheets[0]!;
  assert.ok(lost.issues.includes("existing_fact_not_found") && lost.issues.includes("renewal_without_existing_fact"));
  const noPredecessor = plan({ orders: [{ ...renewal, closestFactId: null }], registry }).sheets[0]!;
  assert.ok(noPredecessor.issues.includes("renewal_without_existing_fact"));
});

test("S5.3-B expired: an expired fact is described and superseded by the next version", () => {
  const registry = createFactRegistry();
  assert.equal(registry.register(priceFact({ validUntil: "2026-09-15T00:00:00Z" })).ok, true);
  const expired = ordersFor(registry).find((o) => o.reason === "expired" && o.requirementId === PRICE)!;
  const sheet = plan({ orders: [expired], registry }).sheets[0]!;
  assert.equal(sheet.mode, "refresh");
  assert.equal(sheet.recordTemplate.version, 2);
});

// --- timezone ---------------------------------------------------------------------------------------------------------------------

test("S5.3-B timezone: a timezone sheet is platform-neutral and asks for the zone only", () => {
  withLongStayRuleRequired(() => {
  const registry = createFactRegistry();
  const rule = {
    factId: "fact:fixture:fixture-city:rule:2026:v1", kind: "regulatory", scope: { ...SCOPE }, platform: "airbnb", propertyType: null, unit: null,
    source: { ...priceFact().source, sourceType: "official_authority", locator: { kind: "document_citation", citation: "FIXTURE" }, publicationRestrictions: [] },
    collectedAt: "2026-09-01T10:00:00Z", observedPeriod: null, validUntil: "2026-12-01T00:00:00Z", confidence: { level: "high", rationale: "FIXTURE" },
    validation: { status: "human_validated", validatedBy: "role:owner", validatedAt: "2026-09-02T10:00:00Z", note: null },
    usage: { use: { publicUse: "approved", approval: { approvedBy: "role:owner", approvedAt: "2026-09-03T10:00:00Z", scope: ["long-stay-guide"] } }, displayConstraints: [] },
    relevantTopics: ["long-stay-guide"], version: 1, supersedes: null,
    value: { ruleType: "minimum_stay", rule: "FIXTURE rule without any figure.", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE-ref" },
  } as unknown as LocalFact;
  assert.equal(registry.register(rule).ok, true);
  const zone = ordersFor(registry).find((o) => o.kind === "timezone")!;
  assert.ok(zone);
  const sheet = plan({ orders: [zone] }).sheets[0]!;
  assert.equal(sheet.kind, "timezone");
  assert.equal(sheet.platform, null);
  assert.equal(sheet.requirementId, "timezone");
  assert.equal((sheet.recordTemplate.value as { attribute: string }).attribute, "timezone");
  assert.equal(sheet.validity.maxAgeDays, null);
  assert.equal(sheet.status, "ready_to_collect");
  });
});

// --- stability, reproducibility, non-mutation ---------------------------------------------------------------------------------------

test("S5.3-B stability: order of orders, claims and pages does not change the output; two runs are byte-identical", () => {
  const registry = createFactRegistry();
  assert.equal(registry.register(priceFact()).ok, true);
  const orders = ordersFor(registry, [CITY, "fixture-two", "fixture-three"]);
  const sourceRegistry = registryOf(sourceEntry(), sourceEntry({ sourceId: "fixture-source-b" }));
  const claims = [claim(), claim({ sourceId: "fixture-source-b", scopes: [SCOPE, { level: "city", countryCode: "ZZ", citySlug: "fixture-two" }] })];
  const run = (o: readonly WorkOrder[], c: readonly SourceCoverageClaim[]) => serializeCollectionPlan(buildCollectionPlan({ orders: o, asOf: AS_OF, sourceRegistry, sourceCoverage: c, registry, importBaseline: { reportHash: "b".repeat(64) } }));
  const a = run(orders, claims);
  assert.equal(a, run(orders, claims));
  assert.equal(a, run([...orders].reverse(), [...claims].reverse()));
  const shuffledPages = orders.map((o) => ({ ...o, coversPages: [...o.coversPages].reverse() }));
  assert.equal(a, run(shuffledPages, claims));
  assert.equal(Buffer.from(a).equals(Buffer.from(run(orders, claims))), true);
  assert.notEqual(a, serializeCollectionPlan(buildCollectionPlan({ orders, asOf: "2026-10-02T00:00:00Z", sourceRegistry, sourceCoverage: claims, registry })), "the reference date is part of the plan");
});

test("S5.3-B no mutation and no clock: inputs are untouched and the module never reads the time", () => {
  const registry = createFactRegistry();
  assert.equal(registry.register(priceFact()).ok, true);
  const orders = ordersFor(registry);
  const sourceCoverage = [claim()];
  const before = JSON.stringify({ orders, sourceCoverage, facts: registry.list() });
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
    assert.doesNotThrow(() => buildCollectionPlan({ orders, asOf: AS_OF, sourceRegistry: registryOf(sourceEntry()), sourceCoverage, registry }));
  } finally {
    (globalThis as { Date: DateConstructor }).Date = RealDate;
  }
  assert.equal(JSON.stringify({ orders, sourceCoverage, facts: registry.list() }), before);
  assert.ok(Object.isFrozen(buildCollectionPlan({ orders, asOf: AS_OF })));
});

// --- at scale ----------------------------------------------------------------------------------------------------------------------------

test("S5.3-B scale: the 1,680 orders of the 240 real cities become 1,680 sheets, researched in country-sized units", () => {
  const realOrders = classifyCoverage({ cities: cities.map((c) => ({ slug: c.slug, country: c.country })), registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null }).workOrders;
  assert.equal(realOrders.length, 1680);
  const result = buildCollectionPlan({ orders: realOrders, asOf: AS_OF });
  assert.equal(result.sheets.length, 1680);
  assert.equal(result.summary.rejectedOrders, 0);
  assert.equal(new Set(result.sheets.map((s) => s.sheetId)).size, 1680);
  assert.equal(result.summary.byStatus.ready_to_collect, 1680);
  const countries = new Set(realOrders.map((o) => o.scope.countryCode));
  assert.equal(countries.size, 62);
  assert.equal(result.batches.length, 1, "no source is known, so everything waits in the unassigned batch");
  assert.equal(result.batches[0]!.units.length, countries.size * 7);
  assert.equal(serializeCollectionPlan(result), serializeCollectionPlan(buildCollectionPlan({ orders: [...realOrders].reverse(), asOf: AS_OF })));
});

test("S5.3-B requirements: topics that define the same requirement differently get separate sheets", () => {
  // inject a variant: market-analysis demands fresher prices than pricing-guide for the same requirement id
  const variant = {
    ...TOPIC_REQUIREMENTS,
    "market-analysis": {
      ...TOPIC_REQUIREMENTS["market-analysis"],
      required: TOPIC_REQUIREMENTS["market-analysis"].required.map((r) => (r.requirementId === PRICE ? { ...r, maxAgeDays: 30 } : r)),
    },
  } as typeof TOPIC_REQUIREMENTS;
  const base = orderOf(emptyOrders(), PRICE);
  const result = plan({ orders: [base], requirements: variant });
  assert.equal(result.sheets.length, 2, "two distinct definitions, two sheets");
  assert.deepEqual(result.sheets.map((s) => s.validity.maxAgeDays).sort(), [30, 90]);
  assert.ok(result.sheets.every((s) => s.issues.includes("requirement_variant_split")));
  const thirty = result.sheets.find((s) => s.validity.maxAgeDays === 30)!;
  assert.deepEqual(thirty.pages.map((p) => p.topic), ["market-analysis"]);
  assert.deepEqual(thirty.approvalTopics, ["market-analysis"]);
  assert.equal(result.sheets.reduce((n, s) => n + s.pages.length, 0), base.coversPages.length, "no page is lost or duplicated");
  assert.equal(new Set(result.sheets.map((s) => s.sheetId)).size, 2);
  assert.equal(plan({ orders: [base] }).sheets.length, 1, "with the real table the definitions agree and one sheet remains");
});
