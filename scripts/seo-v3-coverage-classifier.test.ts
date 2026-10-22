import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { withLongStayRuleRequired } from "./seo-v3-longstay-required";

import { classifyCoverage, serializeCoverageReport, CLASSIFIER_VERSION, type ClassifyInput, type CoverageEntry, type CoverageReport } from "../lib/seo/v3/coverageClassifier";
import { COUNTRY_ISO, resolveCountryIso, validateCountryIsoTable } from "../lib/seo/v3/geoScope";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import { stableStringify } from "../lib/seo/v3/editorialCatalog";
import type { FactSource } from "../lib/seo/v3/factSource";
import type { LocalFact } from "../lib/seo/v3/localFact";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "../lib/seo/v3/topics";
import { TOPIC_REQUIREMENTS, TOPIC_REQUIREMENTS_VERSION } from "../lib/seo/v3/topicRequirements";
import { cities } from "../data/cities";
import { factMatchesRequirement } from "../lib/seo/v3/factUse";
import { evaluateTopicFacts } from "../lib/seo/v3/topicFactEvaluation";
import type { RegulatoryRuleType } from "../lib/seo/v3/localFact";
import { buildCollectionPlan } from "../lib/seo/v3/collectionSheet";
import { sha256Hex } from "../lib/seo/v3/editorialCatalog";
import { TIMEZONE_REQUIREMENT } from "../lib/seo/v3/coverageClassifier";
import { runExclusive } from "./seo-v3-test-guard";
import type { FactRequirement, TopicRequirements } from "../lib/seo/v3/topicRequirements";

/**
 * S5.2 tests: deterministic coverage classifier.
 *
 * Every value is a FIXTURE: "fixture-city" does not exist, "Fixtureland" is not a country, the code ZZ is reserved,
 * publishers say "test only", numbers are artificial. None of it is, or may become, production data.
 *
 *   npx tsx scripts/seo-v3-coverage-classifier.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const CITY = "fixture-city";
const SCOPE = { level: "city", countryCode: "ZZ", citySlug: CITY } as const;
const FIXTURE_ISO = { Fixtureland: "ZZ" };
const FIXTURE_CITIES = [{ slug: CITY, country: "Fixtureland" }];
const PUBLISHER = "Fixture Publisher (test only)";
const MEASURED = ["show_sample_size", "show_observation_period", "show_confidence"] as const;

// --- fixtures -----------------------------------------------------------------------------------

const evidence = (): FactSource["evidence"] => [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }];
const licensed = (): FactSource => ({
  sourceId: "fixture-source-licensed", sourceType: "licensed_dataset", publisher: PUBLISHER, title: null,
  locator: { kind: "document_citation", citation: "FIXTURE - not a real publication" }, publishedAt: "2026-08-15",
  consultedAt: "2026-09-01T09:00:00Z", collectionMethod: { kind: "dataset_download", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: [], evidence: evidence(),
});
const editorialSource = (): FactSource => ({
  ...licensed(), sourceId: "fixture-source-editorial", sourceType: "editorial_note",
  locator: { kind: "internal_reference", reference: "fixture-editorial-note" },
  collectionMethod: { kind: "editorial_judgement", description: "fixture" }, evidence: [{ kind: "internal_record", reference: "fixture-record" }],
});
const officialSource = (): FactSource => ({ ...licensed(), sourceId: "fixture-source-official", sourceType: "official_authority" });
const approvedFor = (topics: string[]) => ({
  use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-03T10:00:00Z", scope: topics } },
});
const UNAPPROVED = { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] };
const PRICE_TOPICS = ["pricing-guide", "pricing-positioning", "market-analysis", "competitor-analysis", "revenue-optimization"];

function priceFact(overrides: Record<string, unknown> = {}): LocalFact {
  return {
    factId: "fact:fixture:fixture-city:price:2026q3:v1", kind: "quantitative", scope: { ...SCOPE }, platform: "airbnb", propertyType: null,
    unit: null, source: licensed(), collectedAt: "2026-09-01T10:00:00Z", observedPeriod: { start: "2026-06-01", end: "2026-08-31" },
    validUntil: "2026-12-01T00:00:00Z", confidence: { level: "high", rationale: "FIXTURE" },
    validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-02T10:00:00Z", note: null },
    usage: { ...approvedFor(PRICE_TOPICS), displayConstraints: [...MEASURED] }, relevantTopics: [...PRICE_TOPICS], version: 1, supersedes: null,
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, p25: 90, p75: 130, sampleSize: 25 },
    ...overrides,
  } as LocalFact;
}
function guestFact(topics: string[], overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:guest:2026:v1", kind: "qualitative", source: editorialSource(), observedPeriod: null,
    relevantTopics: topics, usage: { ...approvedFor(topics), displayConstraints: ["label_as_editorial_note"] },
    value: { category: "guest_expectation", statement: "FIXTURE sentence without any figure.", language: "en", basis: "editorial_observation" },
    ...overrides,
  });
}
function visualFact(topics: string[], overrides: Record<string, unknown> = {}): LocalFact {
  return guestFact(topics, {
    factId: "fact:fixture:fixture-city:visual:2026:v1",
    value: { category: "visual_character", statement: "FIXTURE visual sentence without any figure.", language: "en", basis: "editorial_observation" },
    ...overrides,
  });
}
function timezoneFact(): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:tz:2026:v1", kind: "geographic", source: officialSource(), observedPeriod: null, relevantTopics: ["long-stay-guide"], platform: null, propertyType: null,
    usage: { ...approvedFor(["long-stay-guide"]), displayConstraints: [] }, value: { attribute: "timezone", value: "Europe/Paris" },
  });
}
function ruleFact(overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:rule:2026:v1", kind: "regulatory", source: officialSource(), observedPeriod: null, relevantTopics: ["long-stay-guide"],
    usage: { ...approvedFor(["long-stay-guide"]), displayConstraints: [] },
    value: { ruleType: "minimum_stay", rule: "FIXTURE rule text without any figure.", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE-ref" },
    ...overrides,
  });
}

function registryWith(...facts: LocalFact[]): FactRegistry {
  const registry = createFactRegistry();
  for (const fact of facts) {
    const outcome = registry.register(fact);
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
  }
  return registry;
}
const snapshotOf = (registry: FactRegistry) => stableStringify(registry.list());

function run(registry: FactRegistry, overrides: Partial<ClassifyInput> = {}): CoverageReport {
  return classifyCoverage({
    cities: FIXTURE_CITIES, registry, asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, countryIsoTable: FIXTURE_ISO, ...overrides,
  });
}
function entryOf(report: CoverageReport, topic: LocalSeoTopicSlug, slug = CITY): CoverageEntry {
  const found = report.entries.find((entry) => entry.citySlug === slug && entry.topic === topic);
  assert.ok(found, `missing entry ${slug}/${topic}`);
  return found;
}

// --- 10. ISO table ----------------------------------------------------------------------------------------

test("S5.2 geoScope: the table covers all 62 countries of data/cities.ts with valid, unambiguous codes", () => {
  const countries = [...new Set(cities.map((city) => city.country))];
  assert.equal(countries.length, 62);
  for (const country of countries) assert.match(resolveCountryIso(country) ?? "", /^[A-Z]{2}$/, country);
  assert.deepEqual(validateCountryIsoTable(COUNTRY_ISO), []);
  assert.equal(new Set(Object.values(COUNTRY_ISO)).size, Object.keys(COUNTRY_ISO).length, "two names share one code");
  assert.ok(Object.isFrozen(COUNTRY_ISO));
});

test("S5.2 geoScope: no inference, no prototype lookups, invalid tables are reported", () => {
  for (const bad of ["", " ", "france", "Frnace", "__proto__", "constructor", null, undefined, 3]) assert.equal(resolveCountryIso(bad), null);
  assert.ok(validateCountryIsoTable({ A: "fr" }).length > 0);
  assert.ok(validateCountryIsoTable({ A: "FR", B: "FR" }).length > 0);
});

// --- 1. empty registry ------------------------------------------------------------------------------------

test("S5.2 empty registry: nothing is publishable, every non-universal topic needs data, no assembly is run", () => {
  const report = run(registryWith());
  assert.equal(report.entries.length, LOCAL_SEO_TOPIC_SLUGS.length);
  for (const topic of LOCAL_SEO_TOPIC_SLUGS) {
    const entry = entryOf(report, topic);
    assert.equal(entry.publicationAuthorised, false);
    assert.equal(entry.indexingAuthorised, false);
    assert.notEqual(entry.coverageClass, "candidate_for_editorial_review");
    // long-stay-guide has no required fact since draft-2 (its rule is optional): a person decides, like a universal topic
    if (TOPIC_REQUIREMENTS[topic].family === "universal" || topic === "long-stay-guide") assert.equal(entry.coverageClass, "needs_human_decision", topic);
    else {
      assert.equal(entry.coverageClass, "needs_data", topic);
      assert.ok(entry.blockers.includes("facts_absent"), topic);
    }
  }
  assert.equal(report.stats.assembliesRun, 0, "blocked topics must not be assembled");
  assert.equal(report.summary.candidate_for_editorial_review, 0);
});

// --- 2/3. thresholds ----------------------------------------------------------------------------------------

test("S5.2 thresholds: a complete qualitative fact is capped by the unconfirmed threshold in the strict profile", () => {
  const registry = registryWith(guestFact(["family-travel-guide", "amenities-guide"]));
  const entry = entryOf(run(registry), "family-travel-guide");
  assert.equal(entry.coverageClass, "needs_human_decision");
  assert.deepEqual(entry.blockers.filter((b) => b === "threshold_unconfirmed"), ["threshold_unconfirmed"]);
  assert.equal(entry.experimentalOnly, false);
});

test("S5.2 thresholds: the experimental profile labels the page, never counts it as ready, and keeps the blocker visible", () => {
  const registry = registryWith(guestFact(["family-travel-guide", "amenities-guide"]));
  const report = run(registry, { thresholdProfile: "experimental-pipeline-validation" });
  const entry = entryOf(report, "family-travel-guide");
  assert.equal(entry.coverageClass, "experimental_candidate");
  assert.equal(entry.experimentalOnly, true);
  assert.deepEqual(entry.blockers, ["threshold_unconfirmed"], "the unconfirmed threshold must be the only obstacle");
  assert.equal(entry.publicationAuthorised, false);
  assert.equal(report.summary.candidate_for_editorial_review, 0);
  assert.equal(report.summary.experimental_candidate, 2);
  assert.equal(report.stats.readyCount, 0);
});

test("S5.2 thresholds: the experimental profile does not rescue a failed draft check or a missing fact", () => {
  const weak = guestFact(["family-travel-guide"], { confidence: { level: "very_low", rationale: "FIXTURE" } });
  const entry = entryOf(run(registryWith(weak), { thresholdProfile: "experimental-pipeline-validation" }), "family-travel-guide");
  assert.equal(entry.coverageClass, "needs_human_decision");
  const none = entryOf(run(registryWith(), { thresholdProfile: "experimental-pipeline-validation" }), "family-travel-guide");
  assert.equal(none.coverageClass, "needs_data");
  const universal = entryOf(run(registryWith(), { thresholdProfile: "experimental-pipeline-validation" }), "seo-guide");
  assert.equal(universal.coverageClass, "needs_human_decision");
  assert.equal(universal.experimentalOnly, false);
});

test("S5.2 ready: a fully met aligned topic reaches editorial review only, with both authorisations false", () => {
  const registry = registryWith(priceFact());
  const report = run(registry);
  const entry = entryOf(report, "pricing-guide");
  assert.equal(entry.rawAssemblyStatus, "ready_for_editorial_review");
  assert.equal(entry.topicFactsOverall, "all_required_met");
  assert.equal(entry.publicationAuthorised, false);
  assert.equal(entry.indexingAuthorised, false);
  assert.ok(report.stats.assembliesRun >= 1);
});

// --- 4/5. expired, rejected, pending, source ----------------------------------------------------------------

test("S5.2 expired fact: acquisition order names the closest fact; a refreshed series is not a new fact", () => {
  const registry = registryWith(priceFact({ validUntil: "2026-09-15T00:00:00Z" }));
  const report = run(registry);
  const entry = entryOf(report, "pricing-guide");
  assert.equal(entry.coverageClass, "needs_data");
  assert.ok(entry.blockers.includes("facts_expired"));
  const order = report.workOrders.find((o) => o.requirementId === "nightly_price_distribution");
  assert.ok(order);
  assert.equal(order.closestFactId, "fact:fixture:fixture-city:price:2026q3:v1");
  assert.equal(order.reason, "expired");
  assert.equal(order.requirementsVersion, TOPIC_REQUIREMENTS_VERSION);
});

test("S5.2 rejected fact: needs a new fact, not a review", () => {
  const rejected = priceFact({ validation: { status: "rejected", rejectedAt: "2026-09-02T10:00:00Z", reason: "FIXTURE" }, usage: UNAPPROVED });
  const entry = entryOf(run(registryWith(rejected)), "pricing-guide");
  assert.equal(entry.coverageClass, "needs_data");
  assert.ok(entry.blockers.includes("facts_absent"));
});

test("S5.2 pending validation: goes to the review queue, produces no collection order", () => {
  const pending = priceFact({ validation: { status: "pending_review", submittedAt: "2026-09-02T10:00:00Z" }, usage: UNAPPROVED });
  const report = run(registryWith(pending));
  const entry = entryOf(report, "pricing-guide");
  assert.equal(entry.coverageClass, "needs_review_queue");
  assert.ok(entry.blockers.includes("facts_pending_validation"));
  assert.ok(entry.actions.some((a) => a.kind === "review_fact"));
  assert.equal(report.workOrders.filter((o) => o.coversPages.some((p) => p.topic === "pricing-guide")).length, 0);
});

test("S5.2 insufficient provenance: a source type the requirement refuses needs re-sourcing", () => {
  // a cited official-authority note is valid for the registry, but family-travel-guide accepts other source types
  const wrongSource = guestFact(["family-travel-guide"], {
    source: officialSource(),
    value: { category: "guest_expectation", statement: "FIXTURE cited sentence without any figure.", language: "en", basis: "cited_source" },
  });
  const entry = entryOf(run(registryWith(wrongSource)), "family-travel-guide");
  assert.equal(entry.coverageClass, "needs_resourcing");
  assert.ok(entry.blockers.includes("source_type_not_accepted"));
  assert.ok(entry.actions.some((a) => a.kind === "resource"));
});

test("S5.2 audit lock: acquisition for price topics never asks for user_audit_aggregate", () => {
  const report = run(registryWith());
  const order = report.workOrders.find((o) => o.requirementId === "nightly_price_distribution");
  assert.ok(order);
  assert.deepEqual(order.acceptedSourceTypes, ["licensed_dataset"]);
  assert.ok(report.decisionsRequired.some((d) => d.id === "audit_public_use_governance"));
});

// --- 8. timezone --------------------------------------------------------------------------------------------

test("S5.2 timezone: a rule without a validated time zone yields a separate timezone order, and the right blocker", () => {
  withLongStayRuleRequired(() => {
  const without = run(registryWith(ruleFact()));
  const entry = entryOf(without, "long-stay-guide");
  assert.equal(entry.coverageClass, "needs_data");
  assert.ok(entry.blockers.includes("timezone_unvalidated"));
  assert.ok(!entry.blockers.includes("facts_absent"));
  const zoneOrder = without.workOrders.find((o) => o.kind === "timezone" && o.scope.level === "city");
  assert.ok(zoneOrder);
  assert.equal(zoneOrder.platform, null, "the registry resolves a zone only from a platform-neutral fact");
  const withZone = run(registryWith(ruleFact(), timezoneFact()));
  assert.ok(!entryOf(withZone, "long-stay-guide").blockers.includes("timezone_unvalidated"));
  });
});

// --- 9. unknown country --------------------------------------------------------------------------------------

test("S5.2 unknown country: no guessed code, a human decision on the table, nothing evaluated", () => {
  const report = run(registryWith(), { cities: [{ slug: CITY, country: "Atlantis" }] });
  for (const entry of report.entries) {
    assert.equal(entry.coverageClass, "needs_human_decision");
    assert.deepEqual(entry.blockers, ["country_iso_unknown"]);
    assert.equal(entry.countryCode, null);
  }
  assert.ok(report.decisionsRequired.some((d) => d.id === "country_iso_table"));
});

test("S5.2 invalid input: a bad asOf or a bad city slug is invalid, never an exception", () => {
  const badClock = run(registryWith(), { asOf: "yesterday" });
  for (const entry of badClock.entries) assert.equal(entry.coverageClass, "invalid");
  const badSlug = run(registryWith(), { cities: [{ slug: "Not A Slug", country: "Fixtureland" }] });
  for (const entry of badSlug.entries) assert.equal(entry.coverageClass, "invalid");
});

// --- 11/12. exact scope and platform ----------------------------------------------------------------------

test("S5.2 exact scope: a country-level fact never answers a city page", () => {
  const nationalPrice = priceFact({ factId: "fact:fixture:zz:price:2026q3:v1", scope: { level: "country", countryCode: "ZZ" } });
  const entry = entryOf(run(registryWith(nationalPrice)), "pricing-guide");
  assert.equal(entry.coverageClass, "needs_data");
  assert.ok(entry.blockers.includes("facts_absent"));
});

test("S5.2 platform: a platform-neutral fact never answers an airbnb page", () => {
  const neutral = priceFact({ platform: null });
  const entry = entryOf(run(registryWith(neutral)), "pricing-guide");
  assert.equal(entry.coverageClass, "needs_data");
  assert.ok(entry.blockers.includes("facts_absent"));
});

// --- 13/14. cross-topic duplication, per-topic approval --------------------------------------------------

test("S5.2 cross-topic duplication: one fact feeding several topics of a city is a warning with its page count, not a refusal", () => {
  const report = run(registryWith(priceFact()));
  for (const topic of PRICE_TOPICS as LocalSeoTopicSlug[]) assert.ok(entryOf(report, topic).warnings.includes("shared_fact_across_topics"), topic);
  const reuse = report.factReuse.find((r) => r.factId === "fact:fixture:fixture-city:price:2026q3:v1");
  assert.ok(reuse && reuse.pages >= 2);
});

test("S5.2 cross-topic duplication: pages that render the same text are blocked as duplicates", () => {
  const report = run(registryWith(priceFact()));
  const ready = PRICE_TOPICS.filter((t) => entryOf(report, t as LocalSeoTopicSlug).rawAssemblyStatus === "ready_for_editorial_review");
  assert.ok(ready.length >= 2);
  for (const topic of ready) {
    const entry = entryOf(report, topic as LocalSeoTopicSlug);
    assert.ok(entry.blockers.includes("duplicate_across_topics"), topic);
    assert.notEqual(entry.coverageClass, "candidate_for_editorial_review");
  }
});

test("S5.2 candidate: a fully met page with its own fact reaches candidate_for_editorial_review, and only that", () => {
  const solo = priceFact({ relevantTopics: ["pricing-guide"], usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED] } });
  const report = run(registryWith(solo));
  const entry = entryOf(report, "pricing-guide");
  assert.equal(entry.coverageClass, "candidate_for_editorial_review");
  assert.deepEqual(entry.blockers, []);
  assert.equal(entry.experimentalOnly, false);
  assert.equal(entry.publicationAuthorised, false);
  assert.equal(entry.indexingAuthorised, false);
  assert.equal(report.stats.readyCount, 1);
  assert.equal(report.summary.candidate_for_editorial_review, 1);
});

test("S5.2 per-topic approval: a shared fact approved for one topic only blocks the other with the precise blocker", () => {
  const registry = registryWith(visualFact(["photo-tips", "first-photo"], { usage: { ...approvedFor(["first-photo"]), displayConstraints: ["label_as_editorial_note"] } }));
  const report = run(registry);
  assert.ok(entryOf(report, "photo-tips").blockers.includes("approval_scope_excludes_topic"));
  assert.ok(!entryOf(report, "first-photo").blockers.includes("approval_scope_excludes_topic"));
});

// --- 15. work-order deduplication ----------------------------------------------------------------------

test("S5.2 work orders: one order per full key, aggregating the pages it covers; no copy to other places", () => {
  const report = run(registryWith(), { cities: [...FIXTURE_CITIES, { slug: "fixture-two", country: "Fixtureland" }] });
  const orders = report.workOrders.filter((o) => o.requirementId === "nightly_price_distribution");
  assert.equal(orders.length, 2, "one order per city scope, never one per topic");
  for (const order of orders) {
    assert.equal(order.coversPages.length, 5, "the four price topics and revenue-optimization share one requirement");
    assert.equal(order.platform, "airbnb");
    assert.ok(order.scope.level === "city");
  }
  assert.equal(new Set(report.workOrders.map((o) => o.id)).size, report.workOrders.length);
});

// --- 16. competing qualitative notes ------------------------------------------------------------------------

test("S5.2 qualitative conflicts: two competing validated notes are reported as a warning", () => {
  const first = guestFact(["family-travel-guide"]);
  const second = guestFact(["family-travel-guide"], { factId: "fact:fixture:fixture-city:guest-b:2026:v1", value: { category: "guest_expectation", statement: "FIXTURE another sentence without any figure.", language: "en", basis: "editorial_observation" } });
  const entry = entryOf(run(registryWith(first, second)), "family-travel-guide");
  assert.ok(entry.warnings.includes("competing_qualitative_notes"));
});

// --- 17. universal topics -----------------------------------------------------------------------------------

test("S5.2 universal topics: a hub section is proposed, never executed or published", () => {
  const report = run(registryWith());
  const entry = entryOf(report, "listing-audit");
  assert.equal(entry.coverageClass, "needs_human_decision");
  assert.ok(entry.blockers.includes("hub_proposal"));
  assert.ok(entry.actions.some((a) => a.kind === "propose_hub_section_only"));
  assert.equal(entry.publicationAuthorised, false);
  assert.ok(report.decisionsRequired.some((d) => d.id === "universal_topic_hub_policy"));
});

// --- 18-20/22. determinism ----------------------------------------------------------------------------------

test("S5.2 determinism: input order does not change the output; two runs are identical to the byte", () => {
  const registry = registryWith(priceFact(), guestFact(["family-travel-guide", "amenities-guide"]), ruleFact());
  const citiesIn = [...FIXTURE_CITIES, { slug: "fixture-two", country: "Fixtureland" }, { slug: "fixture-three", country: "Fixtureland" }];
  const topicsIn = [...LOCAL_SEO_TOPIC_SLUGS];
  const a = serializeCoverageReport(run(registry, { cities: citiesIn, topics: topicsIn }));
  const b = serializeCoverageReport(run(registry, { cities: citiesIn, topics: topicsIn }));
  const c = serializeCoverageReport(run(registry, { cities: [...citiesIn].reverse(), topics: [...topicsIn].reverse() }));
  assert.equal(a, b);
  assert.equal(a, c);
  assert.equal(Buffer.from(a).equals(Buffer.from(b)), true);
});

test("S5.2 traceability: the report carries every version and fingerprint it depends on", () => {
  const registry = registryWith(priceFact());
  const report = run(registry);
  assert.equal(report.meta.classifierVersion, CLASSIFIER_VERSION);
  assert.equal(report.meta.requirementsVersion, TOPIC_REQUIREMENTS_VERSION);
  assert.equal(report.meta.assemblerRuleVersion, "seo-v3-assembler/1");
  assert.equal(report.meta.asOf, AS_OF);
  assert.equal(report.meta.platform, "airbnb");
  assert.match(report.meta.registrySnapshotId, /^[0-9a-f]{64}$/);
  assert.match(report.meta.catalogId, /\S/);
  assert.equal(report.meta.thresholdProfile, "draft-provisional");
});

test("S5.2 non-mutation: the registry is identical before and after, including its fingerprint", () => {
  const registry = registryWith(priceFact(), guestFact(["family-travel-guide"]));
  const before = snapshotOf(registry);
  const size = registry.size();
  run(registry);
  run(registry, { thresholdProfile: "experimental-pipeline-validation" });
  assert.equal(snapshotOf(registry), before);
  assert.equal(registry.size(), size);
});

test("S5.2 no clock: the classifier never reads the current time", () => {
  const registry = registryWith(priceFact());
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
    assert.doesNotThrow(() => run(registry));
  } finally {
    (globalThis as { Date: DateConstructor }).Date = RealDate;
  }
});

// --- renewal ---------------------------------------------------------------------------------------------

test("S5.2 renewal: a fact close to its refresh date yields a renewal order that names the series head", () => {
  const registry = registryWith(priceFact({ validUntil: "2026-10-15T00:00:00Z" }));
  const report = run(registry, { refreshLookaheadDays: 30 });
  const order = report.workOrders.find((o) => o.reason === "renewal_due");
  assert.ok(order);
  assert.equal(order.closestFactId, "fact:fixture:fixture-city:price:2026q3:v1");
  assert.ok(order.refreshDueAt !== null);
});

// --- production-shaped input -------------------------------------------------------------------------------

test("S5.2 real city list: all 6000 pages are classified, none publishable, with the real ISO table", () => {
  const report = classifyCoverage({
    cities: cities.map((c) => ({ slug: c.slug, country: c.country })), registry: registryWith(), asOf: AS_OF,
    thresholdProfile: "draft-provisional", propertyType: null,
  });
  assert.equal(report.entries.length, 6000);
  assert.equal(report.summary.candidate_for_editorial_review, 0);
  assert.equal(report.entries.filter((e) => e.coverageClass === "invalid").length, 0);
  assert.equal(report.entries.filter((e) => e.blockers.includes("country_iso_unknown")).length, 0);
  assert.ok(report.entries.every((e) => e.publicationAuthorised === false && e.indexingAuthorised === false));
});

// --- review follow-ups ---------------------------------------------------------------------------------------

test("S5.2 work orders merge: the most urgent reason, the earliest due date and the union of sources win", () => {
  // pricing-guide sees an expired fact; revenue-optimization (same requirement id) must not mask it
  const registry = registryWith(priceFact({ validUntil: "2026-09-15T00:00:00Z" }));
  const report = run(registry);
  const order = report.workOrders.find((o) => o.requirementId === "nightly_price_distribution");
  assert.ok(order);
  assert.equal(order.reason, "expired");
  assert.equal(order.coversPages.length, 5);
});

test("S5.2 renewal: the due date is min(validUntil, age + maxAge); outside the lookahead there is no order", () => {
  const near = run(registryWith(priceFact({ validUntil: "2026-10-15T00:00:00Z" })), { refreshLookaheadDays: 30 });
  assert.equal(near.workOrders.find((o) => o.reason === "renewal_due")?.refreshDueAt, "2026-10-15T00:00:00.000Z");
  const far = run(registryWith(priceFact({ validUntil: "2026-12-01T00:00:00Z" })), { refreshLookaheadDays: 30 });
  assert.equal(far.workOrders.filter((o) => o.reason === "renewal_due").length, 0);
});

test("S5.2 robustness: odd cities, duplicate slugs and a throwing registry never crash the run", () => {
  const odd = run(registryWith(), { cities: [null, undefined, 3, { slug: 1 }, ...FIXTURE_CITIES, ...FIXTURE_CITIES] as never });
  assert.equal(odd.entries.length, LOCAL_SEO_TOPIC_SLUGS.length);
  assert.deepEqual(odd.meta.ignoredDuplicateCitySlugs, [CITY]);
  assert.equal(run(registryWith(), { cities: null as never }).entries.length, 0);
  const base = registryWith();
  const throwing = { ...base, findFacts: () => { throw new Error("boom"); } } as FactRegistry;
  const report = run(throwing);
  for (const entry of report.entries) assert.ok(entry.coverageClass === "invalid" || entry.coverageClass === "needs_human_decision");
  assert.ok(report.entries.some((e) => e.coverageClass === "invalid"));
});

test("S5.2 determinism: registry insertion order does not change the output", () => {
  const facts = [priceFact(), guestFact(["family-travel-guide", "amenities-guide"]), visualFact(["photo-tips", "first-photo"])];
  const a = serializeCoverageReport(run(registryWith(...facts)));
  const b = serializeCoverageReport(run(registryWith(...[...facts].reverse())));
  assert.equal(a, b);
});

test("S5.2 actions: no action appears twice on a page", () => {
  const report = run(registryWith(ruleFact()));
  for (const entry of report.entries) assert.equal(new Set(entry.actions.map((a) => stableStringify(a))).size, entry.actions.length, `${entry.topic}`);
});

// --- S5.2 finalisation ---------------------------------------------------------------------------------------

test("S5.2 timezone + expiry: an unknown zone no longer hides an expired rule; both blockers and both orders remain", () => {
  withLongStayRuleRequired(() => {
  const report = run(registryWith(ruleFact({ validUntil: "2026-09-15T00:00:00Z" })));
  const entry = entryOf(report, "long-stay-guide");
  assert.ok(entry.blockers.includes("timezone_unvalidated"));
  assert.ok(entry.blockers.includes("facts_expired"));
  assert.equal(entry.coverageClass, "needs_data");
  assert.ok(report.workOrders.some((o) => o.kind === "timezone"));
  assert.ok(report.workOrders.some((o) => o.kind === "fact" && o.requirementId === TOPIC_REQUIREMENTS["long-stay-guide"].required[0]!.requirementId && o.reason === "expired"));
  });
});

test("S5.2 conflicting_facts: two usable facts that disagree need a person, not a pick", () => {
  const a = priceFact();
  const b = priceFact({ factId: "fact:fixture:fixture-city:price-b:2026q3:v1", observedPeriod: { start: "2026-07-01", end: "2026-08-20" }, value: { metric: "nightly_price_distribution", currency: "EUR", median: 150, sampleSize: 25 } });
  const entry = entryOf(run(registryWith(a, b)), "pricing-guide");
  assert.ok(entry.blockers.includes("conflicting_facts"));
  assert.equal(entry.coverageClass, "needs_human_decision");
});

test("S5.2 revoked_series_overlap: a live fact overlapping a revoked one of its series waits for an arbitration", () => {
  const revoked = priceFact({
    factId: "fact:fixture:fixture-city:price-old:2026q3:v1",
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 99.99, p25: 80, p75: 120, sampleSize: 25 },
    validation: { status: "revoked", revokedAt: "2026-09-20T00:00:00Z", reason: "FIXTURE" }, usage: UNAPPROVED,
  });
  const entry = entryOf(run(registryWith(revoked, priceFact({ observedPeriod: { start: "2026-07-01", end: "2026-08-20" } }))), "pricing-guide");
  assert.ok(entry.blockers.includes("revoked_series_overlap"));
  assert.equal(entry.coverageClass, "needs_human_decision");
  assert.ok(entry.actions.some((a) => a.kind === "decide" && a.decisionId === "fact_arbitration"));
});

test("S5.2 open_editorial_decision: a topic with an open product question is routed to a named decision", () => {
  const report = run(registryWith());
  const entry = entryOf(report, "listing-audit");
  assert.ok(entry.blockers.includes("open_editorial_decision"));
  assert.ok(report.decisionsRequired.some((d) => d.id === "open_decision:listing-audit" && d.blocksPages === 1));
});

test("S5.2 assembly_not_ready: met requirements whose page the assembler refuses are not candidates", () => {
  // every requirement is met, but the catalogue was not built by createEditorialCatalog: the assembler refuses the request
  const solo = priceFact({ relevantTopics: ["pricing-guide"], usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED] } });
  const report = run(registryWith(solo), { catalog: { catalogId: "fixture-forged-catalog" } as never });
  const entry = entryOf(report, "pricing-guide");
  assert.equal(entry.topicFactsOverall, "all_required_met");
  assert.equal(entry.rawAssemblyStatus, "invalid_request");
  assert.ok(entry.blockers.includes("assembly_not_ready"));
  assert.equal(entry.coverageClass, "needs_human_decision");
  assert.ok(entry.reasons.some((reason) => reason.startsWith("assembly:")));
  assert.equal(report.stats.readyCount, 0);
});

test("S5.2 below_distinct_fact_target: a page resting on a single distinct fact carries the warning", () => {
  const solo = priceFact({ relevantTopics: ["pricing-guide"], usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED] } });
  const entry = entryOf(run(registryWith(solo)), "pricing-guide");
  assert.equal(entry.distinctFactCount, 1);
  assert.ok(entry.warnings.includes("below_distinct_fact_target"));
  assert.equal(entryOf(run(registryWith()), "pricing-guide").warnings.includes("below_distinct_fact_target"), false, "no fact, no warning");
});

test("S5.2 experimental pages stay unpublishable and are documented as not assembled", () => {
  const report = run(registryWith(guestFact(["family-travel-guide", "amenities-guide"])), { thresholdProfile: "experimental-pipeline-validation" });
  const experimental = report.entries.filter((e) => e.coverageClass === "experimental_candidate");
  assert.equal(experimental.length, 2);
  for (const entry of experimental) {
    assert.equal(entry.experimentalOnly, true);
    assert.equal(entry.rawAssemblyStatus, "not_assembled");
    assert.equal(entry.publicationAuthorised, false);
    assert.equal(entry.indexingAuthorised, false);
  }
  assert.equal(report.stats.readyCount, 0);
  assert.equal(report.stats.assembliesRun, 0);
  assert.match(readFileSync(new URL("../lib/seo/v3/coverageClassifier.ts", import.meta.url), "utf8"), /experimental page is NOT assembled/);
});

// --- S5.3-C3: long-stay-guide, optional stay-length rule -----------------------------------------------------------

const RULE_TYPES: readonly RegulatoryRuleType[] = ["registration_required", "night_cap", "minimum_stay", "tax", "permit", "other"];
const ruleOfType = (ruleType: RegulatoryRuleType) =>
  ruleFact({ value: { ruleType, rule: "FIXTURE rule text without any figure.", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE-ref" } });
const LONG_STAY = () => TOPIC_REQUIREMENTS["long-stay-guide"];
const evalLongStay = (registry: FactRegistry) =>
  evaluateTopicFacts(registry, { target: SCOPE, platform: "airbnb", propertyType: null, topic: "long-stay-guide", asOf: AS_OF, use: "public" });

test("C3 definition: the version is draft-3 (draft-2 for the long-stay change) and long-stay-guide has an optional, type-filtered rule and nothing required", () => {
  assert.equal(TOPIC_REQUIREMENTS_VERSION, "seo-v3-topic-requirements/draft-3");
  assert.deepEqual(LONG_STAY().required, []);
  const rule = LONG_STAY().optional.find((r) => r.requirementId === "long_stay_rule")!;
  assert.ok(rule);
  assert.equal(rule.kind, "regulatory");
  assert.deepEqual((rule as { ruleType: unknown }).ruleType, ["minimum_stay", "night_cap"]);
  assert.deepEqual(rule.acceptableSourceTypes, ["official_authority"]);
  assert.equal(rule.requiresHumanValidation, true);
  assert.equal(rule.maxAgeDays, 180, "the 180 days stay provisional and unchanged");
  assert.equal(rule.thresholdBasis, "provisional_pending_human_decision");
  assert.equal(LONG_STAY().standalonePolicy, "requires_human_editorial_decision");
});

test("C3 six rule types: only minimum_stay and night_cap are admissible, and admissible is not relevant", () => {
  const rule = LONG_STAY().optional.find((r) => r.requirementId === "long_stay_rule")!;
  const admissible = RULE_TYPES.filter((type) => factMatchesRequirement(ruleOfType(type), rule));
  assert.deepEqual([...admissible].sort(), ["minimum_stay", "night_cap"]);
  for (const type of ["tax", "permit", "registration_required", "other"] as const) {
    const report = evalLongStay(registryWith(ruleOfType(type)));
    assert.equal(report.requirements.find((r) => r.requirementId === "long_stay_rule")!.chosenFactId, null, type);
  }
  // an admissible type is only a filter: without a human validation the requirement is still not met
  const pending = ruleFact({ validation: { status: "pending_review", submittedAt: "2026-09-02T10:00:00Z" }, usage: UNAPPROVED });
  const report = evalLongStay(registryWith(pending));
  assert.notEqual(report.requirements.find((r) => r.requirementId === "long_stay_rule")!.status, "met");
});

test("C3 other topics keep a rule requirement that accepts any type", () => {
  for (const topic of ["market-analysis", "family-travel-guide", "business-travel-guide"] as const) {
    const rule = TOPIC_REQUIREMENTS[topic].optional.find((r) => r.requirementId === "official_rule")!;
    assert.ok(rule, topic);
    assert.equal((rule as { ruleType: unknown }).ruleType, "any", topic);
    assert.equal(rule.maxAgeDays, 180, topic);
    for (const type of RULE_TYPES) assert.ok(factMatchesRequirement(ruleOfType(type), rule), `${topic}/${type}`);
  }
  for (const topic of LOCAL_SEO_TOPIC_SLUGS) {
    if (topic === "long-stay-guide") continue;
    assert.ok(!TOPIC_REQUIREMENTS[topic].required.some((r) => r.requirementId === "long_stay_rule"), topic);
  }
});

test("C3 absent rule: long-stay-guide is no longer blocked for lack of a rule, raises no order, and is still never a candidate", () => {
  const report = run(registryWith());
  const entry = entryOf(report, "long-stay-guide");
  assert.equal(entry.coverageClass, "needs_human_decision");
  assert.ok(!entry.blockers.includes("facts_absent"));
  assert.ok(entry.blockers.includes("local_editorial_decision"));
  assert.ok(!report.workOrders.some((o) => o.requirementId === "long_stay_rule"));
  assert.equal(entry.publicationAuthorised, false);
  assert.equal(entry.indexingAuthorised, false);
});

test("C3 a validated, approved stay rule does not make the page ready; a tax rule changes nothing", () => {
  for (const profile of ["draft-provisional", "experimental-pipeline-validation"] as const) {
    const withRule = run(registryWith(timezoneFact(), ruleOfType("minimum_stay")), { thresholdProfile: profile });
    const entry = entryOf(withRule, "long-stay-guide");
    assert.notEqual(entry.coverageClass, "candidate_for_editorial_review", profile);
    assert.equal(entry.publicationAuthorised, false);
    assert.equal(entry.indexingAuthorised, false);
    assert.ok(entry.blockers.includes("local_editorial_decision"));
  }
  const withTax = run(registryWith(timezoneFact(), ruleOfType("tax")));
  const without = run(registryWith(timezoneFact()));
  assert.deepEqual(entryOf(withTax, "long-stay-guide").blockers, entryOf(without, "long-stay-guide").blockers);
});

test("C3 6,000 pages: only long-stay-guide moves (240 pages), nothing becomes ready, orders drop from 1,920 to 1,680", () => {
  const report = classifyCoverage({ cities, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null });
  assert.equal(report.entries.length, 6000);
  const count = (cls: string) => report.entries.filter((e) => e.coverageClass === cls).length;
  assert.equal(count("needs_data"), 3360);
  assert.equal(count("needs_human_decision"), 2640);
  assert.equal(count("candidate_for_editorial_review") + count("experimental_candidate"), 0);
  assert.equal(report.workOrders.length, 1680);
  assert.ok(report.entries.every((e) => e.publicationAuthorised === false && e.indexingAuthorised === false));
  assert.equal(report.entries.filter((e) => e.topic === "long-stay-guide" && e.coverageClass === "needs_human_decision").length, 240);
});

test("C3 requirementHash: the long-stay definition is hashed apart, and changing the admissible types changes the hash", () => {
  withLongStayRuleRequired(() => {
    const orders = run(registryWith()).workOrders.filter((o) => o.requirementId === "long_stay_rule");
    assert.equal(orders.length, 1);
    const hashOf = (table: typeof TOPIC_REQUIREMENTS) => buildCollectionPlan({ orders, asOf: AS_OF, requirements: table }).sheets[0]!.requirementHash;
    const base = hashOf(TOPIC_REQUIREMENTS);
    assert.match(base, /^[0-9a-f]{64}$/);
    assert.equal(hashOf(TOPIC_REQUIREMENTS), base, "stable for identical content");
    const original = TOPIC_REQUIREMENTS["long-stay-guide"];
    const widened = { ...TOPIC_REQUIREMENTS, "long-stay-guide": { ...original, required: original.required.map((r) => (r.kind === "regulatory" ? { ...r, ruleType: "any" as const } : r)) } };
    assert.notEqual(hashOf(widened), base, "widening the types changes the hash");
    const sheet = buildCollectionPlan({ orders, asOf: AS_OF }).sheets[0]!;
    assert.equal(sheet.requirementsVersion, "seo-v3-topic-requirements/draft-3");
    assert.deepEqual((sheet.recordTemplate.value as Record<string, unknown>).acceptedRuleTypes, ["minimum_stay", "night_cap"]);
  });
});

// --- S5.3-C4: voluntary collection of an optional requirement, local editorial decision ---------------------------

const PILOT_CITIES = [
  { slug: "paris", country: "France" },
  { slug: "barcelona", country: "Spain" },
  { slug: "amsterdam", country: "Netherlands" },
];
const ASK = (...slugs: string[]) => slugs.map((citySlug) => ({ citySlug, topic: "long-stay-guide" as const, requirementId: "long_stay_rule" }));
const realRun = (extra: Partial<ClassifyInput> = {}) =>
  classifyCoverage({ cities, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, ...extra });
const ruleOrders = (report: CoverageReport) => report.workOrders.filter((o) => o.requirementId === "long_stay_rule");

test("C4 voluntary request: three exact pilot cities give three voluntary long_stay_rule orders, the topic definition is unchanged", () => {
  const before = JSON.stringify(TOPIC_REQUIREMENTS["long-stay-guide"]);
  const report = classifyCoverage({ cities: PILOT_CITIES, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, voluntaryCollection: ASK("paris", "barcelona", "amsterdam") });
  const orders = ruleOrders(report);
  assert.equal(orders.length, 3);
  for (const order of orders) {
    assert.equal(order.origin, "voluntary");
    assert.equal(order.kind, "fact");
    assert.equal(order.reason, "absent");
    assert.equal(order.scope.level, "city");
    assert.deepEqual(order.acceptedSourceTypes, ["official_authority"]);
    assert.equal(order.coversPages.length, 1);
    assert.equal(order.coversPages[0]!.topic, "long-stay-guide");
    assert.equal((order.scope as { citySlug: string }).citySlug, order.coversPages[0]!.citySlug);
  }
  assert.deepEqual(orders.map((o) => (o.scope as { countryCode: string }).countryCode).sort(), ["ES", "FR", "NL"]);
  assert.equal(report.voluntaryCollection.requested, 3);
  assert.equal(report.voluntaryCollection.ordered.length, 3);
  assert.deepEqual(report.voluntaryCollection.ignored, []);
  assert.equal(JSON.stringify(TOPIC_REQUIREMENTS["long-stay-guide"]), before, "the topic definition is untouched");
  assert.deepEqual(TOPIC_REQUIREMENTS["long-stay-guide"].required, []);
  // the absence of the optional fact never blocks the page
  for (const entry of report.entries.filter((e) => e.topic === "long-stay-guide")) {
    assert.ok(!entry.blockers.includes("facts_absent"));
    assert.equal(entry.publicationAuthorised, false);
    assert.equal(entry.indexingAuthorised, false);
    assert.notEqual(entry.coverageClass, "candidate_for_editorial_review");
  }
});

test("C4 no request, no order: the 240 real cities stay at 1,680 required orders and none is voluntary", () => {
  const none = realRun();
  assert.equal(none.workOrders.length, 1680);
  assert.ok(none.workOrders.every((o) => o.origin === "required"));
  assert.deepEqual(none.voluntaryCollection, { requested: 0, ordered: [], ignored: [] });
  assert.equal(ruleOrders(none).length, 0);
  assert.deepEqual(realRun({ voluntaryCollection: [] }).workOrders, none.workOrders);
});

test("C4 no large-scale collection: three requests over 240 cities add exactly three orders", () => {
  const report = realRun({ voluntaryCollection: ASK("paris", "barcelona", "amsterdam") });
  assert.equal(report.workOrders.length, 1683);
  assert.equal(report.workOrders.filter((o) => o.origin === "voluntary").length, 3);
  assert.equal(report.workOrders.filter((o) => o.origin === "required").length, 1680);
  assert.equal(report.summary.needs_data, 3360, "classes do not move");
  assert.equal(report.summary.needs_human_decision, 2640);
});

test("C4 refusals: a required requirement, an unknown city or topic, a malformed request and a duplicate never widen the collection", () => {
  const report = classifyCoverage({
    cities: PILOT_CITIES, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null,
    voluntaryCollection: [
      ...ASK("paris"), ...ASK("paris"),
      { citySlug: "paris", topic: "pricing-guide", requirementId: "nightly_price_distribution" }, // required there: never "voluntary"
      { citySlug: "atlantis", topic: "long-stay-guide", requirementId: "long_stay_rule" },
      { citySlug: "paris", topic: "long-stay-guide", requirementId: "no_such_requirement" },
      { citySlug: "paris", topic: "not-a-topic", requirementId: "long_stay_rule" },
      null, 3,
    ] as never,
  });
  assert.equal(ruleOrders(report).length, 1);
  assert.equal(report.workOrders.filter((o) => o.origin === "voluntary").length, 1);
  const reasons = report.voluntaryCollection.ignored.map((i) => i.reason).sort();
  assert.deepEqual(reasons, ["city_not_in_run", "request_malformed", "request_malformed", "request_malformed", "requirement_not_optional_for_topic", "requirement_not_optional_for_topic"]);
  // the price order of paris stays a required order
  assert.ok(report.workOrders.filter((o) => o.requirementId === "nightly_price_distribution").every((o) => o.origin === "required"));
});

test("C4 tax and permit rules never satisfy the voluntary request, minimum_stay without a zone asks for the zone only", () => {
  for (const type of ["tax", "permit", "registration_required", "other"] as const) {
    const report = classifyCoverage({ cities: [{ slug: CITY, country: "Fixtureland" }], registry: registryWith(timezoneFact(), ruleOfType(type)), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, countryIsoTable: FIXTURE_ISO, voluntaryCollection: ASK(CITY) });
    assert.equal(ruleOrders(report).length, 1, type);
  }
  const covered = classifyCoverage({ cities: [{ slug: CITY, country: "Fixtureland" }], registry: registryWith(timezoneFact(), ruleOfType("minimum_stay")), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, countryIsoTable: FIXTURE_ISO, voluntaryCollection: ASK(CITY) });
  assert.equal(ruleOrders(covered).length, 0);
  assert.deepEqual(covered.voluntaryCollection.ignored.map((i) => i.reason), ["already_covered"]);
  const noZone = classifyCoverage({ cities: [{ slug: CITY, country: "Fixtureland" }], registry: registryWith(ruleOfType("minimum_stay")), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, countryIsoTable: FIXTURE_ISO, voluntaryCollection: ASK(CITY) });
  const zone = noZone.workOrders.filter((o) => o.kind === "timezone");
  assert.equal(zone.length, 1);
  assert.equal(zone[0]!.origin, "voluntary");
  assert.ok(!entryOf(noZone, "long-stay-guide").blockers.includes("timezone_unvalidated"), "an optional fact never blocks the page");
});

test("C4 determinism and deduplication: request order does not matter and a shared order lists every page once", () => {
  const forward = classifyCoverage({ cities: PILOT_CITIES, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, voluntaryCollection: ASK("paris", "barcelona", "amsterdam") });
  const backward = classifyCoverage({ cities: [...PILOT_CITIES].reverse(), registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, voluntaryCollection: ASK("amsterdam", "barcelona", "paris") });
  assert.equal(serializeCoverageReport(forward), serializeCoverageReport(backward));
  const duplicated = classifyCoverage({ cities: PILOT_CITIES, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, voluntaryCollection: [...ASK("paris", "barcelona", "amsterdam"), ...ASK("paris")] });
  assert.deepEqual(duplicated.workOrders, forward.workOrders, "a repeated request adds nothing");
  assert.equal(duplicated.voluntaryCollection.requested, 4);
});

test("C4 sheets: the three pilot cities get three long_stay_rule sheets without any change to the topic definition", () => {
  const report = classifyCoverage({ cities: PILOT_CITIES, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null, voluntaryCollection: ASK("paris", "barcelona", "amsterdam") });
  const plan = buildCollectionPlan({ orders: ruleOrders(report), asOf: AS_OF });
  assert.equal(plan.sheets.length, 3);
  for (const sheet of plan.sheets) {
    assert.equal(sheet.origin, "voluntary");
    assert.equal(sheet.requirementId, "long_stay_rule");
    assert.equal(sheet.status, "ready_to_collect");
    assert.deepEqual((sheet.recordTemplate.value as Record<string, unknown>).acceptedRuleTypes, ["minimum_stay", "night_cap"]);
  }
  assert.equal(new Set(plan.sheets.map((s) => s.sheetId)).size, 3);
  const required = buildCollectionPlan({ orders: realRun().workOrders, asOf: AS_OF });
  assert.ok(required.sheets.every((s) => s.origin === "required"));
});

test("C4 local vs universal: long-stay-guide keeps a human decision without any universal hub proposal; universal topics are unchanged", () => {
  const report = realRun();
  const local = report.entries.filter((e) => e.topic === "long-stay-guide");
  assert.equal(local.length, 240);
  for (const entry of local) {
    assert.equal(entry.coverageClass, "needs_human_decision");
    assert.ok(entry.blockers.includes("local_editorial_decision"));
    assert.ok(!entry.blockers.includes("topic_requires_editorial_decision"));
    assert.ok(!entry.blockers.includes("hub_proposal"));
    assert.ok(!entry.actions.some((a) => a.kind === "propose_hub_section_only"));
    assert.ok(entry.actions.some((a) => a.kind === "decide" && a.decisionId === "local_topic_editorial_review"));
  }
  const universalTopics = LOCAL_SEO_TOPIC_SLUGS.filter((t) => TOPIC_REQUIREMENTS[t].family === "universal");
  assert.equal(universalTopics.length, 10);
  for (const entry of report.entries.filter((e) => universalTopics.includes(e.topic))) {
    assert.ok(entry.blockers.includes("topic_requires_editorial_decision"));
    assert.ok(entry.blockers.includes("hub_proposal"));
    assert.ok(!entry.blockers.includes("local_editorial_decision"));
    assert.ok(entry.actions.some((a) => a.kind === "propose_hub_section_only"));
  }
  const decision = (id: string) => report.decisionsRequired.find((d) => d.id === id)?.blocksPages;
  assert.equal(decision("local_topic_editorial_review"), 240);
  assert.equal(decision("universal_topic_hub_policy"), 2400, "back to the 2,400 universal pages");
  assert.equal(report.summary.needs_human_decision, 2640);
  assert.ok(report.entries.every((e) => e.publicationAuthorised === false && e.indexingAuthorised === false));
});

// --- S5.4-G: pricing-guide gains an optional neighbourhood_context requirement -------------------------------------

test("G1 table: only the pricing-guide definition changed, by one optional requirement", () => {
  const spec = TOPIC_REQUIREMENTS["pricing-guide"];
  assert.equal(TOPIC_REQUIREMENTS_VERSION, "seo-v3-topic-requirements/draft-3");
  assert.deepEqual(spec.required.map((r) => r.requirementId), ["nightly_price_distribution"]);
  assert.deepEqual(spec.optional.map((r) => r.requirementId), ["demand_driver", "neighbourhood_context"]);
  assert.equal(spec.optional[1]!.thresholdBasis, "provisional_pending_human_decision", "the provisional threshold is not approved");
  assert.equal(spec.optional[1]!.requiresHumanValidation, true);
  // the 24 other definitions are byte-for-byte those of the previous commit (hash recorded when the change was made)
  const others = Object.fromEntries(Object.entries(TOPIC_REQUIREMENTS).filter(([topic]) => topic !== "pricing-guide"));
  assert.equal(Object.keys(others).length, 24);
  assert.equal(sha256Hex(stableStringify(others)), "fc3130b006fe8f84c5f418037511d6e85f280e02009434fa1a1d87cc86cb5e70");
});

test("G2 classifier: the optional fact adds no order, no blocker and does not change a price-only page", () => {
  const priceOnly = run(registryWith(priceFact()), { topics: ["pricing-guide"] });
  const entry = entryOf(priceOnly, "pricing-guide");
  assert.equal(entry.coverageClass, "candidate_for_editorial_review");
  assert.deepEqual(entry.blockers, []);
  assert.ok(!priceOnly.workOrders.some((o) => o.requirementId === "neighbourhood_context"));
  const empty = run(registryWith(), { topics: ["pricing-guide"] });
  assert.ok(!empty.workOrders.some((o) => o.requirementId === "neighbourhood_context"), "an absent optional fact raises no order");
  assert.equal(entryOf(empty, "pricing-guide").coverageClass, "needs_data");
  assert.deepEqual(entryOf(empty, "pricing-guide").blockers, ["facts_absent"]);
  // with the voluntary request the note can be asked for explicitly, and it is marked voluntary
  const asked = run(registryWith(), { topics: ["pricing-guide"], voluntaryCollection: [{ citySlug: CITY, topic: "pricing-guide", requirementId: "neighbourhood_context" }] });
  const order = asked.workOrders.find((o) => o.requirementId === "neighbourhood_context")!;
  assert.equal(order.origin, "voluntary");
  assert.deepEqual(order.acceptedSourceTypes, ["editorial_note", "official_tourism_body", "published_research"]);
  assert.equal(entryOf(asked, "pricing-guide").coverageClass, "needs_data", "asking for the optional fact does not change the class");
});

// --- S5.4-I: order ids follow the requirement definition, not the global version -----------------------------------

const REAL_RUN = () => classifyCoverage({ cities, registry: createFactRegistry(), asOf: AS_OF, thresholdProfile: "draft-provisional", propertyType: null });
const idOfKey = (o: { scope: unknown; platform: unknown; propertyType: unknown; requirementId: string; kind: string; requirementHash: string }) =>
  sha256Hex(stableStringify({ scope: o.scope, platform: o.platform, propertyType: o.propertyType, requirementId: o.requirementId, kind: o.kind, requirementHash: o.requirementHash }));
/** TEST SUPPORT: replaces the definition of one requirement in the given topics for the duration of `fn` (restored afterwards). */
function withChangedRequirement<T>(topics: LocalSeoTopicSlug[], requirementId: string, patch: Record<string, unknown>, fn: () => T): T {
  const table = TOPIC_REQUIREMENTS as Record<string, TopicRequirements>;
  const originals = new Map<string, TopicRequirements>();
  return runExclusive("withChangedRequirement", fn, () => { for (const [t, o] of originals) table[t] = o; }, () => {
    for (const t of topics) {
      const current = table[t]!;
      originals.set(t, current);
      const swap = (r: FactRequirement) => (r.requirementId === requirementId ? ({ ...r, ...patch } as FactRequirement) : r);
      table[t] = { ...current, required: current.required.map(swap), optional: current.optional.map(swap) };
    }
  });
}

test("S5.4-I id: the key is scope, platform, property type, requirement id, kind and the definition hash; no version", () => {
  const report = REAL_RUN();
  assert.equal(report.workOrders.length, 1680);
  for (const order of report.workOrders) {
    assert.equal(order.id, idOfKey(order), "the id is exactly the hash of that version-free key");
    assert.match(order.requirementHash, /^[0-9a-f]{64}$/);
  }
  assert.equal(new Set(report.workOrders.map((o) => o.id)).size, 1680, "no collision");
  // the order's definition hash is the one the sheet will carry
  const plan = buildCollectionPlan({ orders: report.workOrders.slice(0, 40), asOf: AS_OF });
  for (const sheet of plan.sheets) assert.equal(sheet.requirementHash, report.workOrders.find((o) => o.id === sheet.workOrderId)!.requirementHash);
});

test("S5.4-I id: the legacy scheme (global version in the key) gives different ids for all 1,680 orders, so old dossiers are recognisable", () => {
  const report = REAL_RUN();
  const legacy = (o: (typeof report.workOrders)[number], version: string) => sha256Hex(stableStringify({ scope: o.scope, platform: o.platform, propertyType: o.propertyType, requirementId: o.requirementId, kind: o.kind, requirementsVersion: version }));
  for (const version of ["seo-v3-topic-requirements/draft-2", "seo-v3-topic-requirements/draft-3"]) assert.equal(report.workOrders.filter((o) => legacy(o, version) === o.id).length, 0, version);
  assert.equal(report.workOrders[0]!.requirementsVersion, TOPIC_REQUIREMENTS_VERSION, "the version is kept as information only");
});

test("S5.4-I stability: changing one topic's unrelated requirement renames none of the other orders", () => {
  const before = REAL_RUN();
  const after = withChangedRequirement(["amenities-guide"], "guest_expectation", { maxAgeDays: 123 }, REAL_RUN);
  const ids = new Set(before.workOrders.map((o) => o.id));
  const fresh = after.workOrders.filter((o) => !ids.has(o.id));
  // amenities-guide is the only topic changed: its required guest_expectation order now differs from the shared definition used by family-travel-guide
  assert.ok(fresh.every((o) => o.requirementId === "guest_expectation"), "only orders of the changed requirement are new");
  assert.equal(fresh.length, 240);
  assert.equal(after.workOrders.filter((o) => ids.has(o.id)).length, after.workOrders.length - 240, "every other order keeps its id");
  assert.equal(after.workOrders.length, 1680 + 240, "two different definitions of one requirement are two orders, not one merged order");
});

test("S5.4-I stability: changing a requirement everywhere renames exactly its orders and no other", () => {
  const before = REAL_RUN();
  const priceTopics = (Object.keys(TOPIC_REQUIREMENTS) as LocalSeoTopicSlug[]).filter((t) => TOPIC_REQUIREMENTS[t].required.some((r) => r.requirementId === "nightly_price_distribution"));
  assert.ok(priceTopics.length >= 4);
  const after = withChangedRequirement(priceTopics, "nightly_price_distribution", { maxAgeDays: 45 }, REAL_RUN);
  const beforeIds = new Set(before.workOrders.map((o) => o.id));
  const renamed = before.workOrders.filter((o) => !after.workOrders.some((x) => x.id === o.id));
  assert.equal(renamed.length, 240);
  assert.ok(renamed.every((o) => o.requirementId === "nightly_price_distribution"));
  assert.equal(after.workOrders.length, before.workOrders.length);
  assert.equal(after.workOrders.filter((o) => beforeIds.has(o.id)).length, 1680 - 240);
  assert.ok(after.workOrders.filter((o) => o.requirementId === "nightly_price_distribution").every((o) => !beforeIds.has(o.id)));
});

test("S5.4-I distinctness: other cities, other topics and other requirements never share an id; the timezone definition matches the sheets'", () => {
  const report = REAL_RUN();
  const paris = report.workOrders.filter((o) => (o.scope as { citySlug: string }).citySlug === "paris");
  const barcelona = report.workOrders.filter((o) => (o.scope as { citySlug: string }).citySlug === "barcelona");
  assert.equal(paris.length, 7);
  assert.equal(new Set(paris.map((o) => o.id)).size, 7, "seven distinct requirements, seven ids");
  assert.ok(paris.every((p) => !barcelona.some((b) => b.id === p.id)));
  // the same requirement asked by two topics is one order per city
  const priceOrders = paris.filter((o) => o.requirementId === "nightly_price_distribution");
  assert.equal(priceOrders.length, 1);
  assert.ok(priceOrders[0]!.coversPages.length >= 4);
  // the classifier's timezone definition is the sheets' one (a drift would silently split ids from sheet hashes)
  const withZone = withLongStayRuleRequired(() => run(registryWith(ruleFact()), { topics: ["long-stay-guide"] }));
  const zone = withZone.workOrders.find((o) => o.kind === "timezone")!;
  assert.equal(zone.requirementHash, sha256Hex(stableStringify(TIMEZONE_REQUIREMENT)));
  assert.equal(buildCollectionPlan({ orders: [zone], asOf: AS_OF }).sheets[0]!.requirementHash, zone.requirementHash);
});
