import assert from "node:assert/strict";
import test from "node:test";
import { withLongStayRuleRequired } from "./seo-v3-longstay-required";

import { localSeoTopics } from "../data/localSeo";
import { parseIsoDate, parseIsoDateTime } from "../lib/seo/v3/dates";
import { checkTopicCatalog, createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import type { FactSource } from "../lib/seo/v3/factSource";
import { AUDIT_MIN_SAMPLE_PROVISIONAL, AUDIT_PUBLIC_USE_LOCK, auditPublicUseReadiness } from "../lib/seo/v3/factUse";
import { snapshotUntrustedFact, validateLocalFact } from "../lib/seo/v3/factValidation";
import type { FactId, FactPlatform, FactPropertyType, GeographicScope, LocalFact } from "../lib/seo/v3/localFact";
import { evaluateTopicFacts, type TopicFactsReport } from "../lib/seo/v3/topicFactEvaluation";
import { LOCAL_SEO_TOPIC_SLUGS } from "../lib/seo/v3/topics";

/**
 * S2 / S2.2 tests: V3 fact registry, runtime validation and fail-closed use rules.
 *
 * Every value below is a FIXTURE. "fixture-city" does not exist, country code "ZZ" is a reserved
 * user-assigned code, publishers and references say so, and the numbers (111.11, 0.42, …) are
 * deliberately artificial. None of it is, or may become, public data.
 *
 *   npx tsx scripts/seo-v3-fact-registry.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const CITY = "fixture-city";
const TARGET: GeographicScope = { level: "city", countryCode: "ZZ", citySlug: CITY };
const UUID = "123e4567-e89b-12d3-a456-426614174000";

// --- Fixtures -----------------------------------------------------------------------------------

function evidence(): FactSource["evidence"] {
  return [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }];
}

function licensedSource(): FactSource {
  return {
    sourceId: "fixture-source-licensed",
    sourceType: "licensed_dataset",
    publisher: "Fixture Publisher (test only)",
    title: null,
    locator: { kind: "document_citation", citation: "FIXTURE - not a real publication" },
    publishedAt: "2026-08-15",
    consultedAt: "2026-09-01T09:00:00Z",
    collectionMethod: { kind: "dataset_download", description: "fixture" },
    termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms-reference" },
    publicationRestrictions: [],
    evidence: evidence(),
  };
}

function auditSource(): FactSource {
  return {
    sourceId: "fixture-source-audit",
    sourceType: "user_audit_aggregate",
    publisher: "Fixture Publisher (test only)",
    title: null,
    locator: { kind: "internal_reference", reference: "fixture-artifact-key" },
    publishedAt: null,
    consultedAt: "2026-09-01T09:00:00Z",
    collectionMethod: { kind: "internal_aggregation", description: "fixture" },
    termsOfUse: { status: "unverified", summary: null, reference: null },
    publicationRestrictions: [],
    evidence: [{ kind: "internal_record", reference: "fixture-record" }],
  };
}

/** An audit source that satisfies every readiness check; only the lock still stands in the way. */
function readyAuditSource(): FactSource {
  return {
    ...auditSource(),
    termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-consent-clause" },
    publicationRestrictions: ["aggregate_only"],
  };
}

function editorialSource(): FactSource {
  return {
    sourceId: "fixture-source-editorial",
    sourceType: "editorial_note",
    publisher: "Fixture Publisher (test only)",
    title: null,
    locator: { kind: "internal_reference", reference: "fixture-editorial-note" },
    publishedAt: null,
    consultedAt: "2026-09-01T09:00:00Z",
    collectionMethod: { kind: "editorial_judgement", description: "fixture" },
    termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-editorial-policy" },
    publicationRestrictions: [],
    evidence: [{ kind: "internal_record", reference: "fixture-record" }],
  };
}

const MEASURED = ["show_sample_size", "show_observation_period", "show_confidence"] as const;
const approvedFor = (topics: string[], approvedAt = "2026-09-03T10:00:00Z") => ({
  use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt, scope: topics } },
});

function priceFact(overrides: Record<string, unknown> = {}): LocalFact {
  return {
    factId: "fact:fixture:fixture-city:price:2026q3:v1",
    kind: "quantitative",
    scope: { ...TARGET },
    platform: null,
    propertyType: null,
    unit: null,
    source: licensedSource(),
    collectedAt: "2026-09-01T10:00:00Z",
    observedPeriod: { start: "2026-06-01", end: "2026-08-31" },
    validUntil: "2026-12-01T00:00:00Z",
    confidence: { level: "high", rationale: "FIXTURE" },
    validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-02T10:00:00Z", note: null },
    usage: { ...approvedFor(["pricing-guide", "competitor-analysis"]), displayConstraints: [...MEASURED] },
    relevantTopics: ["pricing-guide", "competitor-analysis"],
    version: 1,
    supersedes: null,
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, p25: 90, p75: 130, sampleSize: 25 },
    ...overrides,
  } as LocalFact;
}

function priceValue(median: number, extra: Record<string, unknown> = {}) {
  return { metric: "nightly_price_distribution", currency: "EUR", median, sampleSize: 25, ...extra };
}

function unavailabilityFact(overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:unavailability:2026q3:v1",
    relevantTopics: ["occupancy-guide", "revenue-optimization"],
    usage: { ...approvedFor(["occupancy-guide"]), displayConstraints: [...MEASURED, "label_as_unavailability_not_occupancy"] },
    value: { metric: "calendar_unavailability_rate", ratio: 0.42, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize: 25 },
    ...overrides,
  });
}

function editorialFact(overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:visual:2026:v1",
    kind: "qualitative",
    source: editorialSource(),
    observedPeriod: null,
    relevantTopics: ["first-photo", "photo-tips"],
    usage: { ...approvedFor(["first-photo"]), displayConstraints: ["label_as_editorial_note"] },
    value: { category: "visual_character", statement: "FIXTURE sentence without any figure.", language: "en", basis: "editorial_observation" },
    ...overrides,
  });
}

function regulatoryFact(value: Record<string, unknown>, overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:rule:v1",
    kind: "regulatory",
    source: { ...licensedSource(), sourceType: "official_authority" },
    observedPeriod: null,
    relevantTopics: ["long-stay-guide"],
    usage: { ...approvedFor(["long-stay-guide"]), displayConstraints: [] },
    value: { ruleType: "minimum_stay", rule: "FIXTURE rule", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE reference", ...value },
    ...overrides,
  });
}

// --- Helpers ------------------------------------------------------------------------------------

function ok(registry: FactRegistry, fact: LocalFact): void {
  const result = registry.register(fact);
  assert.equal(result.ok, true, JSON.stringify(result));
}
/** Sorted, de-duplicated refusal codes; fails if the fact was accepted. */
function refusedCodes(registry: FactRegistry, fact: unknown): string[] {
  const result = registry.register(fact as LocalFact);
  assert.equal(result.ok, false, "the fact should have been refused");
  return result.ok ? [] : [...new Set(result.issues.map((issue) => issue.code))].sort();
}
function refusedText(registry: FactRegistry, fact: unknown): string {
  const result = registry.register(fact as LocalFact);
  assert.equal(result.ok, false, "the fact should have been refused");
  return result.ok ? "" : result.issues.map((issue) => `${issue.code}:${issue.path}:${issue.message}`).join(" | ");
}
function evaluate(
  registry: FactRegistry,
  topic: string,
  use: "internal" | "public",
  asOf = AS_OF,
  overrides: { target?: GeographicScope; platform?: FactPlatform; propertyType?: FactPropertyType } = {},
): TopicFactsReport {
  return evaluateTopicFacts(registry, { target: TARGET, platform: null, propertyType: null, topic, asOf, use, ...overrides });
}
const assessPublic = (registry: FactRegistry, id: FactId, topic: string | null = "pricing-guide", asOf = AS_OF) =>
  registry.assess(id, { asOf, use: "public", topic: topic as never })!;
const issueCodes = (assessment: { issues: readonly { code: string }[] }) => assessment.issues.map((issue) => issue.code).sort();

// --- Baseline behaviour (S2), strengthened -------------------------------------------------------

test("valid approved fact is registered, usable and sufficient; the stored copy is frozen and not aliased", () => {
  const registry = createFactRegistry();
  const fact = priceFact();
  ok(registry, fact);
  const stored = registry.get(fact.factId)!;
  assert.deepEqual(stored, fact);
  assert.notEqual(stored, fact, "the registry must not alias the caller's object");
  assert.notEqual(stored.source, fact.source);
  assert.ok(Object.isFrozen(stored) && Object.isFrozen(stored.source) && Object.isFrozen(stored.value) && Object.isFrozen(stored.usage.use));
  assert.deepEqual(issueCodes(registry.assess(fact.factId, { asOf: AS_OF, use: "internal", topic: "pricing-guide" })!), []);
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId)), []);
  const report = evaluate(registry, "pricing-guide", "public");
  assert.equal(report.overall, "all_required_met");
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.reasons, []);
  assert.equal(report.requirements[0]!.chosenFactId, fact.factId);
});

test("fact without proof is refused, for the right reason, and leaves no trace", () => {
  const registry = createFactRegistry();
  assert.deepEqual(refusedCodes(registry, priceFact({ source: { ...licensedSource(), evidence: [] } })), ["evidence_missing"]);
  assert.deepEqual(
    refusedCodes(registry, priceFact({ source: { ...licensedSource(), evidence: [{ kind: "content_hash", algorithm: "sha256", value: "xyz" }] } })),
    ["evidence_invalid"],
  );
  assert.deepEqual(
    refusedCodes(registry, priceFact({ source: { ...licensedSource(), locator: { kind: "url", url: "https://example.invalid/fixture" }, evidence: [] } })),
    ["evidence_missing"],
    "a URL alone is not evidence",
  );
  assert.equal(registry.size(), 0);
});

test("impossible and ambiguous dates are refused", () => {
  const registry = createFactRegistry();
  assert.deepEqual(refusedCodes(registry, priceFact({ collectedAt: "2026-02-30T10:00:00Z" })), ["invalid_date"]);
  assert.deepEqual(refusedCodes(registry, priceFact({ collectedAt: "2026-09-01T10:00:00" })), ["invalid_date"], "no time zone");
  assert.deepEqual(refusedCodes(registry, priceFact({ observedPeriod: { start: "2026-06-01", end: "2026-13-01" } })), ["invalid_date"]);
  assert.deepEqual(refusedCodes(registry, priceFact({ validUntil: "2026-08-01T00:00:00Z" })), ["chronology"]);
  assert.deepEqual(refusedCodes(registry, priceFact({ observedPeriod: { start: "2026-06-01", end: "2026-09-15" } })), ["chronology"]);
  assert.deepEqual(refusedCodes(registry, priceFact({ observedPeriod: { start: "2026-08-31", end: "2026-06-01" } })), ["invalid_period"]);
  assert.equal(parseIsoDate("2026-02-29"), null);
  assert.notEqual(parseIsoDate("2024-02-29"), null);
  assert.equal(parseIsoDateTime("2026-09-01T24:00:00Z"), null);
  assert.equal(parseIsoDateTime("2026-09-01T10:00:00+25:00"), null);
  assert.equal(parseIsoDateTime("2026-09-01T12:00:00+02:00"), parseIsoDateTime("2026-09-01T10:00:00Z"));
  assert.equal(registry.size(), 0);
});

test("expired fact is refused for use, and not-yet-collected too", () => {
  const registry = createFactRegistry();
  const fact = priceFact();
  ok(registry, fact);
  const expired = registry.assess(fact.factId, { asOf: "2026-12-01T00:00:00Z", use: "internal", topic: "pricing-guide" })!;
  assert.deepEqual(issueCodes(expired), ["expired"]);
  const early = registry.assess(fact.factId, { asOf: "2026-08-01T00:00:00Z", use: "internal", topic: "pricing-guide" })!;
  assert.deepEqual(issueCodes(early), ["not_yet_collected", "validation_in_future"].sort());
  const report = evaluate(registry, "pricing-guide", "public", "2026-12-02T00:00:00Z");
  assert.equal(report.overall, "blocked");
  assert.equal(report.missing[0]!.reason, "expired");
  assert.deepEqual(issueCodes(registry.assess(fact.factId, { asOf: "not a date", use: "internal", topic: null })!), ["invalid_as_of"]);
});

test("duplicate identifiers and duplicate content are refused", () => {
  const registry = createFactRegistry();
  ok(registry, priceFact());
  assert.match(refusedText(registry, priceFact()), /duplicate_fact_id/);
  assert.match(refusedText(registry, priceFact({ factId: "fact:fixture:fixture-city:price:copy" })), /duplicate_content/);
  assert.match(
    refusedText(registry, priceFact({ factId: "fact:fixture:fixture-city:price:conflict", value: priceValue(150) })),
    /conflicting_values/,
  );
  assert.equal(registry.size(), 1);
});

test("invalid numeric values and units are refused, each for its own reason", () => {
  const registry = createFactRegistry();
  const price = (value: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    priceFact({ value: priceValue(100, value), ...extra });
  const unavailability = (value: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    unavailabilityFact({
      value: { metric: "calendar_unavailability_rate", ratio: 0.4, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize: 25, ...value },
      ...extra,
    });
  const cases: [string, unknown, string[]][] = [
    ["NaN median", price({ median: Number.NaN }), ["invalid_value"]],
    ["negative median", price({ median: -5 }), ["invalid_value"]],
    ["Infinity percentile", price({ p90: Number.POSITIVE_INFINITY }), ["invalid_value"]],
    ["decreasing percentiles", price({ p25: 120 }), ["invalid_value"]],
    ["zero sample", price({ sampleSize: 0 }), ["invalid_value"]],
    ["fractional sample", price({ sampleSize: 2.5 }), ["invalid_value"]],
    ["bad currency", price({ currency: "euro" }), ["invalid_value"]],
    ["unit differs from currency", price({}, { unit: "USD" }), ["invalid_unit"]],
    ["ratio above 1", unavailability({ ratio: 1.5 }), ["invalid_value"]],
    ["ratio with a unit", unavailability({}, { unit: "%" }), ["invalid_unit"]],
    ["wrong semantics", unavailability({ semantics: "occupancy" }), ["invalid_value"]],
    ["occupancy metric", unavailabilityFact({ value: { metric: "occupancy_rate", ratio: 0.4 } }), ["invalid_value"]],
    ["statistic without unit", priceFact({ value: { metric: "official_statistic", name: "FIXTURE", value: 3 } }), ["invalid_unit"]],
    ["measured figure without period", priceFact({ observedPeriod: null }), ["invalid_period"]],
  ];
  for (const [label, fact, expected] of cases) {
    assert.deepEqual(refusedCodes(registry, fact), expected, label);
  }
  assert.deepEqual(
    refusedCodes(registry, unavailabilityFact({ usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] } })),
    ["display_constraint_missing"],
  );
  assert.equal(registry.size(), 0);
});

test("source not allowed: refused at registration or by the requirement", () => {
  const registry = createFactRegistry();
  const rule = { ruleType: "minimum_stay", rule: "FIXTURE", effectiveFrom: null, effectiveUntil: null, officialReference: "FIXTURE" };
  assert.deepEqual(
    refusedCodes(registry, regulatoryFact(rule, { source: { ...licensedSource(), sourceType: "public_web_page" } })),
    ["source_incoherent"],
  );
  assert.deepEqual(
    refusedCodes(registry, priceFact({ source: editorialSource() })),
    ["display_constraint_missing", "source_incoherent"],
    "editorial note on a quantitative fact (also lacks the editorial label)",
  );
  ok(registry, priceFact({ source: { ...licensedSource(), sourceType: "public_web_page", collectionMethod: { kind: "manual_reading", description: "fixture" } } }));
  const report = evaluate(registry, "pricing-guide", "public");
  assert.equal(report.overall, "blocked");
  assert.equal(report.missing[0]!.reason, "source_type_not_accepted");
});

test("unknown topics are refused everywhere", () => {
  const registry = createFactRegistry();
  assert.deepEqual(
    refusedCodes(registry, priceFact({ relevantTopics: ["made-up-topic"] })),
    ["approval_inconsistent", "unknown_topic"],
    "the default approval then names topics that are not relevant",
  );
  assert.deepEqual(
    refusedCodes(registry, priceFact({ usage: { ...approvedFor(["made-up-topic"]), displayConstraints: [...MEASURED] } })),
    ["unknown_topic"],
  );
  assert.deepEqual(refusedCodes(registry, priceFact({ relevantTopics: [] })), ["approval_inconsistent", "empty_relevant_topics"]);
  const report = evaluate(registry, "made-up-topic", "public");
  assert.equal(report.overall, "invalid_request");
  assert.deepEqual(report.reasons, ["unknown_topic"]);
  assert.deepEqual(evaluate(registry, "pricing-guide", "public", "garbage").reasons, ["invalid_as_of"]);
});

test("provisional thresholds are never applied automatically", () => {
  const registry = createFactRegistry();
  const small = unavailabilityFact({ value: { metric: "calendar_unavailability_rate", ratio: 0.42, semantics: "calendar_unavailability_not_occupancy", observedNights: 40, sampleSize: 5 } });
  ok(registry, small);
  const report = evaluate(registry, "occupancy-guide", "public");
  assert.equal(report.overall, "needs_human_decision", "a provisional threshold must not decide");
  assert.deepEqual(report.reasons, ["provisional_threshold_not_confirmed:calendar_unavailability_rate"]);
  const requirement = report.requirements[0]!;
  assert.equal(requirement.status, "needs_human_decision");
  assert.equal(requirement.provisionalChecks.find((check) => check.check === "sample")?.wouldPass, false, "informational only");

  const aligned = createFactRegistry();
  ok(aligned, priceFact({ value: priceValue(100, { sampleSize: 10 }) }));
  const blocked = evaluate(aligned, "pricing-guide", "public");
  assert.equal(blocked.overall, "blocked");
  assert.equal(blocked.missing[0]!.reason, "sample_too_small");
});

test("open editorial decisions and universal topics require a human", () => {
  const registry = createFactRegistry();
  ok(registry, priceFact());
  const competitor = evaluate(registry, "competitor-analysis", "public");
  assert.equal(competitor.overall, "needs_human_decision");
  assert.deepEqual(competitor.reasons, ["open_editorial_decision"]);
  assert.ok(competitor.openDecision !== null);
  assert.deepEqual(evaluate(registry, "seo-guide", "public").reasons, ["topic_requires_human_editorial_decision"]);
  assert.equal(evaluate(registry, "listing-audit", "internal").overall, "needs_human_decision");
});

test("qualitative facts: no hidden figures, human validation, provisional threshold", () => {
  const registry = createFactRegistry();
  const withValue = (value: Record<string, unknown>) => editorialFact({ value: { category: "visual_character", statement: "FIXTURE", language: "en", basis: "editorial_observation", ...value } });
  assert.deepEqual(refusedCodes(registry, withValue({ statement: "About 40% of FIXTURE photos" })), ["figure_in_qualitative_text"]);
  assert.deepEqual(refusedCodes(registry, withValue({ basis: "cited_source" })), ["source_incoherent"]);
  const fact = editorialFact();
  ok(registry, fact);
  const report = evaluate(registry, "first-photo", "public");
  assert.equal(report.overall, "needs_human_decision");
  assert.equal(report.requirements[0]!.chosenFactId, fact.factId);
  assert.deepEqual(report.missing, []);
  // not yet validated: refused by the requirement, even for internal use
  const pending = createFactRegistry();
  ok(
    pending,
    editorialFact({ validation: { status: "pending_review", submittedAt: "2026-09-02T10:00:00Z" }, usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: ["label_as_editorial_note"] } }),
  );
  const internal = evaluate(pending, "first-photo", "internal");
  assert.equal(internal.overall, "blocked");
  assert.equal(internal.missing[0]!.reason, "not_validated");
});

test("topic catalogue matches the current topics exactly and fails closed otherwise", () => {
  const current = localSeoTopics.map((topic) => topic.slug);
  assert.equal(current.length, 25);
  assert.equal(checkTopicCatalog(current).ok, true);
  assert.doesNotThrow(() => createFactRegistry());
  const withoutOne = current.slice(1);
  assert.deepEqual(checkTopicCatalog(withoutOne).missingInV3.length, 0);
  assert.deepEqual(checkTopicCatalog(withoutOne).extraInV3, [current[0]]);
  assert.throws(() => createFactRegistry({ currentTopicSlugs: withoutOne }), /SEO_V3_TOPIC_CATALOG_MISMATCH/);
  assert.throws(() => createFactRegistry({ currentTopicSlugs: [...current, "new-topic"] }), /SEO_V3_TOPIC_CATALOG_MISMATCH/);
  assert.throws(() => createFactRegistry({ currentTopicSlugs: [...current, current[0]!] }), /SEO_V3_TOPIC_CATALOG_MISMATCH/);
  assert.equal(LOCAL_SEO_TOPIC_SLUGS.length, 25);
});

test("evaluation is reproducible and independent of registration order", () => {
  const a = createFactRegistry();
  const b = createFactRegistry();
  const facts = [priceFact(), unavailabilityFact(), editorialFact()];
  for (const fact of facts) ok(a, fact);
  for (const fact of [...facts].reverse()) ok(b, fact);
  assert.deepEqual(a.list().map((fact) => fact.factId), b.list().map((fact) => fact.factId));
  for (const topic of LOCAL_SEO_TOPIC_SLUGS) {
    const first = JSON.stringify(evaluate(a, topic, "public"));
    assert.equal(JSON.stringify(evaluate(a, topic, "public")), first);
    assert.equal(JSON.stringify(evaluate(b, topic, "public")), first);
  }
});

test("no side effects: no clock, network or randomness, inputs and stored facts immutable", () => {
  const realNow = Date.now;
  const RealDate = Date;
  const realFetch = globalThis.fetch;
  const realRandom = Math.random;
  const trap = (name: string) => () => {
    throw new Error(`forbidden side effect: ${name}`);
  };
  Date.now = trap("Date.now") as typeof Date.now;
  // `new Date()` without an argument reads the clock; `new Date(ms)` and Date.UTC are fine.
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) throw new Error("forbidden side effect: new Date()");
      return Reflect.construct(target, args, newTarget);
    },
  });
  globalThis.fetch = trap("fetch") as typeof fetch;
  Math.random = trap("Math.random") as typeof Math.random;
  try {
    const registry = createFactRegistry();
    const input = priceFact();
    const frozenInput = structuredClone(input);
    Object.freeze(frozenInput); // registering must not need to write to the caller's object
    ok(registry, frozenInput);
    const stored = registry.get(input.factId)!;
    assert.notEqual(stored, frozenInput, "the registry stores a copy");
    assert.ok(Object.isFrozen(stored) && Object.isFrozen(stored.source) && Object.isFrozen(stored.value));
    const attempt = (write: () => void) => {
      try {
        write();
      } catch {
        // strict mode throws a TypeError; sloppy mode ignores the write
      }
    };
    attempt(() => {
      (stored as { version: number }).version = 99;
    });
    attempt(() => {
      (stored.source as { publisher: string }).publisher = "tampered";
    });
    assert.equal(stored.version, 1);
    assert.equal(stored.source.publisher, "Fixture Publisher (test only)");
    evaluate(registry, "pricing-guide", "public");
    assert.equal(createFactRegistry().size(), 0, "registries share no state");
    assert.equal(registry.size(), 1);
  } finally {
    Date.now = realNow;
    globalThis.Date = RealDate;
    globalThis.fetch = realFetch;
    Math.random = realRandom;
  }
});

// --- Versions, supersession ---------------------------------------------------------------------

test("superseded fact is refused for use and the chain is traceable (distinct from revoked/rejected)", () => {
  const registry = createFactRegistry();
  const v1 = priceFact();
  const v2 = priceFact({
    factId: "fact:fixture:fixture-city:price:2026q3:v2",
    version: 2,
    supersedes: v1.factId,
    collectedAt: "2026-09-05T10:00:00Z",
    value: priceValue(112.22, { p25: 91, p75: 131, sampleSize: 26 }),
    validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-06T10:00:00Z", note: null },
    usage: { ...approvedFor(["pricing-guide"], "2026-09-07T10:00:00Z"), displayConstraints: [...MEASURED] },
  });
  ok(registry, v1);
  ok(registry, v2);
  assert.equal(registry.isSuperseded(v1.factId), true);
  assert.equal(registry.isSuperseded(v2.factId), false);
  assert.equal(registry.getSuccessor(v1.factId)?.factId, v2.factId);
  assert.deepEqual(registry.getVersionChain(v2.factId)?.map((fact) => fact.factId), [v1.factId, v2.factId]);
  assert.deepEqual(registry.getVersionChain(v1.factId)?.map((fact) => fact.factId), [v1.factId, v2.factId]);
  assert.deepEqual(issueCodes(assessPublic(registry, v1.factId)), ["superseded"]);
  assert.deepEqual(issueCodes(assessPublic(registry, v2.factId)), []);
  const report = evaluate(registry, "pricing-guide", "public");
  assert.equal(report.requirements[0]!.chosenFactId, v2.factId);
  assert.equal(report.requirements[0]!.conflictingFactIds.length, 0, "a superseded fact is not a contradiction");
  assert.equal(registry.getVersionChain("fact:fixture:unknown:0000" as FactId), null);
});

test("inconsistent versions and invented replacements are refused", () => {
  const registry = createFactRegistry();
  const v1 = priceFact();
  ok(registry, v1);
  const next = (overrides: Record<string, unknown>) =>
    priceFact({
      factId: "fact:fixture:fixture-city:price:next",
      collectedAt: "2026-09-05T10:00:00Z",
      validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-06T10:00:00Z", note: null },
      usage: { ...approvedFor(["pricing-guide"], "2026-09-07T10:00:00Z"), displayConstraints: [...MEASURED] },
      ...overrides,
    });
  assert.match(refusedText(registry, next({ version: 3, supersedes: v1.factId })), /version_not_consecutive/);
  assert.match(refusedText(registry, next({ version: 2, supersedes: "fact:fixture:never-registered" })), /supersedes_unknown_fact/);
  assert.deepEqual(refusedCodes(registry, next({ version: 2, supersedes: null })), ["invalid_supersedes"]);
  assert.deepEqual(refusedCodes(registry, next({ version: 1, supersedes: v1.factId })), ["invalid_supersedes"]);
  assert.deepEqual(refusedCodes(registry, next({ version: 2, supersedes: "fact:fixture:fixture-city:price:next" })), ["invalid_supersedes"]);
  assert.match(
    refusedText(registry, next({ version: 2, supersedes: v1.factId, value: { metric: "official_statistic", name: "FIXTURE", value: 1 }, unit: "persons" })),
    /supersedes_different_series/,
  );
  assert.match(
    refusedText(
      registry,
      next({
        version: 2,
        supersedes: v1.factId,
        collectedAt: "2026-08-20T10:00:00Z",
        source: { ...licensedSource(), consultedAt: "2026-08-19T00:00:00Z", publishedAt: "2026-08-01" },
        observedPeriod: { start: "2026-05-01", end: "2026-07-31" },
      }),
    ),
    /successor_older_than_predecessor/,
  );
  ok(registry, next({ version: 2, supersedes: v1.factId, value: priceValue(113) }));
  assert.match(
    refusedText(registry, next({ factId: "fact:fixture:fixture-city:price:fork", version: 2, supersedes: v1.factId, value: priceValue(114) })),
    /supersedes_already_replaced/,
  );
  assert.equal(registry.size(), 2);
});

// --- S2.2: D1 audit data ------------------------------------------------------------------------

test("D1: audit-derived facts stay unpublishable while the lock is closed, even when everything else is in order", () => {
  assert.equal(AUDIT_PUBLIC_USE_LOCK.unlocked, false);
  assert.ok(Object.isFrozen(AUDIT_PUBLIC_USE_LOCK));
  try {
    (AUDIT_PUBLIC_USE_LOCK as { unlocked: boolean }).unlocked = true;
  } catch {
    // strict mode throws
  }
  assert.equal(AUDIT_PUBLIC_USE_LOCK.unlocked, false, "the lock cannot be flipped at runtime");

  const registry = createFactRegistry();
  const ready = priceFact({ source: readyAuditSource(), usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED] } });
  ok(registry, ready);
  assert.deepEqual(auditPublicUseReadiness(ready), [], "every readiness check is satisfied");
  assert.deepEqual(issueCodes(assessPublic(registry, ready.factId)), ["audit_public_use_locked"], "the lock alone blocks it");
  const blocked = evaluate(registry, "pricing-guide", "public");
  assert.equal(blocked.overall, "blocked");
  assert.equal(blocked.requirements[0]!.primaryIssue, "audit_public_use_locked");
  assert.equal(blocked.missing[0]!.reason, "public_use_not_approved");
  // internal use is unaffected
  assert.equal(evaluate(registry, "pricing-guide", "internal").overall, "all_required_met");
});

test("D1: readiness checks are independent of the lock and are never assumed satisfied", () => {
  const readiness = (fact: LocalFact) => auditPublicUseReadiness(fact).map((entry) => entry.code).sort();
  assert.deepEqual(readiness(priceFact()), [], "not audit-derived: nothing to report");
  assert.deepEqual(
    readiness(priceFact({ source: auditSource(), value: priceValue(100, { sampleSize: 1 }) })),
    ["audit_aggregation_not_attested", "audit_consent_reference_missing", "audit_sample_below_floor", "audit_terms_not_verified"],
  );
  assert.deepEqual(
    readiness(priceFact({ source: { ...readyAuditSource(), publicationRestrictions: [] } })),
    ["audit_aggregation_not_attested"],
  );
  assert.deepEqual(readiness(priceFact({ source: readyAuditSource(), value: priceValue(100, { sampleSize: AUDIT_MIN_SAMPLE_PROVISIONAL - 1 }) })), ["audit_sample_below_floor"]);
  assert.deepEqual(readiness(priceFact({ source: readyAuditSource(), value: priceValue(100, { sampleSize: AUDIT_MIN_SAMPLE_PROVISIONAL }) })), []);
  // a weak audit fact accumulates every problem (and the lock) in a public assessment
  const registry = createFactRegistry();
  const weak = priceFact({ source: auditSource(), value: priceValue(100, { sampleSize: 1 }) });
  ok(registry, weak);
  assert.deepEqual(issueCodes(assessPublic(registry, weak.factId)), [
    "audit_aggregation_not_attested",
    "audit_consent_reference_missing",
    "audit_public_use_locked",
    "audit_sample_below_floor",
    "audit_terms_not_verified",
    "source_terms_not_verified",
  ]);
  // approval scope any_topic stays refused for audit data
  const broad = createFactRegistry();
  const anyTopic = priceFact({ source: readyAuditSource(), usage: { use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-03T10:00:00Z", scope: "any_topic" } }, displayConstraints: [...MEASURED] } });
  ok(broad, anyTopic);
  assert.ok(issueCodes(assessPublic(broad, anyTopic.factId)).includes("approval_scope_too_broad_for_audit_data"));
  // provenance must be verifiable: free-text evidence is not allowed at all on audit facts
  assert.deepEqual(
    refusedCodes(createFactRegistry(), priceFact({ source: { ...readyAuditSource(), evidence: [{ kind: "verbatim_excerpt", excerpt: "FIXTURE excerpt" }] } })),
    ["source_incoherent"],
  );
  assert.deepEqual(refusedCodes(createFactRegistry(), editorialFact({ source: readyAuditSource() })), ["source_incoherent"], "audit data is quantitative only");
  // a "verified" status must name what was verified
  assert.deepEqual(
    refusedCodes(createFactRegistry(), priceFact({ source: { ...licensedSource(), termsOfUse: { status: "verified_permissive", summary: null, reference: null } } })),
    ["source_invalid"],
  );
});

// --- S2.2: D2 privacy and strict structure ------------------------------------------------------

test("D2: unknown keys are refused at every level and never stored", () => {
  const registry = createFactRegistry();
  const cases: [string, unknown, string][] = [
    ["top level", { ...priceFact(), secret: "FIXTURE" }, "secret"],
    ["scope", priceFact({ scope: { ...TARGET, extra: 1 } }), "scope.extra"],
    ["source", priceFact({ source: { ...licensedSource(), userId: "FIXTURE" } }), "source.userId"],
    ["locator", priceFact({ source: { ...licensedSource(), locator: { kind: "document_citation", citation: "F", extra: 1 } } }), "source.locator.extra"],
    ["termsOfUse", priceFact({ source: { ...licensedSource(), termsOfUse: { status: "unverified", summary: null, reference: null, extra: 1 } } }), "source.termsOfUse.extra"],
    ["evidence anchor", priceFact({ source: { ...licensedSource(), evidence: [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64), extra: 1 }] } }), "source.evidence[0].extra"],
    ["confidence", priceFact({ confidence: { level: "high", rationale: "F", extra: 1 } }), "confidence.extra"],
    ["validation", priceFact({ validation: { status: "human_validated", validatedBy: "r", validatedAt: "2026-09-02T10:00:00Z", note: null, extra: 1 } }), "validation.extra"],
    ["usage", priceFact({ usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED], extra: 1 } }), "usage.extra"],
    ["approval", priceFact({ usage: { use: { publicUse: "approved", approval: { approvedBy: "a", approvedAt: "2026-09-03T10:00:00Z", scope: ["pricing-guide"], extra: 1 } }, displayConstraints: [...MEASURED] } }), "usage.use.approval.extra"],
    ["value", priceFact({ value: priceValue(100, { extra: 1 }) }), "value.extra"],
    ["observedPeriod", priceFact({ observedPeriod: { start: "2026-06-01", end: "2026-08-31", extra: 1 } }), "observedPeriod.extra"],
  ];
  for (const [label, fact, path] of cases) {
    const text = refusedText(registry, fact);
    const shownPath = path.replace(/(^|\.)[^.]+$/, "$1<unknown>"); // the raw key is never echoed
    assert.match(text, new RegExp(`unknown_key:${shownPath.replace(/[[\].<>]/g, "\\$&")}:`), label);
    assert.deepEqual(refusedCodes(registry, fact), ["unknown_key"], label);
  }
  assert.equal(registry.size(), 0);
  // no stored fact can carry extra keys
  ok(registry, priceFact());
  assert.deepEqual(Object.keys(registry.get(priceFact().factId)!).sort(), Object.keys(priceFact()).sort());
});

test("D2: audit-derived facts may not carry identifiers, URLs or e-mail addresses anywhere", () => {
  const registry = createFactRegistry();
  const audit = (overrides: Record<string, unknown>) => priceFact({ source: auditSource(), ...overrides });
  const withSource = (patch: Record<string, unknown>) => audit({ source: { ...auditSource(), ...patch } });
  assert.deepEqual(refusedCodes(registry, withSource({ evidence: [{ kind: "internal_record", reference: `rec-${UUID}` }] })), ["privacy_violation"]);
  assert.deepEqual(refusedCodes(registry, withSource({ sourceId: `src-${UUID}` })), ["privacy_violation"]);
  assert.deepEqual(refusedCodes(registry, withSource({ locator: { kind: "internal_reference", reference: `ref-${UUID}` } })), ["privacy_violation"]);
  assert.deepEqual(refusedCodes(registry, audit({ confidence: { level: "high", rationale: UUID } })), ["privacy_violation"]);
  assert.deepEqual(refusedCodes(registry, audit({ confidence: { level: "high", rationale: "see https://www.airbnb.com/rooms/123456" } })), ["privacy_violation"]);
  assert.deepEqual(refusedCodes(registry, audit({ confidence: { level: "high", rationale: "contact host@example.invalid" } })), ["privacy_violation"]);
  assert.deepEqual(
    refusedCodes(registry, withSource({ evidence: [{ kind: "verbatim_excerpt", excerpt: "https://www.airbnb.com/rooms/1" }] })),
    ["privacy_violation", "source_incoherent"],
  );
  assert.deepEqual(refusedCodes(registry, withSource({ userId: "FIXTURE" })), ["unknown_key"]);
  assert.deepEqual(refusedCodes(registry, audit({ auditId: "FIXTURE" })), ["unknown_key"]);
  assert.deepEqual(refusedCodes(registry, audit({ factId: `fact:${UUID}` })), ["privacy_violation"]);
  // legitimate provenance is preserved
  ok(createFactRegistry(), audit({}));
  // non-audit sources may legitimately carry a URL locator
  ok(createFactRegistry(), priceFact({ source: { ...licensedSource(), locator: { kind: "url", url: "https://example.invalid/fixture" } } }));
});

// --- S2.2: D3 robustness ------------------------------------------------------------------------

test("D3: forged and hostile objects are refused cleanly, without running their code", () => {
  const registry = createFactRegistry();
  let reads = 0;
  const trapped = (extra: Record<string, unknown>) => {
    const object = priceFact() as unknown as Record<string, unknown>;
    return Object.defineProperties({ ...object }, extra as PropertyDescriptorMap);
  };
  const getter = { get: () => { reads += 1; return "x"; }, enumerable: true };
  const cyclic: Record<string, unknown> = { metric: "nightly_price_distribution", currency: "EUR", median: 100, sampleSize: 25 };
  cyclic.self = cyclic;
  class Fancy {
    constructor(public metric = "nightly_price_distribution") {}
  }
  const sparse: unknown[] = [];
  sparse[1] = "x";
  let deep: unknown = "leaf";
  for (let i = 0; i < 12; i += 1) deep = { child: deep };
  const hostile: [string, unknown][] = [
    ["Proxy", new Proxy(priceFact(), {})],
    ["accessor property", trapped({ note: getter })],
    ["throwing getter", trapped({ boom: { get: () => { throw new Error("boom"); }, enumerable: true } })],
    ["function in value", priceFact({ value: priceValue(100, { f: () => 1 }) })],
    ["cycle in value", priceFact({ source: auditSource(), value: cyclic })],
    ["Uint8Array", priceFact({ blob: new Uint8Array(2) })],
    ["Date", priceFact({ when: new Date(0) })],
    ["Map", priceFact({ meta: new Map([["k", 1]]) })],
    ["Set", priceFact({ meta: new Set([1]) })],
    ["class instance", priceFact({ value: new Fancy() })],
    ["symbol key", Object.assign(priceFact() as object, { [Symbol("s")]: 1 })],
    ["non-enumerable property", Object.defineProperty({ ...(priceFact() as object) }, "hidden", { value: 1, enumerable: false })],
    ["sparse array", priceFact({ relevantTopics: sparse })],
    ["too deeply nested", priceFact({ value: priceValue(100, { deep }) })],
    ["huge string", priceFact({ confidence: { level: "high", rationale: "x".repeat(5000) } })],
    ["bigint", priceFact({ big: BigInt(1) })],
  ];
  for (const [label, fact] of hostile) {
    let result: ReturnType<FactRegistry["register"]> | undefined;
    assert.doesNotThrow(() => {
      result = registry.register(fact as LocalFact);
    }, label);
    assert.equal(result!.ok, false, label);
    const codes = result!.ok ? [] : result!.issues.map((issue) => issue.code);
    assert.ok(codes.includes("invalid_structure"), `${label}: ${codes.join(",")}`);
  }
  assert.equal(reads, 0, "no accessor was ever invoked");
  assert.equal(registry.size(), 0);
  // a cycle is named as such (the depth limit would refuse it too, but for a less precise reason)
  assert.match(refusedText(registry, priceFact({ source: auditSource(), value: cyclic })), /Cyclic structure/);
  assert.match(refusedText(registry, priceFact({ blob: new Uint8Array(2) })), /Non-plain object/);
  assert.match(refusedText(registry, new Proxy(priceFact(), {})), /Proxies are not accepted/);
  assert.match(refusedText(registry, trapped({ note: getter })), /Accessor properties/);
  assert.deepEqual(refusedCodes(registry, null), ["not_an_object"]);
  assert.deepEqual(refusedCodes(registry, [] as unknown), ["not_an_object"]);
  assert.deepEqual(refusedCodes(registry, "fact" as unknown), ["not_an_object"]);
});

test("D3: time-of-check/time-of-use is impossible and the stored fact is the validated one", () => {
  const registry = createFactRegistry();
  let calls = 0;
  const use = {} as Record<string, unknown>;
  Object.defineProperty(use, "publicUse", { enumerable: true, get() { calls += 1; return calls <= 2 ? "requires_human_approval" : "approved"; } });
  assert.deepEqual(refusedCodes(registry, priceFact({ usage: { use, displayConstraints: [...MEASURED] } })), ["invalid_structure"]);
  assert.equal(calls, 0, "the getter must never run");

  const input = priceFact();
  assert.equal(snapshotUntrustedFact(input).ok, true);
  ok(registry, input);
  // later changes to the caller's object cannot reach the registry
  (input as { version: number }).version = 99;
  (input.source as { publisher: string }).publisher = "tampered";
  const stored = registry.get(priceFact().factId)!;
  assert.equal(stored.version, 1);
  assert.equal(stored.source.publisher, "Fixture Publisher (test only)");
  assert.ok(Object.isFrozen(stored.relevantTopics) && Object.isFrozen(stored.usage.displayConstraints));
  // plain data only: nothing in the stored fact can be mutated through a nested container
  const containers: unknown[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "object" && value !== null) {
      containers.push(value);
      Object.values(value).forEach(visit);
    }
  };
  visit(stored);
  assert.ok(containers.every((container) => Object.isFrozen(container) && (Array.isArray(container) || Object.getPrototypeOf(container) === Object.prototype)));
});

// --- S2.2: D4 time ------------------------------------------------------------------------------

test("D4: validation and approval must already have happened at asOf", () => {
  const registry = createFactRegistry();
  const fact = priceFact();
  ok(registry, fact);
  // collected 09-01T10, validated 09-02T10, approved 09-03T10
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId, "pricing-guide", "2026-09-01T12:00:00Z")), ["approval_in_future", "validation_in_future"]);
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId, "pricing-guide", "2026-09-02T12:00:00Z")), ["approval_in_future"]);
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId, "pricing-guide", "2026-09-03T10:00:00Z")), []);
  assert.deepEqual(
    issueCodes(registry.assess(fact.factId, { asOf: "2026-09-01T12:00:00Z", use: "internal", topic: null })!),
    ["validation_in_future"],
  );
  const early = evaluate(registry, "pricing-guide", "public", "2026-09-01T12:00:00Z");
  assert.equal(early.overall, "blocked");
  assert.equal(early.missing[0]!.reason, "not_validated");
  // an approval dated after the fact expires is refused at registration
  assert.deepEqual(
    refusedCodes(createFactRegistry(), priceFact({ usage: { ...approvedFor(["pricing-guide"], "2030-01-01T00:00:00Z"), displayConstraints: [...MEASURED] } })),
    ["chronology"],
  );
  assert.deepEqual(
    refusedCodes(createFactRegistry(), priceFact({ validation: { status: "human_validated", validatedBy: "r", validatedAt: "2030-01-01T00:00:00Z", note: null } })),
    ["approval_inconsistent", "chronology"],
  );
  // a review submitted in the future is not a review yet
  const pending = createFactRegistry();
  const submitted = priceFact({ validation: { status: "pending_review", submittedAt: "2026-09-20T10:00:00Z" }, usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } });
  ok(pending, submitted);
  assert.deepEqual(issueCodes(pending.assess(submitted.factId, { asOf: "2026-09-10T00:00:00Z", use: "internal", topic: null })!), ["validation_in_future"]);
});

// --- S2.2: D5 scope -----------------------------------------------------------------------------

test("D5: lookups are exact on country, city, granularity, platform and property type", () => {
  const district: GeographicScope = { level: "district", countryCode: "ZZ", citySlug: CITY, districtName: "FIXTURE district" };
  const wrongCountry: GeographicScope = { level: "city", countryCode: "YY", citySlug: CITY };
  const country: GeographicScope = { level: "country", countryCode: "ZZ" };
  const cases: [string, Record<string, unknown>, Parameters<typeof evaluate>[4], string][] = [
    ["a Booking fact does not answer an Airbnb page", { platform: "booking" }, { platform: "airbnb" }, "blocked"],
    ["a Booking fact does not answer a platform-neutral page", { platform: "booking" }, {}, "blocked"],
    ["a platform-neutral fact does not answer an Airbnb page", {}, { platform: "airbnb" }, "blocked"],
    ["a hotel fact does not answer an apartment page", { propertyType: "hotel" }, { propertyType: "apartment" }, "blocked"],
    ["an apartment fact does not answer a type-neutral page", { propertyType: "apartment" }, {}, "blocked"],
    ["a district fact does not answer a whole-city page", { scope: district }, {}, "blocked"],
    ["a city fact does not answer a district page", {}, { target: district }, "blocked"],
    ["a fact of another country does not answer the page", { scope: wrongCountry }, {}, "blocked"],
    ["a country fact does not answer a city page", { scope: country }, {}, "blocked"],
    ["a city fact does not answer a country page", {}, { target: country }, "blocked"],
    ["the same platform matches", { platform: "booking" }, { platform: "booking" }, "all_required_met"],
    ["the same property type matches", { propertyType: "hotel" }, { propertyType: "hotel" }, "all_required_met"],
    ["the same district matches", { scope: district }, { target: district }, "all_required_met"],
    ["the same city matches", {}, {}, "all_required_met"],
  ];
  for (const [label, factOverrides, query, expected] of cases) {
    const registry = createFactRegistry();
    ok(registry, priceFact(factOverrides));
    assert.equal(evaluate(registry, "pricing-guide", "public", AS_OF, query).overall, expected, label);
  }
  // a different district name is a different place
  const registry = createFactRegistry();
  ok(registry, priceFact({ scope: district }));
  assert.equal(registry.findFacts({ target: { ...district, districtName: "Other" }, platform: null, propertyType: null, topic: "pricing-guide" }).length, 0);
  // malformed requests are refused outright
  assert.deepEqual(evaluate(registry, "pricing-guide", "public", AS_OF, { target: { level: "city", countryCode: "zz", citySlug: CITY } }).reasons, ["invalid_target"]);
  assert.deepEqual(evaluate(registry, "pricing-guide", "public", AS_OF, { platform: "booking.com" as never }).reasons, ["invalid_platform"]);
  assert.deepEqual(evaluate(registry, "pricing-guide", "public", AS_OF, { propertyType: "castle" as never }).reasons, ["invalid_property_type"]);
  assert.deepEqual(evaluate(registry, "pricing-guide", "public", AS_OF, { target: { level: "district", countryCode: "ZZ", citySlug: CITY, districtName: " " } }).reasons, ["invalid_target"]);
});

// --- S2.2: D6 contradictions --------------------------------------------------------------------

test("D6: contradictory facts are never resolved silently; successive observations are not contradictions", () => {
  const second = (overrides: Record<string, unknown>) => priceFact({ factId: "fact:fixture:fixture-city:price:second", ...overrides });
  const first = priceFact();

  // overlapping periods, different values: a real contradiction
  const registry = createFactRegistry();
  ok(registry, first);
  ok(registry, second({ observedPeriod: { start: "2026-07-01", end: "2026-08-31" }, value: priceValue(500) }));
  const report = evaluate(registry, "pricing-guide", "public");
  assert.equal(report.overall, "needs_human_decision");
  assert.deepEqual(report.reasons, ["conflicting_facts:nightly_price_distribution"]);
  const requirement = report.requirements[0]!;
  assert.equal(requirement.status, "needs_human_decision");
  assert.equal(requirement.chosenFactId, null, "nothing is chosen on the quiet");
  assert.deepEqual(requirement.conflictingFactIds, [first.factId, "fact:fixture:fixture-city:price:second"].sort());
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes("500") && !serialized.includes("111.11"), "no value may leak through the report");

  // same period: refused at registration already (retained S2 behaviour)
  assert.match(refusedText(registry, second({ factId: "fact:fixture:fixture-city:price:third", value: priceValue(777) })), /conflicting_values/);

  // disjoint periods: successive measurements, the most recent reference date wins, deterministically
  const successive = createFactRegistry();
  ok(successive, priceFact({ observedPeriod: { start: "2026-03-01", end: "2026-05-31" }, collectedAt: "2026-06-05T10:00:00Z", source: { ...licensedSource(), consultedAt: "2026-06-05T09:00:00Z", publishedAt: "2026-05-01" }, validation: { status: "human_validated", validatedBy: "r", validatedAt: "2026-06-06T10:00:00Z", note: null }, usage: { ...approvedFor(["pricing-guide"], "2026-06-07T10:00:00Z"), displayConstraints: [...MEASURED] }, value: priceValue(90) }));
  ok(successive, second({ observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, value: priceValue(120) }));
  const later = evaluate(successive, "pricing-guide", "public", "2026-09-10T00:00:00Z");
  assert.equal(later.overall, "all_required_met");
  assert.equal(later.requirements[0]!.chosenFactId, "fact:fixture:fixture-city:price:second");
  assert.deepEqual(later.requirements[0]!.conflictingFactIds, []);

  // same segment required: a Booking observation is another segment, not a contradiction
  const segments = createFactRegistry();
  ok(segments, first);
  ok(segments, second({ platform: "booking", value: priceValue(500) }));
  assert.equal(evaluate(segments, "pricing-guide", "public").overall, "all_required_met");
  assert.equal(evaluate(segments, "pricing-guide", "public", AS_OF, { platform: "booking" }).requirements[0]!.chosenFactId, "fact:fixture:fixture-city:price:second");

  // different currencies over the same period cannot be compared: arbitration needed
  const currency = createFactRegistry();
  ok(currency, first);
  ok(currency, second({ observedPeriod: { start: "2026-07-01", end: "2026-08-31" }, value: priceValue(111.11, { currency: "USD" }) }));
  assert.equal(evaluate(currency, "pricing-guide", "public").overall, "needs_human_decision");

  // an expired contradicting fact does not count
  const stale = createFactRegistry();
  ok(stale, first);
  ok(stale, second({ observedPeriod: { start: "2026-07-01", end: "2026-08-31" }, validUntil: "2026-09-15T00:00:00Z", value: priceValue(500) }));
  const afterExpiry = evaluate(stale, "pricing-guide", "public", "2026-10-01T00:00:00Z");
  assert.equal(afterExpiry.overall, "all_required_met");
  assert.equal(afterExpiry.requirements[0]!.chosenFactId, first.factId);
});

// --- S2.2: D7 revocations -----------------------------------------------------------------------

test("D7: a revocation never reinstates a fact on its own, and the refusals stay distinguishable", () => {
  const registry = createFactRegistry();
  const v1 = priceFact();
  ok(registry, v1);
  const revoked = priceFact({
    factId: "fact:fixture:fixture-city:price:2026q3:v2",
    version: 2,
    supersedes: v1.factId,
    collectedAt: "2026-09-05T10:00:00Z",
    validation: { status: "revoked", revokedAt: "2026-09-06T00:00:00Z", reason: "FIXTURE revocation" },
    usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] },
    value: priceValue(112),
  });
  ok(registry, revoked);
  const blocked = evaluate(registry, "pricing-guide", "public");
  assert.equal(blocked.overall, "blocked");
  assert.equal(blocked.requirements[0]!.primaryIssue, "revoked");
  assert.equal(blocked.missing[0]!.reason, "absent");
  assert.deepEqual(blocked.reasons, ["required_requirement_not_met:nightly_price_distribution:revoked"]);

  const successor = (overrides: Record<string, unknown>) =>
    priceFact({
      factId: "fact:fixture:fixture-city:price:2026q3:v3",
      version: 3,
      supersedes: revoked.factId,
      collectedAt: "2026-09-05T11:00:00Z",
      value: priceValue(113),
      ...overrides,
    });
  const validatedAt = (iso: string, approvedAt: string) => ({
    validation: { status: "human_validated", validatedBy: "fixture-reviewer-2", validatedAt: iso, note: null },
    usage: { ...approvedFor(["pricing-guide"], approvedAt), displayConstraints: [...MEASURED] },
  });
  // validation that pre-dates the revocation, no validation, a draft, a pending review: all refused
  assert.match(refusedText(registry, successor(validatedAt("2026-09-05T12:00:00Z", "2026-09-05T13:00:00Z"))), /revocation_requires_new_validation/);
  assert.match(
    refusedText(registry, successor({ validation: { status: "draft" }, usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] } })),
    /revocation_requires_new_validation/,
  );
  assert.match(
    refusedText(registry, successor({ validation: { status: "pending_review", submittedAt: "2026-09-07T10:00:00Z" }, usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } })),
    /revocation_requires_new_validation/,
  );
  // a new explicit human validation dated after the revocation is accepted, and only then
  ok(registry, successor(validatedAt("2026-09-07T10:00:00Z", "2026-09-08T10:00:00Z")));
  assert.equal(registry.isSuperseded(revoked.factId), true);
  assert.equal(evaluate(registry, "pricing-guide", "public").overall, "all_required_met");

  // a further revocation or a rejection is always allowed (terminal states)
  const second = createFactRegistry();
  ok(second, v1);
  ok(second, revoked);
  ok(second, successor({ validation: { status: "revoked", revokedAt: "2026-09-07T00:00:00Z", reason: "FIXTURE again" }, usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] } }));

  // rejected and superseded are reported distinctly
  const rejected = createFactRegistry();
  ok(rejected, priceFact({ validation: { status: "rejected", rejectedAt: "2026-09-02T10:00:00Z", reason: "FIXTURE" }, usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] } }));
  assert.equal(evaluate(rejected, "pricing-guide", "public").requirements[0]!.primaryIssue, "rejected");
  const replaced = createFactRegistry();
  ok(replaced, v1);
  ok(replaced, priceFact({ factId: "fact:fixture:fixture-city:price:2026q3:v2", version: 2, supersedes: v1.factId, collectedAt: "2026-09-05T10:00:00Z", value: priceValue(112), validation: { status: "human_validated", validatedBy: "r", validatedAt: "2026-09-06T10:00:00Z", note: null }, usage: { ...approvedFor(["pricing-guide"], "2026-09-07T10:00:00Z"), displayConstraints: [...MEASURED] } }));
  assert.deepEqual(issueCodes(assessPublic(replaced, v1.factId)), ["superseded"]);
  // the revoked v2 was later replaced by the re-validated v3, and a revoked fact is not validated
  assert.deepEqual(issueCodes(assessPublic(registry, revoked.factId)), ["not_validated", "public_use_forbidden", "revoked", "superseded"]);
});

// --- S2.4 helpers -------------------------------------------------------------------------------

/** Dates for facts that must already be in place months before AS_OF (rules, time zones). */
const EARLY = {
  collectedAt: "2026-01-10T10:00:00Z",
  validatedAt: "2026-01-11T10:00:00Z",
  approvedAt: "2026-01-12T10:00:00Z",
  validUntil: "2026-12-31T00:00:00Z",
};
const earlySource = (): FactSource => ({ ...licensedSource(), sourceType: "official_authority", consultedAt: "2026-01-10T09:00:00Z", publishedAt: "2026-01-01" });
const earlyValidation = { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: EARLY.validatedAt, note: null };

function ruleFact(value: Record<string, unknown>, overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:rule:v1",
    kind: "regulatory",
    source: earlySource(),
    collectedAt: EARLY.collectedAt,
    validUntil: EARLY.validUntil,
    observedPeriod: null,
    relevantTopics: ["long-stay-guide"],
    validation: earlyValidation,
    usage: { ...approvedFor(["long-stay-guide"], EARLY.approvedAt), displayConstraints: [] },
    value: { ruleType: "minimum_stay", rule: "FIXTURE rule", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE reference", ...value },
    ...overrides,
  });
}

function timezoneFact(zone: string, overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:timezone:v1",
    kind: "geographic",
    source: earlySource(),
    collectedAt: EARLY.collectedAt,
    validUntil: EARLY.validUntil,
    observedPeriod: null,
    relevantTopics: ["long-stay-guide"],
    validation: earlyValidation,
    usage: { use: { publicUse: "forbidden" }, displayConstraints: [] },
    value: { attribute: "timezone", value: zone },
    ...overrides,
  });
}

/** A second price fact over another period, usable at AS_OF. */
const secondPrice = (overrides: Record<string, unknown> = {}) =>
  priceFact({ factId: "fact:fixture:fixture-city:price:second", observedPeriod: { start: "2026-07-01", end: "2026-08-31" }, ...overrides });

const statFact = (id: string, name: string, value: number, unit: string, period: { start: string; end: string }): LocalFact =>
  priceFact({
    factId: id,
    unit,
    source: { ...licensedSource(), sourceType: "official_authority" },
    observedPeriod: period,
    relevantTopics: ["local-demand-guide"],
    usage: { ...approvedFor(["local-demand-guide"]), displayConstraints: [] },
    value: { metric: "official_statistic", name, value },
  });

const requirementOf = (report: TopicFactsReport, id: string) => report.requirements.find((entry) => entry.requirementId === id)!;

// --- S2.4: N7 / D8 time zones -------------------------------------------------------------------

test("N7/D8: regulatory dates are civil days in the jurisdiction's own time zone, and a rule without a known zone is refused", () => {
  const inForce = (zone: string | null, value: Record<string, unknown>, asOf: string) => {
    const registry = createFactRegistry();
    if (zone !== null) ok(registry, timezoneFact(zone));
    const rule = ruleFact(value);
    ok(registry, rule);
    return issueCodes(assessPublic(registry, rule.factId, "long-stay-guide", asOf));
  };
  const until = (day: string) => ({ effectiveFrom: "2026-01-01", effectiveUntil: day });
  const from = (day: string) => ({ effectiveFrom: day, effectiveUntil: null });

  // no zone known: never silently UTC
  assert.deepEqual(inForce(null, from("2026-01-01"), "2026-06-01T00:00:00Z"), ["rule_timezone_unknown"]);

  // Paris (UTC+2 in October): the last civil day ends at 22:00Z
  assert.deepEqual(inForce("Europe/Paris", until("2026-10-01"), "2026-10-01T21:59:59Z"), []);
  assert.deepEqual(inForce("Europe/Paris", until("2026-10-01"), "2026-10-01T22:00:00Z"), ["rule_no_longer_in_force"]);
  assert.deepEqual(inForce("Europe/Paris", from("2026-10-01"), "2026-09-30T21:59:59Z"), ["rule_not_yet_in_force"]);
  assert.deepEqual(inForce("Europe/Paris", from("2026-10-01"), "2026-09-30T22:00:00Z"), []);
  // Los Angeles (UTC-7): the same civil day ends at 07:00Z the next day
  assert.deepEqual(inForce("America/Los_Angeles", until("2026-10-01"), "2026-10-02T06:59:59Z"), []);
  assert.deepEqual(inForce("America/Los_Angeles", until("2026-10-01"), "2026-10-02T07:00:00Z"), ["rule_no_longer_in_force"]);
  // half-hour and far-east offsets
  assert.deepEqual(inForce("Asia/Kolkata", until("2026-06-01"), "2026-06-01T18:29:59Z"), []);
  assert.deepEqual(inForce("Asia/Kolkata", until("2026-06-01"), "2026-06-01T18:30:00Z"), ["rule_no_longer_in_force"]);
  assert.deepEqual(inForce("Pacific/Kiritimati", from("2026-06-01"), "2026-05-31T09:59:59Z"), ["rule_not_yet_in_force"]);
  assert.deepEqual(inForce("Pacific/Kiritimati", from("2026-06-01"), "2026-05-31T10:00:00Z"), []);
  // clock changes: Paris springs forward on 2026-03-29 (23 h day) and falls back on 2026-10-25 (25 h day)
  assert.deepEqual(inForce("Europe/Paris", from("2026-03-29"), "2026-03-28T22:59:59Z"), ["rule_not_yet_in_force"]);
  assert.deepEqual(inForce("Europe/Paris", from("2026-03-29"), "2026-03-28T23:00:00Z"), []);
  assert.deepEqual(inForce("Europe/Paris", until("2026-03-29"), "2026-03-29T21:59:59Z"), []);
  assert.deepEqual(inForce("Europe/Paris", until("2026-03-29"), "2026-03-29T22:00:00Z"), ["rule_no_longer_in_force"]);
  assert.deepEqual(inForce("Europe/Paris", until("2026-10-25"), "2026-10-25T22:59:59Z"), []);
  assert.deepEqual(inForce("Europe/Paris", until("2026-10-25"), "2026-10-25T23:00:00Z"), ["rule_no_longer_in_force"]);
  // an undated bound never expires; the day after UTC midnight is not special
  assert.deepEqual(inForce("Europe/Paris", { effectiveFrom: null, effectiveUntil: null }, "2026-06-01T00:00:00Z"), []);
});

test("N7: the zone must come from exactly one usable, human-validated timezone fact of the same scope", () => {
  withLongStayRuleRequired(() => {
  const rule = ruleFact({ effectiveFrom: "2026-01-01", effectiveUntil: null });
  const zoneOf = (...facts: LocalFact[]) => {
    const registry = createFactRegistry();
    facts.forEach((fact) => ok(registry, fact));
    return registry.resolveTimeZone(TARGET, "2026-06-01T00:00:00Z");
  };
  assert.equal(zoneOf(timezoneFact("Europe/Paris")), "Europe/Paris");
  assert.equal(zoneOf(), null, "no fact: unknown");
  assert.equal(zoneOf(timezoneFact("Europe/Paris", { validation: { status: "pending_review", submittedAt: "2026-01-11T10:00:00Z" } })), null, "not human-validated");
  assert.equal(zoneOf(timezoneFact("Europe/Paris", { validUntil: "2026-05-01T00:00:00Z" })), null, "expired");
  assert.equal(zoneOf(timezoneFact("Europe/Paris", { scope: { level: "country", countryCode: "ZZ" } })), null, "a country fact does not answer a city rule");
  assert.equal(zoneOf(timezoneFact("Europe/Paris", { scope: { ...TARGET, citySlug: "other-city" } })), null, "another city");
  assert.equal(zoneOf(timezoneFact("Europe/Paris"), timezoneFact("America/New_York", { factId: "fact:fixture:fixture-city:timezone:v2" })), null, "disagreeing facts: unknown, never guessed");
  const duplicateZone = createFactRegistry();
  ok(duplicateZone, timezoneFact("Europe/Paris"));
  assert.match(refusedText(duplicateZone, timezoneFact("Europe/Paris", { factId: "fact:fixture:fixture-city:timezone:v2" })), /duplicate_content/, "an identical second zone fact is a duplicate, not extra evidence");
  // zone names are validated at registration
  for (const bad of ["Mars/Base", "europe/paris", "Europe/Paris; x", "Paris", "+02:00"]) {
    assert.deepEqual(refusedCodes(createFactRegistry(), timezoneFact(bad)), ["invalid_value"], bad);
  }
  // through the topic evaluation: unknown zone blocks, with the precise cause
  const withoutZone = createFactRegistry();
  ok(withoutZone, rule);
  const blocked = evaluateTopicFacts(withoutZone, { target: TARGET, platform: null, propertyType: null, topic: "long-stay-guide", asOf: "2026-06-01T00:00:00Z", use: "public" });
  assert.equal(blocked.overall, "blocked");
  assert.equal(blocked.requirements[0]!.primaryIssue, "rule_timezone_unknown");
  const withZone = createFactRegistry();
  ok(withZone, timezoneFact("Europe/Paris"));
  ok(withZone, rule);
  assert.equal(evaluateTopicFacts(withZone, { target: TARGET, platform: null, propertyType: null, topic: "long-stay-guide", asOf: "2026-06-01T00:00:00Z", use: "public" }).overall, "needs_human_decision");
  const ended = createFactRegistry();
  ok(ended, timezoneFact("Europe/Paris"));
  ok(ended, ruleFact({ effectiveFrom: "2020-01-01", effectiveUntil: "2026-05-01" }));
  const report = evaluateTopicFacts(ended, { target: TARGET, platform: null, propertyType: null, topic: "long-stay-guide", asOf: "2026-06-01T00:00:00Z", use: "public" });
  assert.equal(report.overall, "blocked");
  assert.equal(report.requirements[0]!.primaryIssue, "rule_no_longer_in_force");
  assert.equal(report.missing[0]!.reason, "expired");
  // two different rules of the same type over overlapping periods contradict each other
  const rules = createFactRegistry();
  ok(rules, timezoneFact("Europe/Paris"));
  ok(rules, ruleFact({}));
  ok(rules, ruleFact({ rule: "FIXTURE other rule" }, { factId: "fact:fixture:fixture-city:rule:other" }));
  const contradiction = evaluateTopicFacts(rules, { target: TARGET, platform: null, propertyType: null, topic: "long-stay-guide", asOf: "2026-06-01T00:00:00Z", use: "public" });
  assert.deepEqual(contradiction.requirements[0]!.conflictingFactIds, ["fact:fixture:fixture-city:rule:other", "fact:fixture:fixture-city:rule:v1"]);
  assert.equal(contradiction.overall, "needs_human_decision");
  // impossible dates and inverted ranges are refused at registration
  assert.deepEqual(refusedCodes(createFactRegistry(), ruleFact({ effectiveFrom: "2026-02-30" })), ["invalid_date"]);
  assert.deepEqual(refusedCodes(createFactRegistry(), ruleFact({ effectiveFrom: "2026-06-01", effectiveUntil: "2026-01-01" })), ["invalid_period"]);
  });
});

// --- S2.4: N1 / N5 provenance and audit metrics -----------------------------------------------

test("N1: audit data cannot be passed off as an external source (exact reproduction and the closed matrix)", () => {
  const registry = createFactRegistry();
  const relabelled = {
    ...licensedSource(),
    collectionMethod: { kind: "internal_aggregation", description: "aggregated from our own audits" },
    locator: { kind: "internal_reference", reference: "audit-aggregate-key" },
    evidence: [{ kind: "internal_record", reference: "r" }],
  };
  assert.deepEqual(refusedCodes(registry, priceFact({ source: relabelled })), ["source_incoherent"], "the exact N1 relabelling");
  // each ingredient alone is refused too
  assert.deepEqual(refusedCodes(registry, priceFact({ source: { ...licensedSource(), collectionMethod: { kind: "internal_aggregation", description: "x" } } })), ["source_incoherent"]);
  assert.deepEqual(refusedCodes(registry, priceFact({ source: { ...licensedSource(), locator: { kind: "internal_reference", reference: "x" }, evidence: [{ kind: "internal_record", reference: "r" }] } })), ["source_incoherent"]);
  // the closed source/method matrix
  const method = (kind: string) => ({ kind, description: "fixture" });
  const ambiguous: [string, Record<string, unknown>][] = [
    ["official authority + internal aggregation", { ...earlySource(), sourceType: "official_authority", collectionMethod: method("internal_aggregation") }],
    ["licensed dataset + editorial judgement", { ...licensedSource(), collectionMethod: method("editorial_judgement") }],
    ["web page + dataset download", { ...licensedSource(), sourceType: "public_web_page" }],
    ["web page + internal reference", { ...licensedSource(), sourceType: "public_web_page", collectionMethod: method("manual_reading"), locator: { kind: "internal_reference", reference: "x" }, evidence: [{ kind: "content_hash", algorithm: "sha256", value: "b".repeat(64) }] }],
    ["audit + dataset download", { ...auditSource(), collectionMethod: method("dataset_download") }],
    ["audit + external locator", { ...auditSource(), locator: { kind: "document_citation", citation: "x" } }],
    ["research + internal aggregation", { ...licensedSource(), sourceType: "published_research", collectionMethod: method("internal_aggregation") }],
  ];
  for (const [label, source] of ambiguous) {
    assert.deepEqual(refusedCodes(createFactRegistry(), priceFact({ source })), ["source_incoherent"], label);
  }
  assert.deepEqual(refusedCodes(createFactRegistry(), priceFact({ source: { ...editorialSource(), collectionMethod: method("dataset_download") } })), ["display_constraint_missing", "source_incoherent"]);
  // legitimate internal references stay possible: an archived licensed file, anchored by a hash
  const archived = { ...licensedSource(), locator: { kind: "internal_reference", reference: "FIXTURE-archived-licensed-file" }, evidence: [{ kind: "content_hash", algorithm: "sha256", value: "c".repeat(64) }] };
  const legit = createFactRegistry();
  const archivedFact = priceFact({ source: archived });
  ok(legit, archivedFact);
  assert.deepEqual(issueCodes(assessPublic(legit, archivedFact.factId)), []);
  // ... and so is an editorial note with an internal reference
  ok(createFactRegistry(), editorialFact());
  // an archive reference is an acceptable anchor too
  ok(createFactRegistry(), priceFact({ source: { ...archived, evidence: [{ kind: "archive_reference", reference: "FIXTURE-archive" }] } }));
  // the lock still holds for real audit data
  assert.equal(AUDIT_PUBLIC_USE_LOCK.unlocked, false);
});

test("N5: audit-derived facts only use metrics whose sample can be checked", () => {
  const registry = createFactRegistry();
  const statistic = priceFact({ source: readyAuditSource(), unit: "EUR", value: { metric: "official_statistic", name: "single listing nightly rate", value: 123 } });
  assert.deepEqual(refusedCodes(registry, statistic), ["source_incoherent"]);
  assert.match(refusedText(registry, statistic), /source_incoherent:value\.metric:/);
  const unavailability = (sampleSize: number) => unavailabilityFact({ source: readyAuditSource(), value: { metric: "calendar_unavailability_rate", ratio: 0.4, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize } });
  const price = (sampleSize: number) => priceFact({ source: readyAuditSource(), value: priceValue(100, { sampleSize }) });
  for (const build of [price, unavailability]) {
    assert.deepEqual(auditPublicUseReadiness(build(AUDIT_MIN_SAMPLE_PROVISIONAL)).map((entry) => entry.code), []);
    assert.deepEqual(auditPublicUseReadiness(build(AUDIT_MIN_SAMPLE_PROVISIONAL - 1)).map((entry) => entry.code), ["audit_sample_below_floor"]);
    ok(createFactRegistry(), build(AUDIT_MIN_SAMPLE_PROVISIONAL));
  }
  // a fact with no readable sample at all is as unready as one with a small sample (fail closed)
  const noSample = { ...priceFact({ source: readyAuditSource() }), value: { metric: "official_statistic", name: "x", value: 1 } } as unknown as LocalFact;
  assert.deepEqual(auditPublicUseReadiness(noSample).map((entry) => entry.code), ["audit_sample_below_floor"]);
  assert.equal(AUDIT_PUBLIC_USE_LOCK.unlocked, false);
});

test("privacy: UUIDs with or without dashes and listing-style numbers are refused in audit facts, without false rejections or echoes", () => {
  const audit = (overrides: Record<string, unknown>) => priceFact({ source: auditSource(), ...overrides });
  const rationale = (text: string) => audit({ confidence: { level: "high", rationale: text } });
  const refused: [string, unknown][] = [
    ["dashed UUID", rationale(UUID)],
    ["dash-less UUID", rationale("123e4567e89b12d3a456426614174000")],
    // no run of 9 digits here: only the dash-less-identifier rule can catch these
    ["dash-less UUID without a long digit run", rationale("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")],
    ["dash-less UUID in a record reference, no long digit run", audit({ source: { ...auditSource(), evidence: [{ kind: "internal_record", reference: "rec-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" }] } })],
    ["upper-case dash-less UUID", rationale("123E4567E89B12D3A456426614174000")],
    ["9-digit listing id", rationale("listing 123456789")],
    ["16-digit listing id", rationale("airbnb room 1234567890123456")],
    ["id in sourceId", audit({ source: { ...auditSource(), sourceId: "src-123456789012" } })],
    ["id in an internal record", audit({ source: { ...auditSource(), evidence: [{ kind: "internal_record", reference: "rec-123e4567e89b12d3a456426614174000" }] } })],
    ["id in an archive reference", audit({ source: { ...auditSource(), evidence: [{ kind: "archive_reference", reference: "arch-987654321" }] } })],
    ["id in the locator", audit({ source: { ...auditSource(), locator: { kind: "internal_reference", reference: "ref-123456789" } } })],
    ["dash-less UUID in the fact id", audit({ factId: "fact:123e4567e89b12d3a456426614174000" })],
    ["dash-less UUID in the fact id, no long digit run", audit({ factId: "fact:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" })],
    ["dash-less UUID in the fact id of a NON-audit fact", priceFact({ factId: "fact:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" })],
  ];
  for (const [label, fact] of refused) {
    const registry = createFactRegistry();
    assert.deepEqual(refusedCodes(registry, fact), ["privacy_violation"], label);
    const text = refusedText(registry, fact);
    assert.ok(!text.includes("123456789") && !text.includes("987654321") && !text.toLowerCase().includes("e89b12d3"), `${label}: the offending value must not be echoed`);
  }
  const accepted: [string, LocalFact][] = [
    ["a sample size in words", rationale("based on 25 audits")],
    ["a period", rationale("period 2026Q3, version 2")],
    ["a short number", rationale("12345678")],
    ["31 hex characters", rationale("abcdefabcdefabcdefabcdefabcdefa")],
    ["33 hex characters", rationale("abcdefabcdefabcdefabcdefabcdefabc")],
    ["a plain reference", audit({ source: { ...auditSource(), evidence: [{ kind: "internal_record", reference: "fixture-record-42" }] } })],
    ["a content hash made only of digits", audit({ source: { ...auditSource(), evidence: [{ kind: "content_hash", algorithm: "sha256", value: "1234567890".repeat(6) + "1234" }] } })],
    ["a long numeric fact id", audit({ factId: "fact:fixture:fixture-city:price:20260901123456789" })],
  ];
  for (const [label, fact] of accepted) {
    const result = createFactRegistry().register(fact);
    assert.equal(result.ok, true, `${label}: ${JSON.stringify(result)}`);
  }
  // outside audit data, long numbers are legitimate (a decree number, an archive id)
  ok(createFactRegistry(), priceFact({ source: { ...licensedSource(), locator: { kind: "document_citation", citation: "Decree 2026/123456789" } } }));
  ok(createFactRegistry(), priceFact({ confidence: { level: "high", rationale: "reference 123456789" } }));
});

// --- S2.4: N3 contradictions --------------------------------------------------------------------

test("N3: price contradictions use the median, the percentiles and the unit; a sample size alone is never a contradiction", () => {
  const verdict = (first: Record<string, unknown>, second: Record<string, unknown>, secondOverrides: Record<string, unknown> = {}) => {
    const registry = createFactRegistry();
    ok(registry, priceFact({ value: first }));
    ok(registry, secondPrice({ value: second, ...secondOverrides }));
    return requirementOf(evaluate(registry, "pricing-guide", "public"), "nightly_price_distribution");
  };
  const conflict = (report: { conflictingFactIds: readonly string[] }) => report.conflictingFactIds.length > 0;
  assert.equal(conflict(verdict(priceValue(100), priceValue(105))), true, "different medians");
  assert.equal(conflict(verdict(priceValue(100, { p25: 90 }), priceValue(100, { p25: 95 }))), true, "same median, a shared percentile differs");
  assert.equal(conflict(verdict(priceValue(100, { p90: 150 }), priceValue(100, { p90: 900 }))), true, "same median, wildly different p90");
  assert.equal(conflict(verdict(priceValue(100, { p25: 90 }), priceValue(100, { p90: 900 }))), false, "percentiles given by only one fact are not comparable");
  assert.equal(conflict(verdict(priceValue(100, { p25: 90 }), priceValue(100, { p25: 90, sampleSize: 80 }))), false, "a different sample is not a different answer");
  assert.equal(conflict(verdict(priceValue(100), priceValue(100, { currency: "USD" }))), true, "different currencies");
  assert.equal(conflict(verdict(priceValue(100), priceValue(100), { unit: "EUR" })), false, "unit 'EUR' equals the currency");
  assert.deepEqual(refusedCodes(createFactRegistry(), secondPrice({ value: priceValue(100), unit: "USD" })), ["invalid_unit"], "a unit that differs from the currency is refused at registration");
});

test("N3: observed periods must really overlap; disjoint observations with two usable facts keep the most recent", () => {
  const run = (firstPeriod: { start: string; end: string }, secondPeriod: { start: string; end: string }) => {
    const registry = createFactRegistry();
    ok(registry, priceFact({ observedPeriod: firstPeriod, value: priceValue(90) }));
    ok(registry, secondPrice({ observedPeriod: secondPeriod, value: priceValue(120) }));
    return requirementOf(evaluate(registry, "pricing-guide", "public"), "nightly_price_distribution");
  };
  // adjacent days do not overlap; one shared day does
  assert.deepEqual(run({ start: "2026-06-01", end: "2026-07-31" }, { start: "2026-08-01", end: "2026-08-31" }).conflictingFactIds, []);
  assert.equal(run({ start: "2026-06-01", end: "2026-07-31" }, { start: "2026-07-31", end: "2026-08-31" }).conflictingFactIds.length, 2);
  // two genuinely usable disjoint facts (ages 61 and 30 days at AS_OF): the newest wins, no contradiction
  const successive = run({ start: "2026-06-01", end: "2026-07-31" }, { start: "2026-08-01", end: "2026-08-31" });
  assert.equal(successive.status, "met");
  assert.equal(successive.chosenFactId, "fact:fixture:fixture-city:price:second");
});

test("N3: official statistics compare normalised names and units; unavailability compares ratios", () => {
  const P1 = { start: "2026-06-01", end: "2026-08-31" };
  const P2 = { start: "2026-07-01", end: "2026-08-31" };
  const statistics = (a: LocalFact, b: LocalFact) => {
    const registry = createFactRegistry();
    ok(registry, a);
    ok(registry, b);
    return requirementOf(evaluateTopicFacts(registry, { target: TARGET, platform: null, propertyType: null, topic: "local-demand-guide", asOf: AS_OF, use: "public" }), "official_statistic");
  };
  const id = (letter: string) => `fact:fixture:fixture-city:stat:${letter}`;
  assert.equal(statistics(statFact(id("a"), "arrivals", 100, "persons", P1), statFact(id("b"), "arrivals", 900, "persons", P2)).conflictingFactIds.length, 2, "same name, different values");
  assert.equal(statistics(statFact(id("a"), "Arrivées", 100, "persons", P1), statFact(id("b"), "  arrivees ", 900, "persons", P2)).conflictingFactIds.length, 2, "case, accents and spaces are normalised");
  assert.equal(statistics(statFact(id("a"), "arrivals", 100, "persons", P1), statFact(id("b"), "arrivals", 100, "thousand persons", P2)).conflictingFactIds.length, 2, "same number, different unit");
  assert.equal(statistics(statFact(id("a"), "arrivals", 100, "persons", P1), statFact(id("b"), "overnight stays", 900, "persons", P2)).conflictingFactIds.length, 0, "different quantities");
  assert.equal(statistics(statFact(id("a"), "arrivals", 100, "persons", P1), statFact(id("b"), "arrivals", 100, "Persons", P2)).conflictingFactIds.length, 0, "same value, unit differing by case only");

  const ratios = (first: number, second: number) => {
    const registry = createFactRegistry();
    const build = (idSuffix: string, ratio: number, period: { start: string; end: string }) =>
      unavailabilityFact({ factId: `fact:fixture:fixture-city:unavailability:${idSuffix}`, observedPeriod: period, value: { metric: "calendar_unavailability_rate", ratio, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize: 25 } });
    ok(registry, build("a", first, P1));
    ok(registry, build("b", second, P2));
    return requirementOf(evaluate(registry, "occupancy-guide", "public"), "calendar_unavailability_rate");
  };
  assert.equal(ratios(0.42, 0.55).conflictingFactIds.length, 2, "different ratios over overlapping periods");
  assert.equal(ratios(0.42, 0.42).conflictingFactIds.length, 0, "same ratio");
});

// --- S2.4: N4 / N6 limits and diagnostics ---------------------------------------------------------

test("N4/N6: excess input is refused quickly, before it is walked, and diagnostics never echo raw keys or values", () => {
  const elapsed = (work: () => void) => {
    const started = performance.now();
    work();
    return performance.now() - started;
  };
  // sparse array of 4 billion slots: refused at once, with a single issue
  const huge: unknown[] = [];
  huge.length = 4_000_000_000;
  let result: ReturnType<typeof snapshotUntrustedFact> | undefined;
  assert.ok(elapsed(() => { result = snapshotUntrustedFact({ list: huge }); }) < 250, "a huge sparse array must cost nothing");
  assert.equal(result!.ok, false);
  assert.deepEqual(result!.ok ? [] : result!.issues.map((entry) => entry.code), ["invalid_structure"]);
  // exact limits
  assert.equal(snapshotUntrustedFact({ list: Array.from({ length: 50 }, () => "x") }).ok, true);
  assert.equal(snapshotUntrustedFact({ list: Array.from({ length: 51 }, () => "x") }).ok, false);
  const keys = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, 1]));
  assert.equal(snapshotUntrustedFact(keys(60)).ok, true);
  assert.equal(snapshotUntrustedFact(keys(61)).ok, false);
  assert.equal(snapshotUntrustedFact({ ["k".repeat(60)]: 1 }).ok, true);
  assert.equal(snapshotUntrustedFact({ ["k".repeat(61)]: 1 }).ok, false);
  assert.ok(elapsed(() => { snapshotUntrustedFact(keys(100_000)); }) < 1000, "100,000 keys are refused without walking them");
  const text = { list: Array.from({ length: 50 }, () => "x".repeat(2000)) };
  assert.equal(snapshotUntrustedFact(text).ok, true, "100,000 characters in total are allowed");
  assert.equal(snapshotUntrustedFact({ ...text, extra: "x" }).ok, false, "one more character is too much");
  let nested: unknown = "leaf";
  for (let level = 0; level < 12; level += 1) nested = { child: nested };
  assert.equal(snapshotUntrustedFact({ nested }).ok, false);
  // the number of issues returned is capped, with a marker
  const registry = createFactRegistry();
  const flooded = registry.register(priceFact({ relevantTopics: Array.from({ length: 50 }, (_, index) => `unknown-${index}`) })) as unknown as { ok: false; issues: { code: string }[] };
  assert.equal(flooded.ok, false);
  assert.equal(flooded.issues.length, 41);
  assert.equal(flooded.issues[40]!.code, "too_many_issues");
  assert.equal(flooded.issues[0]!.code, "unknown_topic", "useful codes are preserved");
  // raw keys and values are never echoed
  const sensitive = registry.register(priceFact({ ["host@example.invalid"]: "owner 987654321" })) as unknown as { ok: false; issues: { path: string }[] };
  assert.deepEqual(sensitive.issues.map((entry) => entry.path), ["<unknown>"]);
  const giant = registry.register({ ...priceFact(), ["k".repeat(2_000_000)]: 1 } as unknown as LocalFact) as unknown as { ok: false; issues: unknown[] };
  assert.equal(giant.ok, false);
  assert.ok(JSON.stringify(giant.issues).length < 1000, "a giant key is not copied into the diagnostics");
  const nestedKey = registry.register(priceFact({ source: { ...licensedSource(), ["owner@example.invalid"]: 1 } })) as unknown as { ok: false; issues: { path: string }[] };
  assert.deepEqual(nestedKey.issues.map((entry) => entry.path), ["source.<unknown>"]);
  const invalid = evaluateTopicFacts(registry, { target: { level: "city", countryCode: "ZZ", citySlug: "owner@example.invalid" }, platform: "<script>" as never, propertyType: null, topic: "host@example.invalid", asOf: "owner 987654321", use: "public" });
  assert.equal(invalid.overall, "invalid_request");
  assert.equal(invalid.target, null);
  assert.equal(invalid.topic, "<unknown>");
  assert.ok(!JSON.stringify(invalid).includes("example.invalid") && !JSON.stringify(invalid).includes("987654321") && !JSON.stringify(invalid).includes("script"));
  // an invalid target is reported by reason, not by echo
  const badTarget = evaluateTopicFacts(registry, { target: { level: "city", countryCode: "zz", citySlug: "owner@example.invalid" }, platform: null, propertyType: null, topic: "pricing-guide", asOf: AS_OF, use: "public" });
  assert.deepEqual(badTarget.reasons, ["invalid_target"]);
  assert.ok(!JSON.stringify(badTarget).includes("example.invalid"));
});

// --- S2.4: N2 revocations ---------------------------------------------------------------------

test("N2: a new observation overlapping a revoked series needs an explicit human arbitration before public use", () => {
  const build = () => {
    const registry = createFactRegistry();
    const v1 = priceFact();
    const revoked = priceFact({
      factId: "fact:fixture:fixture-city:price:2026q3:v2",
      version: 2,
      supersedes: v1.factId,
      collectedAt: "2026-09-05T10:00:00Z",
      validation: { status: "revoked", revokedAt: "2026-09-06T00:00:00Z", reason: "FIXTURE wrong data" },
      usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] },
      value: priceValue(112),
    });
    ok(registry, v1);
    ok(registry, revoked);
    return { registry, revoked };
  };
  const sneaky = (overrides: Record<string, unknown> = {}) =>
    priceFact({
      factId: "fact:fixture:fixture-city:price:sneaky",
      observedPeriod: { start: "2026-06-01", end: "2026-08-30" },
      collectedAt: "2026-09-07T10:00:00Z",
      validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-08T10:00:00Z", note: null },
      usage: { ...approvedFor(["pricing-guide"], "2026-09-09T10:00:00Z"), displayConstraints: [...MEASURED] },
      value: priceValue(112),
      ...overrides,
    });

  const { registry, revoked } = build();
  assert.equal(evaluate(registry, "pricing-guide", "public").overall, "blocked", "the revoked series gives nothing");
  // a new observation is possible (nothing is made impossible) ...
  ok(registry, sneaky());
  const sneakyId = "fact:fixture:fixture-city:price:sneaky" as FactId;
  assert.deepEqual(registry.unresolvedRevokedOverlaps(sneakyId, AS_OF), [revoked.factId]);
  // ... but it is not usable publicly until a human arbitrates
  assert.deepEqual(issueCodes(assessPublic(registry, sneakyId)), ["overlaps_revoked_series"]);
  const pending = evaluate(registry, "pricing-guide", "public");
  assert.equal(pending.overall, "needs_human_decision");
  assert.deepEqual(pending.reasons, ["revoked_series_overlap:nightly_price_distribution"]);
  assert.equal(pending.requirements[0]!.primaryIssue, "overlaps_revoked_series");
  assert.deepEqual(pending.requirements[0]!.revokedOverlapFactIds, [revoked.factId]);
  assert.equal(evaluate(registry, "pricing-guide", "internal").overall, "all_required_met", "internal analysis is not blocked");

  // arbitration is validated
  const arbitrate = (overrides: Record<string, unknown> = {}) =>
    registry.recordArbitration({ factId: sneakyId, revokedFactIds: [revoked.factId], arbiter: "fixture-arbiter", decidedAt: "2026-09-20T00:00:00Z", note: "FIXTURE decision", ...overrides } as never);
  const refusedWith = (overrides: Record<string, unknown>) => {
    const outcome = arbitrate(overrides);
    assert.equal(outcome.ok, false, JSON.stringify(overrides));
    return outcome.ok ? [] : outcome.issues.map((entry) => entry.code);
  };
  assert.deepEqual(refusedWith({ factId: "fact:fixture:never-registered" }), ["arbitration_invalid"]);
  assert.deepEqual(refusedWith({ revokedFactIds: [] }), ["arbitration_invalid"]);
  assert.deepEqual(refusedWith({ revokedFactIds: ["fact:fixture:fixture-city:price:2026q3:v1"] }), ["arbitration_invalid"], "not a revoked overlap");
  assert.deepEqual(refusedWith({ arbiter: " " }), ["arbitration_invalid"]);
  assert.deepEqual(refusedWith({ decidedAt: "2026-09-01T00:00:00" }), ["invalid_date"]);
  assert.deepEqual(refusedWith({ decidedAt: "2026-09-05T00:00:00Z" }), ["chronology"], "before the revocation");
  assert.deepEqual(refusedWith({ extra: 1 }), ["unknown_key"]);
  assert.equal(evaluate(registry, "pricing-guide", "public").overall, "needs_human_decision", "refused arbitrations change nothing");
  // a valid arbitration lifts only this blocker, and only from its own date
  assert.equal(arbitrate().ok, true);
  assert.equal(evaluate(registry, "pricing-guide", "public", "2026-09-19T00:00:00Z").overall, "needs_human_decision", "decided later than asOf");
  assert.equal(evaluate(registry, "pricing-guide", "public", "2026-09-20T00:00:00Z").overall, "all_required_met");
  assert.deepEqual(registry.unresolvedRevokedOverlaps(sneakyId, AS_OF), []);

  // observations that do not overlap, or belong to another segment, or to the replacement chain, are not flagged
  const other = build();
  ok(other.registry, sneaky({ observedPeriod: { start: "2026-09-02", end: "2026-09-02" }, collectedAt: "2026-09-07T10:00:00Z" }));
  assert.deepEqual(other.registry.unresolvedRevokedOverlaps(sneakyId, AS_OF), [], "disjoint period");
  const segment = build();
  ok(segment.registry, sneaky({ platform: "booking" }));
  assert.deepEqual(segment.registry.unresolvedRevokedOverlaps(sneakyId, AS_OF), [], "another platform");
  const chain = build();
  ok(chain.registry, priceFact({
    factId: "fact:fixture:fixture-city:price:2026q3:v3",
    version: 3,
    supersedes: chain.revoked.factId,
    collectedAt: "2026-09-05T11:00:00Z",
    value: priceValue(113),
    validation: { status: "human_validated", validatedBy: "fixture-reviewer-2", validatedAt: "2026-09-07T10:00:00Z", note: null },
    usage: { ...approvedFor(["pricing-guide"], "2026-09-08T10:00:00Z"), displayConstraints: [...MEASURED] },
  }));
  assert.deepEqual(chain.registry.unresolvedRevokedOverlaps("fact:fixture:fixture-city:price:2026q3:v3" as FactId, AS_OF), [], "the chain has its own revalidation rule");
  assert.equal(evaluate(chain.registry, "pricing-guide", "public").overall, "all_required_met");
  // a revoked fact is never reinstated by registering it again
  assert.match(refusedText(build().registry, priceFact({ factId: "fact:fixture:fixture-city:price:copy", value: priceValue(112), observedPeriod: { start: "2026-06-01", end: "2026-08-31" } })), /conflicting_values|duplicate_content/);
});

// --- S2.4: thresholds, subjects, approval scope, source restrictions ----------------------------

test("thresholds apply: age and confidence of an aligned requirement", () => {
  const evaluateAt = (overrides: Record<string, unknown>, asOf: string) => {
    const registry = createFactRegistry();
    ok(registry, priceFact({ validUntil: "2027-06-01T00:00:00Z", ...overrides }));
    return evaluate(registry, "pricing-guide", "public", asOf);
  };
  // period ends 2026-08-31, so the age counts from 2026-09-01: 90 days is allowed, 91 is not
  assert.equal(evaluateAt({}, "2026-11-30T00:00:00Z").overall, "all_required_met", "day 90");
  const old = evaluateAt({}, "2026-12-01T00:00:00Z");
  assert.equal(old.overall, "blocked", "day 91");
  assert.equal(old.missing[0]!.reason, "expired");
  assert.equal(evaluateAt({ confidence: { level: "moderate", rationale: "FIXTURE" } }, AS_OF).overall, "all_required_met");
  const weak = evaluateAt({ confidence: { level: "low", rationale: "FIXTURE" } }, AS_OF);
  assert.equal(weak.overall, "blocked");
  assert.equal(weak.missing[0]!.reason, "confidence_too_low");
});

test("subjects are exact: a fact relevant to another topic does not answer the page", () => {
  const registry = createFactRegistry();
  ok(registry, priceFact({ relevantTopics: ["pricing-guide"], usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED] } }));
  assert.equal(evaluate(registry, "pricing-guide", "public").overall, "all_required_met");
  const other = evaluate(registry, "pricing-positioning", "public");
  assert.equal(other.overall, "blocked");
  assert.equal(other.missing[0]!.reason, "absent");
  assert.equal(registry.findFacts({ target: TARGET, platform: null, propertyType: null, topic: "pricing-positioning" }).length, 0);
  assert.equal(registry.findFacts({ target: TARGET, platform: null, propertyType: null, topic: "pricing-guide" }).length, 1);
});

test("approval scope is per topic: a fact approved for one topic is not publishable for another", () => {
  const registry = createFactRegistry();
  const fact = priceFact({ relevantTopics: ["pricing-guide", "competitor-analysis"], usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED] } });
  ok(registry, fact);
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId, "pricing-guide")), []);
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId, "competitor-analysis")), ["approval_scope_excludes_topic"]);
  assert.deepEqual(issueCodes(assessPublic(registry, fact.factId, null)), ["approval_scope_excludes_topic"], "a topic-scoped approval needs a topic");
  const report = evaluate(registry, "competitor-analysis", "public");
  assert.equal(report.overall, "blocked");
  assert.equal(report.requirements[0]!.primaryIssue, "approval_scope_excludes_topic");
  assert.equal(report.missing[0]!.reason, "public_use_not_approved");
  // an any-topic approval is allowed for non-audit data
  const broad = createFactRegistry();
  const anyTopic = priceFact({ usage: { use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-03T10:00:00Z", scope: "any_topic" } }, displayConstraints: [...MEASURED] } });
  ok(broad, anyTopic);
  assert.deepEqual(issueCodes(assessPublic(broad, anyTopic.factId, "competitor-analysis")), []);
});

test("source restrictions are honoured at use time", () => {
  const withRestrictions = (restrictions: string[], overrides: Record<string, unknown> = {}) => {
    const registry = createFactRegistry();
    const fact = priceFact({ source: { ...licensedSource(), publicationRestrictions: restrictions }, ...overrides });
    ok(registry, fact);
    return issueCodes(assessPublic(registry, fact.factId));
  };
  assert.deepEqual(withRestrictions(["requires_licence_check"]), ["source_requires_licence_check"]);
  assert.deepEqual(withRestrictions(["no_derivative_figures"]), ["source_forbids_derivative_figures"]);
  assert.deepEqual(withRestrictions(["attribution_required"]), ["attribution_constraint_missing"]);
  assert.deepEqual(withRestrictions(["attribution_required"], { usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED, "attribute_source"] } }), []);
  assert.deepEqual(withRestrictions(["aggregate_only"]), [], "aggregate_only is fine for a quantitative figure");
  // aggregate_only on a non-quantitative fact: only aggregate publication is allowed, so a qualitative note is refused
  const registry = createFactRegistry();
  const note = editorialFact({ source: { ...editorialSource(), publicationRestrictions: ["aggregate_only"] } });
  ok(registry, note);
  assert.deepEqual(issueCodes(assessPublic(registry, note.factId, "first-photo")), ["source_aggregate_only"]);
  // no_public_use: an approval is refused outright; without approval the fact simply is not public
  assert.deepEqual(refusedCodes(createFactRegistry(), priceFact({ source: { ...licensedSource(), publicationRestrictions: ["no_public_use"] } })), ["approval_inconsistent"]);
  const unapproved = createFactRegistry();
  const restricted = priceFact({ source: { ...licensedSource(), publicationRestrictions: ["no_public_use"] }, usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } });
  ok(unapproved, restricted);
  assert.deepEqual(issueCodes(assessPublic(unapproved, restricted.factId)), ["public_use_not_approved", "source_forbids_public_use"]);
});

// --- Other retained behaviour -------------------------------------------------------------------

test("audit data: pending approval, drafts, internal use and privacy by key", () => {
  const registry = createFactRegistry();
  const pending = priceFact({ source: auditSource(), usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } });
  ok(registry, pending);
  assert.deepEqual(issueCodes(registry.assess(pending.factId, { asOf: AS_OF, use: "internal", topic: "pricing-guide" })!), []);
  assert.ok(issueCodes(assessPublic(registry, pending.factId)).includes("public_use_not_approved"));
  assert.equal(evaluate(registry, "pricing-guide", "internal").overall, "all_required_met");
  const blocked = evaluate(registry, "pricing-guide", "public");
  assert.equal(blocked.overall, "blocked");
  assert.equal(blocked.missing[0]!.reason, "public_use_not_approved");
  assert.deepEqual(refusedCodes(createFactRegistry(), priceFact({ source: auditSource(), value: priceValue(100, { workspaceId: "FIXTURE" }) })), ["privacy_violation", "unknown_key"]);
  const draft = priceFact({ source: auditSource(), validation: { status: "draft" }, usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] } });
  const draftRegistry = createFactRegistry();
  ok(draftRegistry, draft);
  assert.deepEqual(issueCodes(draftRegistry.assess(draft.factId, { asOf: AS_OF, use: "internal", topic: null })!), ["not_validated"]);
});

test("internal and public use are distinguished; source restrictions are honoured", () => {
  const registry = createFactRegistry();
  const pending = priceFact({
    validation: { status: "pending_review", submittedAt: "2026-09-02T10:00:00Z" },
    usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] },
  });
  ok(registry, pending);
  assert.deepEqual(issueCodes(registry.assess(pending.factId, { asOf: AS_OF, use: "internal", topic: null })!), []);
  assert.deepEqual(issueCodes(registry.assess(pending.factId, { asOf: AS_OF, use: "public", topic: null })!), ["not_validated", "public_use_not_approved"]);
  assert.deepEqual(refusedCodes(createFactRegistry(), priceFact({ validation: { status: "pending_review", submittedAt: "2026-09-02T10:00:00Z" } })), ["approval_inconsistent"]);
  assert.deepEqual(refusedCodes(createFactRegistry(), priceFact({ source: { ...licensedSource(), publicationRestrictions: ["no_public_use"] } })), ["approval_inconsistent"]);
  const strict = createFactRegistry();
  const unverified = priceFact({ source: { ...licensedSource(), termsOfUse: { status: "unverified", summary: null, reference: null }, publicationRestrictions: ["attribution_required"] } });
  ok(strict, unverified);
  assert.deepEqual(issueCodes(assessPublic(strict, unverified.factId)), ["attribution_constraint_missing", "source_terms_not_verified"]);
});

// --- S2.4: rules that another rule could otherwise mask ----------------------------------------

test("limits and diagnostics: each protection is exercised on its own", () => {
  // the total number of values is bounded even when every other limit is respected
  const wide = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`a${i}`, Object.fromEntries(Array.from({ length: 60 }, (__, j) => [`b${j}`, 1]))]));
  const tooMany = snapshotUntrustedFact(wide);
  assert.equal(tooMany.ok, false);
  assert.deepEqual(tooMany.ok ? [] : [...new Set(tooMany.issues.map((entry) => entry.code))], ["invalid_structure"]);
  assert.equal(snapshotUntrustedFact(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`a${i}`, Object.fromEntries(Array.from({ length: 30 }, (__, j) => [`b${j}`, 1]))]))).ok, true, "930 values are fine");
  // the cap on issues applies to the validation step too (not only to the snapshot)
  const flood = validateLocalFact({ ...priceFact(), relevantTopics: Array.from({ length: 50 }, (_, i) => `unknown-${i}`) });
  assert.equal(flood.length, 41);
  assert.equal(flood[40]!.code, "too_many_issues");
  // ... and to the snapshot step: 55 accessor properties would give 55 issues
  const accessors = {};
  for (let i = 0; i < 55; i += 1) Object.defineProperty(accessors, `a${i}`, { get: () => 1, enumerable: true });
  const capped = snapshotUntrustedFact(accessors);
  assert.equal(capped.ok, false);
  assert.equal(capped.ok ? 0 : capped.issues.length, 41);
  assert.equal(capped.ok ? "" : capped.issues[40]!.code, "too_many_issues");
  // paths built from raw keys are sanitised wherever they appear
  const registry = createFactRegistry();
  const leakyKey = refusedText(registry, priceFact({ source: auditSource(), value: priceValue(100, { workspaceId: "FIXTURE" }) }));
  assert.match(leakyKey, /privacy_violation:\$\.value\.<key>:/);
  assert.ok(!leakyKey.includes("workspaceId"), "the privacy validator's path must not echo the raw key");
  const textUnderOddKey = refusedText(registry, priceFact({ source: auditSource(), ["owner@example.invalid"]: "listing 123456789" }));
  assert.ok(!textUnderOddKey.includes("example.invalid") && !textUnderOddKey.includes("123456789"));
  assert.match(textUnderOddKey, /privacy_violation:<key>(?:\.<key>)*:/, "every segment of an unknown key is replaced");
});

test("N2: an arbitration cannot precede the revocation, whatever the observation's own dates", () => {
  const registry = createFactRegistry();
  const v1 = priceFact();
  ok(registry, v1);
  const revoked = priceFact({
    factId: "fact:fixture:fixture-city:price:2026q3:v2",
    version: 2,
    supersedes: v1.factId,
    collectedAt: "2026-09-05T10:00:00Z",
    validation: { status: "revoked", revokedAt: "2026-09-06T00:00:00Z", reason: "FIXTURE" },
    usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] },
    value: priceValue(112),
  });
  ok(registry, revoked);
  // the new observation was collected and validated BEFORE the revocation, so only the revocation date can refuse an early arbitration
  const early = priceFact({
    factId: "fact:fixture:fixture-city:price:early",
    observedPeriod: { start: "2026-06-01", end: "2026-08-30" },
    collectedAt: "2026-09-05T12:00:00Z",
    validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-05T13:00:00Z", note: null },
    usage: { ...approvedFor(["pricing-guide"], "2026-09-05T14:00:00Z"), displayConstraints: [...MEASURED] },
    value: priceValue(112),
  });
  ok(registry, early);
  const arbitrate = (decidedAt: string) =>
    registry.recordArbitration({ factId: early.factId, revokedFactIds: [revoked.factId], arbiter: "fixture-arbiter", decidedAt, note: "FIXTURE decision" });
  const tooEarly = arbitrate("2026-09-05T15:00:00Z");
  assert.equal(tooEarly.ok, false);
  assert.deepEqual(tooEarly.ok ? [] : tooEarly.issues.map((entry) => entry.code), ["chronology"]);
  assert.match(tooEarly.ok ? "" : tooEarly.issues[0]!.message, /revocation/);
  assert.equal(arbitrate("2026-09-06T00:00:00Z").ok, true, "the revocation instant itself is allowed");
});
