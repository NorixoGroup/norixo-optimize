import assert from "node:assert/strict";
import test from "node:test";

import { renderFactualClaim, selectionsFromFigures, type PriceStatistic } from "../lib/seo/v3/claimRender";
import { analyzeClaimText, fold, hasUnsupportedScript, screenLanguage } from "../lib/seo/v3/claimText";
import { validateClaim, validateGeneratedPage, type ClaimContext, type ClaimResult } from "../lib/seo/v3/claimValidation";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import type { FactSource } from "../lib/seo/v3/factSource";
import type { GeographicScope, LocalFact } from "../lib/seo/v3/localFact";
import { withLongStayRuleRequired } from "./seo-v3-longstay-required";

/**
 * S3 / S3.2 tests: validator of factual claims, deterministic rendering, text screening.
 *
 * Every value is a FIXTURE: "fixture-city" does not exist, country "ZZ" is a reserved code, publishers say
 * "test only", numbers are artificial. None of it is, or may become, public data.
 *
 *   npx tsx scripts/seo-v3-claim-validator.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const CITY = "fixture-city";
const TARGET: GeographicScope = { level: "city", countryCode: "ZZ", citySlug: CITY };
const PUBLISHER = "Fixture Publisher (test only)";
const MEASURED = ["show_sample_size", "show_observation_period", "show_confidence"] as const;
const UUID = "123e4567-e89b-12d3-a456-426614174000";

// --- fixtures -----------------------------------------------------------------------------------

const evidence = (): FactSource["evidence"] => [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }];
const licensed = (): FactSource => ({
  sourceId: "fixture-source-licensed", sourceType: "licensed_dataset", publisher: PUBLISHER, title: null,
  locator: { kind: "document_citation", citation: "FIXTURE - not a real publication" }, publishedAt: "2026-08-15",
  consultedAt: "2026-09-01T09:00:00Z", collectionMethod: { kind: "dataset_download", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: [], evidence: evidence(),
});
const auditSource = (): FactSource => ({
  ...licensed(), sourceId: "fixture-source-audit", sourceType: "user_audit_aggregate",
  locator: { kind: "internal_reference", reference: "fixture-artifact-key" },
  collectionMethod: { kind: "internal_aggregation", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-consent" }, publicationRestrictions: ["aggregate_only"],
  evidence: [{ kind: "internal_record", reference: "fixture-record" }],
});
const editorialSource = (): FactSource => ({
  ...licensed(), sourceId: "fixture-source-editorial", sourceType: "editorial_note",
  locator: { kind: "internal_reference", reference: "fixture-editorial-note" },
  collectionMethod: { kind: "editorial_judgement", description: "fixture" }, evidence: [{ kind: "internal_record", reference: "fixture-record" }],
});
const approvedFor = (topics: string[], approvedAt = "2026-09-03T10:00:00Z") => ({
  use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt, scope: topics } },
});

const PRICE_ID = "fact:fixture:fixture-city:price:2026q3:v1";
function priceFact(overrides: Record<string, unknown> = {}): LocalFact {
  return {
    factId: PRICE_ID, kind: "quantitative", scope: { ...TARGET }, platform: null, propertyType: null, unit: null, source: licensed(),
    collectedAt: "2026-09-01T10:00:00Z", observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, validUntil: "2026-12-01T00:00:00Z",
    confidence: { level: "high", rationale: "FIXTURE" },
    validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-02T10:00:00Z", note: null },
    usage: { ...approvedFor(["pricing-guide", "competitor-analysis"]), displayConstraints: [...MEASURED] },
    relevantTopics: ["pricing-guide", "competitor-analysis"], version: 1, supersedes: null,
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, p25: 90, p75: 130, sampleSize: 25 },
    ...overrides,
  } as LocalFact;
}
const priceValue = (median: number, extra: Record<string, unknown> = {}) => ({ metric: "nightly_price_distribution", currency: "EUR", median, sampleSize: 25, ...extra });

function unavailabilityFact(overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:unavailability:2026q3:v1", relevantTopics: ["occupancy-guide"],
    usage: { ...approvedFor(["occupancy-guide"]), displayConstraints: [...MEASURED, "label_as_unavailability_not_occupancy"] },
    value: { metric: "calendar_unavailability_rate", ratio: 0.42, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize: 25 },
    ...overrides,
  });
}
function editorialFact(overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: "fact:fixture:fixture-city:visual:2026:v1", kind: "qualitative", source: editorialSource(), observedPeriod: null,
    relevantTopics: ["first-photo"], usage: { ...approvedFor(["first-photo"]), displayConstraints: ["label_as_editorial_note"] },
    value: { category: "visual_character", statement: "FIXTURE sentence without any figure.", language: "en", basis: "editorial_observation" },
    ...overrides,
  });
}
const EARLY = { collectedAt: "2026-01-10T10:00:00Z", validUntil: "2026-12-31T00:00:00Z" };
const earlySource = (): FactSource => ({ ...licensed(), sourceType: "official_authority", consultedAt: "2026-01-10T09:00:00Z", publishedAt: "2026-01-01" });
const earlyValidation = { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-01-11T10:00:00Z", note: null };
const RULE_ID = "fact:fixture:fixture-city:rule:v1";
function ruleFact(value: Record<string, unknown>, overrides: Record<string, unknown> = {}): LocalFact {
  return priceFact({
    factId: RULE_ID, kind: "regulatory", source: earlySource(), ...EARLY, observedPeriod: null, relevantTopics: ["long-stay-guide"],
    validation: earlyValidation, usage: { ...approvedFor(["long-stay-guide"], "2026-01-12T10:00:00Z"), displayConstraints: [] },
    value: { ruleType: "minimum_stay", rule: "FIXTURE rule", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE reference", ...value },
    ...overrides,
  });
}
const timezoneFact = (zone = "Europe/Paris"): LocalFact =>
  priceFact({
    factId: "fact:fixture:fixture-city:timezone:v1", kind: "geographic", source: earlySource(), ...EARLY, observedPeriod: null,
    relevantTopics: ["long-stay-guide"], validation: earlyValidation, usage: { use: { publicUse: "forbidden" }, displayConstraints: [] },
    value: { attribute: "timezone", value: zone },
  });

const context = (overrides: Record<string, unknown> = {}): ClaimContext =>
  ({ target: TARGET, platform: null, propertyType: null, topic: "pricing-guide", asOf: AS_OF, use: "public", ...overrides }) as ClaimContext;

function registryWith(...facts: LocalFact[]): FactRegistry {
  const registry = createFactRegistry();
  for (const fact of facts) {
    const outcome = registry.register(fact);
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
  }
  return registry;
}

// --- rendering helpers: a factual claim is the deterministic rendering of its facts -------------------

function rendering(fact: LocalFact, statistic?: PriceStatistic) {
  const outcome = renderFactualClaim([{ fact, statistic }]);
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  return (outcome as Extract<typeof outcome, { ok: true }>).value;
}
const claim = (overrides: Record<string, unknown> = {}) => ({ claimId: "claim:c1", sectionId: "s1", ...overrides });
/** The only way to write an accepted factual claim: text, figures, citations and constraints all come from the renderer. */
function factualOf(fact: LocalFact, statistic?: PriceStatistic, overrides: Record<string, unknown> = {}) {
  const value = rendering(fact, statistic);
  return claim({ kind: "factual", text: value.text, supportingFactIds: [...value.supportingFactIds], figures: [...value.figures], inheritedDisplayConstraints: [...value.inheritedDisplayConstraints], ...overrides });
}

const PRICE = rendering(priceFact(), "median");
const PRICE_TEXT = PRICE.text;
const PRICE_FIGURES = [...PRICE.figures];
const priceClaim = (overrides: Record<string, unknown> = {}) =>
  claim({ kind: "factual", text: PRICE_TEXT, supportingFactIds: [PRICE_ID], figures: PRICE_FIGURES, inheritedDisplayConstraints: [...MEASURED], ...overrides });
const advice = (text: string, overrides: Record<string, unknown> = {}) => claim({ kind: "methodological_advice", text, ...overrides });
const editorial = (text: string, overrides: Record<string, unknown> = {}) => claim({ kind: "editorial_non_factual", text, ...overrides });
const hypothesis = (text: string, marker = "may", overrides: Record<string, unknown> = {}) =>
  claim({ kind: "explicit_hypothesis", text, hypothesisMarker: marker, basisFactIds: [], figures: [], ...overrides });
const pageOf = (claims: unknown[], used: string[], topic = "pricing-guide") => ({
  citySlug: CITY, topic, pathname: `/airbnb-optimizer/${CITY}/${topic}`,
  sections: [{ sectionId: "s1", heading: "Heading", claims }], usedFactIds: used, missingFacts: [], eligibility: {}, generator: {}, traceability: {},
});

const codesOf = (r: ClaimResult) => r.findings.map((f) => f.code);
const has = (r: ClaimResult, code: string) => codesOf(r).includes(code as never);
const valid = (registry: FactRegistry, raw: unknown, ctx: ClaimContext = context()) => validateClaim(raw, ctx, registry);
const notAccepted = (r: ClaimResult, label: string) => assert.notEqual(r.verdict, "accepted", `${label}: ${JSON.stringify(r.findings)}`);

/** A free-text hypothesis stating the median through a figure (the free-text path of figures; factual text never is free). */
const FIGURE_TAIL = "(confidence: high, 25 listings from 2026-06-01 to 2026-08-31)";
const figureHypothesis = (price: string, literal = "111.11", fact: LocalFact = priceFact(), extraWords = "") =>
  hypothesis(`The median nightly price may be about ${price}${extraWords} ${FIGURE_TAIL}.`, "may", {
    basisFactIds: [fact.factId],
    figures: [{ literal, factId: fact.factId, valuePath: "median" }, { literal: "25", factId: fact.factId, valuePath: "sampleSize" }],
  });

// --- 1-22 mandatory scenarios -------------------------------------------------------------------

test("1. a valid claim citing a usable fact in the exact context is accepted (claim and page)", () => {
  const registry = registryWith(priceFact());
  const r = valid(registry, priceClaim());
  assert.equal(r.verdict, "accepted", JSON.stringify(r.findings));
  assert.deepEqual(r.findings, []);
  const page = validateGeneratedPage(pageOf([priceClaim()], [PRICE_ID]), context(), registry);
  assert.equal(page.verdict, "accepted", JSON.stringify(page));
  assert.deepEqual(page.counts, { accepted: 1, rejected: 0, needs_data: 0, needs_human_decision: 0 });
  assert.equal(validateGeneratedPage(pageOf([], []), context(), registry).verdict, "accepted", "an empty page asserts nothing");
});

test("2. a reference to a fact that does not exist is rejected, and the unknown id is not echoed", () => {
  const registry = registryWith(priceFact());
  const r = valid(registry, priceClaim({ supportingFactIds: ["fact:fixture:unknown-city:ghost-fact"], figures: [], text: "The median nightly price is described by FIXTURE data." }));
  assert.equal(r.verdict, "rejected");
  assert.ok(has(r, "fact_not_found"));
  assert.ok(!JSON.stringify(r).includes("ghost-fact"), "the caller's unknown id is never echoed");
  // an id of the wrong shape is a malformed claim, not a lookup
  assert.deepEqual(codesOf(valid(registry, priceClaim({ supportingFactIds: ["fact:fixture:owner@example.invalid:ghost"] }))), ["malformed_claim"]);
});

test("3. an expired fact makes the claim wait for data", () => {
  const registry = registryWith(priceFact());
  const r = valid(registry, priceClaim(), context({ asOf: "2026-12-02T00:00:00Z" }));
  assert.equal(r.verdict, "needs_data");
  assert.ok(has(r, "fact_expired"));
  assert.notEqual(r.verdict, "accepted");
});

test("4. revoked and superseded facts are rejected, with distinct codes", () => {
  const v1 = priceFact();
  const revoked = priceFact({
    factId: "fact:fixture:fixture-city:price:2026q3:v2", version: 2, supersedes: PRICE_ID, collectedAt: "2026-09-05T10:00:00Z",
    validation: { status: "revoked", revokedAt: "2026-09-06T00:00:00Z", reason: "FIXTURE" },
    usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] }, value: priceValue(112),
  });
  const registry = registryWith(v1, revoked);
  const onRevoked = valid(registry, factualOf(revoked, "median"));
  assert.equal(onRevoked.verdict, "rejected");
  assert.ok(has(onRevoked, "fact_revoked"));
  const severityOf = (r: ClaimResult, code: string) => r.findings.find((f) => f.code === (code as never))?.severity;
  assert.equal(severityOf(onRevoked, "fact_revoked"), "rejected", "the revocation itself is a rejection, not a wait");
  const onSuperseded = valid(registry, priceClaim());
  assert.equal(severityOf(onSuperseded, "fact_superseded"), "rejected");
  assert.equal(onSuperseded.verdict, "rejected");
  assert.ok(has(onSuperseded, "fact_superseded"));
  assert.ok(!has(onSuperseded, "fact_revoked"));
});

test("5. a fact derived from user audits is never publishable, even when everything else is in order", () => {
  const audit = priceFact({ source: auditSource() });
  const registry = registryWith(audit);
  const r = valid(registry, priceClaim());
  assert.equal(r.verdict, "rejected");
  assert.ok(has(r, "fact_audit_public_use_locked"));
  assert.deepEqual(r.findings.filter((f) => f.severity === "rejected").map((f) => f.code), ["fact_audit_public_use_locked"]);
  assert.equal(validateGeneratedPage(pageOf([priceClaim()], [PRICE_ID]), context(), registry).verdict, "rejected");
});

test("6-10. the wrong city, country, granularity, platform, property type or topic is rejected", () => {
  const registry = registryWith(priceFact());
  const expectations: [string, Record<string, unknown>, string][] = [
    ["6 city", { target: { level: "city", countryCode: "ZZ", citySlug: "other-city" } }, "fact_city_mismatch"],
    ["7 country", { target: { level: "city", countryCode: "YY", citySlug: CITY } }, "fact_country_mismatch"],
    ["granularity", { target: { level: "district", countryCode: "ZZ", citySlug: CITY, districtName: "FIXTURE district" } }, "fact_granularity_mismatch"],
    ["8 platform", { platform: "booking" }, "fact_platform_mismatch"],
    ["9 property type", { propertyType: "hotel" }, "fact_property_type_mismatch"],
    ["10 topic", { topic: "occupancy-guide" }, "fact_topic_mismatch"],
  ];
  for (const [label, override, code] of expectations) {
    const r = valid(registry, priceClaim(), context(override));
    assert.equal(r.verdict, "rejected", label);
    assert.deepEqual(r.findings.filter((f) => f.code.startsWith("fact_")).map((f) => f.code), [code], label);
  }
  // a Booking fact does not answer an Airbnb page either; a rendering names the platform it comes from
  const bookingFact = priceFact({ platform: "booking" });
  const booking = registryWith(bookingFact);
  assert.ok(has(valid(booking, factualOf(bookingFact, "median"), context({ platform: "airbnb" })), "fact_platform_mismatch"));
  assert.equal(valid(booking, factualOf(bookingFact, "median"), context({ platform: "booking" })).verdict, "accepted");
  assert.ok(rendering(bookingFact, "median").text.includes("platform: Booking.com"));
});

test("11-12. numbers that no fact supports are rejected, structurally or in the text", () => {
  const registry = registryWith(priceFact());
  const invented = valid(registry, priceClaim({ text: PRICE_TEXT.replace("€111.11", "€120") }));
  assert.equal(invented.verdict, "rejected");
  assert.ok(has(invented, "unbacked_number"));
  assert.ok(has(invented, "figure_not_in_text"), "the declared figure is no longer in the text");
  const wrongValue = valid(registry, priceClaim({ text: PRICE_TEXT.replace("€111.11", "€120"), figures: [{ literal: "120", factId: PRICE_ID, valuePath: "median" }, PRICE_FIGURES[1]] }));
  assert.ok(has(wrongValue, "figure_value_mismatch"));
  const percent = valid(registry, priceClaim({ text: `${PRICE_TEXT} About 12% of the listings are small.` }));
  assert.equal(percent.verdict, "rejected");
  assert.ok(has(percent, "unbacked_number"));
  const hidden = valid(registry, priceClaim({ text: `${PRICE_TEXT} Stays last 3 nights.`, figures: PRICE_FIGURES }));
  assert.ok(has(hidden, "unbacked_number"), "a number missing from `figures` is caught in the text");
  const spelled = valid(registry, priceClaim({ text: `${PRICE_TEXT} Twenty percent of hosts agree.` }));
  assert.ok(has(spelled, "unbacked_number"));
});

test("13. a comparison, a trend or a superlative is refused: S3 has no calculation engine", () => {
  const registry = registryWith(priceFact());
  for (const [label, extra, code] of [
    ["comparison", " The price is higher than last year.", "unsupported_comparison"],
    ["double", " The price is twice the usual one.", "unsupported_comparison"],
    ["trend", " Prices rose during the summer.", "unsupported_trend"],
    ["superlative", " It is the best price in the market.", "unsupported_superlative"],
    ["generalisation", " Every host charges it.", "overgeneralization"],
  ] as const) {
    const r = valid(registry, priceClaim({ text: PRICE_TEXT + extra }));
    assert.equal(r.verdict, "rejected", label);
    assert.ok(has(r, code), `${label}: ${codesOf(r).join(",")}`);
  }
  // even a comparison between two figures of the same fact is refused (no verified arithmetic)
  const both = valid(registry, priceClaim({ text: `${PRICE_TEXT} The p75 of €130 is higher than the median.`, figures: [...PRICE_FIGURES, { literal: "130", factId: PRICE_ID, valuePath: "p75" }] }));
  assert.ok(has(both, "unsupported_comparison"));
});

test("14. advice presented as a guarantee, a demonstrated result or a local fact is rejected; plain advice passes", () => {
  const registry = registryWith(priceFact());
  assert.equal(valid(registry, advice("Choose a first photo that shows the main room clearly.")).verdict, "accepted");
  assert.equal(valid(registry, advice("This will double your bookings, guaranteed.")).verdict, "rejected");
  assert.ok(has(valid(registry, advice("A new title guarantees more bookings.")), "guarantee_wording"));
  assert.ok(has(valid(registry, advice("Sharper photos lead to more bookings.")), "causal_wording"));
  assert.equal(valid(registry, advice("Sharper photos can lead to more bookings.")).verdict, "accepted", "a hedged causal formulation is advice");
  assert.equal(valid(registry, advice("A new title does not guarantee more bookings.")).verdict, "accepted", "an explicit disclaimer is fine");
  assert.ok(has(valid(registry, advice("Prices rose by 10% last year.")), "number_in_non_factual"));
  assert.ok(has(valid(registry, advice("The average price is high here.")), "average_wording_unsupported"));
  assert.ok(has(valid(registry, advice("The regulation requires a licence.")), "regulatory_claim_without_regulatory_fact"));
  assert.ok(has(valid(registry, advice("Travelers prefer quiet streets.")), "preference_claim_without_fact"));
  assert.ok(has(valid(registry, advice("Airbnb recommends a short title.")), "platform_authority_unsupported"));
  assert.ok(has(valid(registry, advice("According to the data, photos matter.")), "vague_attribution"));
  assert.ok(has(valid(registry, advice("The best neighbourhood is the most profitable.")), "unsupported_superlative"));
  assert.ok(has(valid(registry, advice("Photos clearly prove their worth.")), "certainty_wording"));
  assert.ok(has(valid(registry, advice("Prices increase in summer.")), "unsupported_trend"));
  assert.ok(has(valid(registry, advice("Demand is high in summer.")), "demand_claim_without_fact"));
  assert.ok(has(valid(registry, advice("A recent study found that photos matter.")), "observation_wording"));
  // figures or cited facts are not allowed on advice
  assert.ok(has(valid(registry, advice("Choose a clear photo.", { figures: [{ literal: "1", factId: PRICE_ID, valuePath: "median" }] })), "figures_not_allowed"));
  assert.ok(has(valid(registry, advice("Choose a clear photo.", { supportingFactIds: [PRICE_ID] })), "supporting_facts_not_allowed"));
  // numbering that is only structure is not a quantitative claim
  assert.equal(valid(registry, advice("1. Choose a clear first photo for the listing.\nStep 2: write a precise title for the page.")).verdict, "accepted");
});

test("15. a hypothesis must read as one; it is never a certainty, an observation or a rule", () => {
  const registry = registryWith(priceFact());
  assert.equal(valid(registry, hypothesis("Brighter photos may help guests to understand the space.")).verdict, "accepted");
  assert.ok(has(valid(registry, hypothesis("Brighter photos improve every booking.")), "hypothesis_marker_missing"));
  assert.ok(has(valid(registry, hypothesis("Brighter photos prove that guests book more, and it may be so.")), "certainty_wording"));
  assert.ok(has(valid(registry, hypothesis("Data shows that photos might matter.")), "hypothesis_as_observation"));
  assert.ok(has(valid(registry, hypothesis("The regulation might require a licence.")), "hypothesis_as_rule"));
  assert.ok(has(valid(registry, hypothesis("Photos indeed matter.", "indeed")), "hypothesis_marker_unrecognised"));
  assert.ok(has(valid(registry, hypothesis("Photos may be worth 15 euros per night.")), "unbacked_number"), "a hypothetical number still needs a fact");
  assert.ok(has(valid(registry, hypothesis("Photos may matter.", "may", { figures: [{ literal: "1", factId: PRICE_ID, valuePath: "median" }] })), "figure_fact_not_cited"));
});

test("16. a regulatory claim outside the rule's period is rejected; a valid rule is never auto-accepted", () => {
  withLongStayRuleRequired(() => {
  const ctx = context({ topic: "long-stay-guide", asOf: "2026-06-01T00:00:00Z" });
  const ended = registryWith(timezoneFact(), ruleFact({ effectiveFrom: "2020-01-01", effectiveUntil: "2026-05-01" }));
  const endedClaim = factualOf(ruleFact({ effectiveFrom: "2020-01-01", effectiveUntil: "2026-05-01" }));
  const r = valid(ended, endedClaim, ctx);
  assert.equal(r.verdict, "rejected");
  assert.ok(has(r, "fact_rule_no_longer_in_force"));
  const futureRule = ruleFact({ effectiveFrom: "2026-11-01", effectiveUntil: null });
  const future = registryWith(timezoneFact(), futureRule);
  assert.ok(has(valid(future, factualOf(futureRule), ctx), "fact_rule_not_yet_in_force"));
  // a rule in force still waits for a human: the requirement's threshold is provisional
  const current = ruleFact({});
  const inForce = registryWith(timezoneFact(), current);
  const ok = valid(inForce, factualOf(current), ctx);
  assert.equal(ok.verdict, "needs_human_decision");
  assert.deepEqual(codesOf(ok), ["requirement_threshold_unconfirmed"]);
  // no known zone: the dates cannot be evaluated
  assert.equal(valid(registryWith(ruleFact({})), factualOf(current), ctx).verdict, "needs_data");
  // regulatory wording without a regulatory fact is rejected even when a price fact is cited
  assert.ok(has(valid(registryWith(priceFact()), priceClaim({ text: `${PRICE_TEXT} The regulation requires registration.` })), "regulatory_claim_without_regulatory_fact"));
  // the date in the text must be a date of the cited rule
  assert.ok(has(valid(inForce, factualOf(current, undefined, { text: "FIXTURE rule (in force from 2026-02-02)" }), ctx), "unbacked_date"));
  });
});

test("17-18. contradictions between claims are flagged; observations of different periods are not contradictions", () => {
  const first = priceFact();
  const second = priceFact({ factId: "fact:fixture:fixture-city:price:second", observedPeriod: { start: "2026-07-01", end: "2026-08-31" }, value: priceValue(500) });
  const registry = registryWith(first, second);
  const page = validateGeneratedPage(pageOf([factualOf(first, "median", { claimId: "claim:a" }), factualOf(second, "median", { claimId: "claim:b" })], [first.factId, second.factId]), context(), registry);
  assert.equal(page.verdict, "needs_human_decision");
  assert.ok(page.findings.some((f) => f.code === "claims_cite_contradictory_facts"));
  assert.ok(page.claims.every((c) => c.findings.some((f) => f.code === "claims_cite_contradictory_facts")));
  assert.ok(page.claims.every((c) => c.findings.some((f) => f.code === "fact_contradicted")));
  assert.ok(!JSON.stringify(page).includes("500"), "no value leaks through the diagnostics");
  // different, disjoint periods, both usable: no contradiction
  const june = priceFact({ observedPeriod: { start: "2026-06-01", end: "2026-07-31" }, collectedAt: "2026-08-05T10:00:00Z", source: { ...licensed(), consultedAt: "2026-08-05T09:00:00Z", publishedAt: "2026-08-01" }, validation: { status: "human_validated", validatedBy: "r", validatedAt: "2026-08-06T10:00:00Z", note: null }, usage: { ...approvedFor(["pricing-guide"], "2026-08-07T10:00:00Z"), displayConstraints: [...MEASURED] }, value: priceValue(90) });
  const august = priceFact({ factId: "fact:fixture:fixture-city:price:august", observedPeriod: { start: "2026-08-01", end: "2026-08-31" }, value: priceValue(120) });
  const disjoint = validateGeneratedPage(
    pageOf([factualOf(june, "median", { claimId: "claim:a" }), factualOf(august, "median", { claimId: "claim:b" })], [june.factId, august.factId]),
    context({ asOf: "2026-09-10T00:00:00Z" }),
    registryWith(june, august),
  );
  assert.equal(disjoint.verdict, "accepted", JSON.stringify(disjoint));
});

test("19. a pending human decision never becomes a permission", () => {
  // approval still to be given
  const pending = priceFact({ usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } });
  const r = valid(registryWith(pending), priceClaim());
  assert.equal(r.verdict, "needs_human_decision");
  assert.ok(has(r, "fact_public_use_not_approved"));
  // validation still to be done
  const review = priceFact({ validation: { status: "pending_review", submittedAt: "2026-09-02T10:00:00Z" }, usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } });
  assert.equal(valid(registryWith(review), priceClaim()).verdict, "needs_human_decision");
  // an unconfirmed provisional threshold (calendar unavailability)
  const unavailable = unavailabilityFact();
  const ua = valid(registryWith(unavailable), factualOf(unavailable), context({ topic: "occupancy-guide" }));
  assert.equal(ua.verdict, "needs_human_decision");
  assert.deepEqual(codesOf(ua), ["requirement_threshold_unconfirmed"]);
  // an observation overlapping a revoked series awaits arbitration
  const v1 = priceFact();
  const revoked = priceFact({ factId: "fact:fixture:fixture-city:price:2026q3:v2", version: 2, supersedes: PRICE_ID, collectedAt: "2026-09-05T10:00:00Z", validation: { status: "revoked", revokedAt: "2026-09-06T00:00:00Z", reason: "FIXTURE" }, usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] }, value: priceValue(112) });
  const sneaky = priceFact({ factId: "fact:fixture:fixture-city:price:sneaky", observedPeriod: { start: "2026-06-01", end: "2026-08-30" }, collectedAt: "2026-09-07T10:00:00Z", validation: { status: "human_validated", validatedBy: "r", validatedAt: "2026-09-08T10:00:00Z", note: null }, usage: { ...approvedFor(["pricing-guide"], "2026-09-09T10:00:00Z"), displayConstraints: [...MEASURED] }, value: priceValue(112) });
  const sneakyClaim = factualOf(sneaky, "median");
  const overlapping = registryWith(v1, revoked, sneaky);
  const so = valid(overlapping, sneakyClaim);
  assert.equal(so.verdict, "needs_human_decision");
  assert.ok(has(so, "fact_overlaps_revoked_series"));
  overlapping.recordArbitration({ factId: sneaky.factId, revokedFactIds: [revoked.factId], arbiter: "fixture-arbiter", decidedAt: "2026-09-20T00:00:00Z", note: "FIXTURE" });
  assert.equal(valid(overlapping, sneakyClaim).verdict, "accepted", "only the explicit human arbitration lifts it");
});

test("20. malformed input is rejected cleanly, never thrown", () => {
  const registry = registryWith(priceFact());
  let reads = 0;
  const withGetter = Object.defineProperty({ ...priceClaim() }, "text", { enumerable: true, get: () => { reads += 1; return PRICE_TEXT; } });
  const cyclic: Record<string, unknown> = { ...priceClaim() };
  cyclic.self = cyclic;
  const bad: [string, unknown][] = [
    ["null", null], ["string", "claim"], ["array", []], ["number", 7],
    ["no kind", claim({ text: "x" })], ["unknown kind", claim({ kind: "opinion", text: "x" })],
    ["bad id", priceClaim({ claimId: "c1" })], ["missing text", priceClaim({ text: undefined })], ["empty text", priceClaim({ text: "  " })],
    ["huge text", priceClaim({ text: "x".repeat(1500) })], ["unknown key", priceClaim({ secret: "x" })],
    ["no supporting facts", priceClaim({ supportingFactIds: [] })], ["bad fact id", priceClaim({ supportingFactIds: ["nope"] })],
    ["bad figure", priceClaim({ figures: [{ literal: "1", factId: PRICE_ID }] })], ["figure extra key", priceClaim({ figures: [{ literal: "1", factId: PRICE_ID, valuePath: "median", x: 1 }] })],
    ["bad constraint", priceClaim({ inheritedDisplayConstraints: ["whatever"] })], ["accessor", withGetter], ["cycle", cyclic],
    ["Proxy", new Proxy(priceClaim(), {})], ["class instance", new (class C { kind = "factual"; })()],
  ];
  for (const [label, raw] of bad) {
    let r: ClaimResult | undefined;
    assert.doesNotThrow(() => { r = valid(registry, raw); }, label);
    assert.equal(r!.verdict, "rejected", label);
    assert.deepEqual(codesOf(r!), ["malformed_claim"], label);
  }
  assert.equal(reads, 0, "an accessor is never invoked");
  // a malformed context or page
  for (const badContext of [null, "x", { ...context(), use: "internal" }, { ...context(), topic: "made-up" }, { ...context(), asOf: "yesterday" }, { ...context(), target: { level: "city", countryCode: "zz", citySlug: CITY } }, { ...context(), platform: "myspace" }]) {
    assert.deepEqual(codesOf(valid(registry, priceClaim(), badContext as ClaimContext)), ["invalid_context"]);
  }
  for (const badPage of [null, "x", [], { sections: "no" }, { ...pageOf([], []), sections: [7] }]) {
    const p = validateGeneratedPage(badPage, context(), registry);
    assert.equal(p.verdict, "rejected");
    assert.ok(p.findings.some((f) => f.code === "malformed_input"));
  }
  assert.ok(validateGeneratedPage(pageOf([], []), { ...context(), use: "internal" }, registry).findings.some((f) => f.code === "invalid_context"));
});

const ALLOWED_REF = /^(claim|page|topic|citySlug|context|usedFactIds|claims|sections|fact|hypothesisMarker|figures|supportingFactIds|basisFactIds|inheritedDisplayConstraints|sentence\[\d+\]|token\[\d+\]:[a-z]+|figures\[\d+\]|supportingFactIds\[\d+\]|basisFactIds\[\d+\])$/;

test("21. diagnostics never carry text, numbers, unknown identifiers or private data", () => {
  const audit = priceFact({ source: auditSource() });
  const registry = registryWith(audit);
  const sensitive = `listing 123456789 owner host@example.invalid https://www.airbnb.com/rooms/1 ${UUID}`;
  const results = [
    valid(registry, priceClaim({ text: `${PRICE_TEXT} ${sensitive}` })),
    valid(registry, advice(`Contact host@example.invalid about ${UUID} and ${sensitive}`)),
    valid(registry, priceClaim({ supportingFactIds: [`fact:${UUID}:ghost`], figures: [] })),
    valid(registry, { ...priceClaim(), claimId: `claim:${UUID}`, secret: sensitive }),
    valid(registry, priceClaim({ text: `${sensitive} 987654321 €777` })),
  ];
  const page = validateGeneratedPage(pageOf([priceClaim({ text: `${PRICE_TEXT} ${sensitive}` })], ["fact:made-up-id-owner@example.invalid"]), context(), registry);
  for (const text of [...results.map((r) => JSON.stringify(r)), JSON.stringify(page)]) {
    for (const forbidden of ["123456789", "987654321", "example.invalid", "airbnb.com", UUID, "€777", "777", "owner", "111.11"]) {
      assert.ok(!text.includes(forbidden), `diagnostics must not contain "${forbidden}"`);
    }
  }
  assert.equal(results[3]!.claimId, null, "a claim id of the wrong shape is not echoed");
  // only stable codes, structural references and ids of facts that exist
  for (const r of results) for (const f of r.findings) assert.match(f.ref, ALLOWED_REF);
});

test("22. the verdict is identical on two runs, the registry is never modified, and input is not mutated", () => {
  const registry = registryWith(priceFact(), unavailabilityFact());
  const before = JSON.stringify(registry.list());
  const input = pageOf([priceClaim({ claimId: "claim:a" }), advice("Choose a clear photo for the first image of the listing.", { claimId: "claim:b" }), hypothesis("Photos may help guests to understand the space.", "may", { claimId: "claim:c" }), editorial("Let us now turn to the next step.", { claimId: "claim:d" })], [PRICE_ID]);
  const frozen = structuredClone(input);
  const first = JSON.stringify(validateGeneratedPage(input, context(), registry));
  const second = JSON.stringify(validateGeneratedPage(input, context(), registry));
  assert.equal(first, second);
  assert.equal(JSON.stringify(registry.list()), before);
  assert.equal(registry.size(), 2);
  assert.deepEqual(input, frozen);
  const reordered = JSON.stringify(validateGeneratedPage(pageOf([...input.sections[0]!.claims].reverse(), [PRICE_ID]), context(), registry));
  assert.equal(JSON.parse(reordered).verdict, JSON.parse(first).verdict);
  assert.equal(JSON.parse(first).verdict, "accepted", first);
  // no clock, network or randomness
  const realNow = Date.now; const realFetch = globalThis.fetch; const realRandom = Math.random;
  Date.now = () => { throw new Error("clock"); }; Math.random = () => { throw new Error("random"); }; globalThis.fetch = (() => { throw new Error("network"); }) as typeof fetch;
  try { assert.equal(JSON.stringify(validateGeneratedPage(input, context(), registry)), first); } finally { Date.now = realNow; Math.random = realRandom; globalThis.fetch = realFetch; }
});

// --- numbers and units ----------------------------------------------------------------------------

test("figures: units, currencies and the only accepted transformations (identity, rounding, ratio as percent)", () => {
  const registry = registryWith(priceFact());
  const priced = (price: string, literal = "111.11") => valid(registry, figureHypothesis(price, literal));
  assert.equal(priced("€111.11").verdict, "accepted", JSON.stringify(priced("€111.11").findings));
  assert.equal(priced("111.11 EUR").verdict, "accepted");
  assert.equal(priced("111.11 euros").verdict, "accepted");
  assert.equal(priced("€111.1", "111.1").verdict, "accepted", "rounding to fewer decimals");
  assert.equal(priced("€111", "111").verdict, "accepted", "rounding to the unit");
  assert.ok(has(priced("€112", "112"), "figure_value_mismatch"), "a wrongly rounded value");
  assert.ok(has(priced("€111.12", "111.12"), "figure_value_mismatch"), "more decimals than the fact");
  assert.ok(has(priced("$111.11"), "figure_currency_mismatch"));
  assert.ok(has(priced("£111.11"), "figure_currency_mismatch"));
  assert.ok(has(priced("111.11"), "figure_unit_missing"), "a price needs its currency");
  assert.ok(has(priced("111.11%"), "figure_unit_missing"));
  const unavailable = unavailabilityFact();
  const ratioClaim = (from: string, to: string, literal: string) =>
    valid(registryWith(unavailable), factualOf(unavailable, undefined, { text: rendering(unavailable).text.replace(from, to), figures: rendering(unavailable).figures.map((f) => (f.valuePath === "ratio" ? { ...f, literal } : f)) }), context({ topic: "occupancy-guide" }));
  assert.ok(has(ratioClaim("42%", "43%", "43"), "figure_value_mismatch"));
  assert.ok(has(ratioClaim("42%", "42 euros", "42"), "figure_value_mismatch"));
  // unsupported paths, uncited facts and invalid literals
  assert.ok(has(valid(registry, priceClaim({ figures: [{ literal: "111.11", factId: PRICE_ID, valuePath: "mean" }, PRICE_FIGURES[1]] })), "figure_value_unsupported"));
  assert.ok(has(valid(registry, priceClaim({ figures: [{ literal: "abc", factId: PRICE_ID, valuePath: "median" }, PRICE_FIGURES[1]] })), "figure_invalid"));
  assert.ok(has(valid(registry, priceClaim({ figures: [...PRICE_FIGURES, { literal: "5", factId: "fact:fixture:fixture-city:other", valuePath: "median" }] })), "figure_fact_not_cited"));
  // a figure for the sample size must really be a count of listings
  assert.ok(has(valid(registry, priceClaim({ text: PRICE_TEXT.replace("25 listings", "25% of listings") })), "unbacked_number"));
  // thousands and decimal separators are read both ways
  const big = priceFact({ factId: "fact:fixture:fixture-city:price:big", value: priceValue(1234.5) });
  const bigRegistry = registryWith(big);
  assert.equal(valid(bigRegistry, figureHypothesis("€1,234.50", "1,234.50", big)).verdict, "accepted");
  assert.equal(valid(bigRegistry, figureHypothesis("1 234,50 €", "1 234,50", big)).verdict, "accepted");
  assert.equal(rendering(big, "median").text.includes("€1234.50"), true, "the rendering writes the plain decimal form");
  // dates and years
  assert.ok(has(valid(registry, priceClaim({ text: PRICE_TEXT.replace("2026-06-01", "2026-06-02") })), "unbacked_date"));
  { const yr = valid(registry, figureHypothesis("€111.11", "111.11", priceFact(), " in 2026")); assert.equal(yr.verdict, "accepted", JSON.stringify(yr.findings)); }
  assert.ok(has(valid(registry, figureHypothesis("€111.11", "111.11", priceFact(), " in 2031")), "unbacked_number"));
});

test("text analysis: numbers by category, structural numbers, listed wordings", () => {
  const kinds = (text: string) => analyzeClaimText(text).tokens.filter((t) => !t.structural).map((t) => t.category);
  assert.deepEqual(kinds("€111.11 and 25 listings for 3 nights, 5 km away, 12%, 2026-06-01, in 2026, twice"), ["currency", "quantity", "duration", "distance", "percent", "date", "year"]);
  assert.deepEqual(analyzeClaimText("1. First. Step 2 is here.").tokens.map((t) => t.structural), [true, true]);
  assert.deepEqual(kinds("Twenty percent of hosts"), ["quantity"], "spelled-out numbers are quantities that no figure can back");
  assert.deepEqual(kinds("A clear first photo"), []);
  assert.ok(analyzeClaimText("Le prix moyen est de 100 €.").hits.has("average"));
  assert.ok(analyzeClaimText("Les voyageurs préfèrent le calme.").hits.has("preference"));
  assert.ok(analyzeClaimText("La réglementation impose une déclaration.").hits.has("regulatory"));
  assert.ok(analyzeClaimText("Airbnb recommande un titre court.").hits.has("platform_authority"));
  assert.ok(analyzeClaimText("Selon les données, la demande augmente.").hits.has("vague_attribution"));
  assert.ok(analyzeClaimText("Ce quartier est le plus rentable.").hits.has("market_superlative"));
  assert.ok(analyzeClaimText("Les revenus augmentent de 10 %.").hits.has("trend_claim"));
  assert.ok(analyzeClaimText("Cela garantit plus de réservations.").hits.has("guarantee"));
  assert.equal(analyzeClaimText("Choose a clear first photo.").hits.size, 0);
});

// --- display obligations carried by facts ---------------------------------------------------------

test("display obligations: sample size, period, confidence, attribution, labels and benchmark language", () => {
  const registry = registryWith(priceFact());
  const codes = (text: string, figures = PRICE_FIGURES, inherited: readonly string[] = MEASURED) => codesOf(valid(registry, priceClaim({ text, figures, inheritedDisplayConstraints: [...inherited] })));
  assert.ok(codes(PRICE_TEXT.replace("25 listings observed ", ""), [PRICE_FIGURES[0]!]).includes("display_sample_size_missing"));
  assert.ok(codes(PRICE_TEXT.replace(" from 2026-06-01 to 2026-08-31", "")).includes("display_period_missing"));
  assert.ok(codes(PRICE_TEXT.replace("confidence: high, ", "")).includes("display_confidence_missing"));
  assert.ok(codes(PRICE_TEXT.replace("confidence: high", "confidence: low")).includes("display_confidence_missing"), "the level written must be the level of the fact");
  assert.ok(codes(PRICE_TEXT, PRICE_FIGURES, ["show_sample_size"]).includes("inherited_constraints_incomplete"));
  // attribution
  const attributedFact = priceFact({ source: { ...licensed(), publicationRestrictions: ["attribution_required"] }, usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED, "attribute_source"] } });
  const attributed = registryWith(attributedFact);
  assert.deepEqual(codesOf(valid(attributed, factualOf(attributedFact, "median"))), []);
  assert.ok(codesOf(valid(attributed, factualOf(attributedFact, "median", { text: rendering(attributedFact, "median").text.replace(`, source: ${PUBLISHER}`, "") }))).includes("display_attribution_missing"));
  // the "no benchmark language" obligation
  const noBenchmarkFact = priceFact({ usage: { ...approvedFor(["pricing-guide"]), displayConstraints: [...MEASURED, "no_benchmark_language"] } });
  const noBenchmark = registryWith(noBenchmarkFact);
  const benchmarked = (text: string) => codesOf(valid(noBenchmark, factualOf(noBenchmarkFact, "median", { text })));
  assert.ok(benchmarked(`${rendering(noBenchmarkFact, "median").text} It is the market rate.`).includes("display_benchmark_language"));
  assert.deepEqual(codesOf(valid(noBenchmark, factualOf(noBenchmarkFact, "median"))), []);
  // unavailability is never occupancy, and a negation does not make the word acceptable
  const unavailable = unavailabilityFact();
  const base = rendering(unavailable).text;
  const unavailability = (text: string) => codesOf(valid(registryWith(unavailable), factualOf(unavailable, undefined, { text }), context({ topic: "occupancy-guide" })));
  assert.ok(unavailability(base.replace("unavailable", "closed")).includes("display_unavailability_label_missing"));
  assert.ok(unavailability(`${base} The apartments were booked.`).includes("occupancy_wording_for_unavailability"));
  assert.ok(unavailability(`${base} This is not occupancy.`).includes("occupancy_wording_for_unavailability"));
  assert.ok(!unavailability(base).includes("occupancy_wording_for_unavailability"));
  // editorial notes are labelled as such
  const note = editorialFact();
  const noteCodes = (text: string) => codesOf(valid(registryWith(note), factualOf(note, undefined, { text }), context({ topic: "first-photo" })));
  assert.ok(noteCodes("FIXTURE sentence without any figure.").includes("display_editorial_label_missing"));
  assert.deepEqual(noteCodes(rendering(note).text), ["requirement_threshold_unconfirmed"]);
});

// --- wording of factual claims --------------------------------------------------------------------

test("factual wording: a median is not an average, attribution needs a name, platform statements need a source", () => {
  const registry = registryWith(priceFact());
  const codes = (extra: string) => codesOf(valid(registry, priceClaim({ text: PRICE_TEXT + extra })));
  assert.ok(codes(" The average price is stable.").includes("median_presented_as_average"));
  assert.ok(codes(" Prices are typically similar.").includes("median_presented_as_average"));
  assert.ok(codes(" According to the data, this is solid.").includes("vague_attribution"));
  assert.ok(codes(" Airbnb recommends this price.").includes("platform_authority_unsupported"));
  assert.ok(codes(" This clearly proves the point.").includes("overstated_conclusion"));
  assert.ok(codes(" Prices may be higher.").includes("hedged_text_declared_factual"), "a hedged text is not a factual claim");
  assert.ok(codes(" This is guaranteed.").includes("guarantee_wording"));
  assert.ok(codes(" Guests prefer this.").includes("preference_claim_without_fact"));
  assert.ok(codes(" Demand is high.").includes("demand_claim_without_fact"));
  assert.ok(codes(" Hence prices follow.").includes("causal_wording"));
  assert.ok(valid(registry, priceClaim({ supportingFactIds: [] })).findings.some((f) => f.code === "malformed_claim"));
  // a qualitative statement about guests needs a qualitative fact
  const wrongCategory = editorialFact({ value: { category: "guest_expectation", statement: "FIXTURE", language: "en", basis: "editorial_observation" }, relevantTopics: ["first-photo"] });
  assert.ok(codesOf(valid(registryWith(wrongCategory), claim({ kind: "factual", text: "Editorial note: our editors say guests expect natural light.", supportingFactIds: [wrongCategory.factId], figures: [], inheritedDisplayConstraints: ["label_as_editorial_note"] }), context({ topic: "first-photo" }))).includes("fact_not_applicable_to_topic"), "a fact of another category does not serve this topic");
});

test("editorial text: neutral transitions pass, implicit facts and risky wordings do not", () => {
  const registry = registryWith(priceFact());
  assert.equal(valid(registry, editorial("Let us now turn to the next step.")).verdict, "accepted");
  assert.equal(valid(registry, editorial("Here is a short overview of what follows.")).verdict, "accepted");
  for (const [text, code] of [
    ["The old town is famous for its canals.", "implicit_fact_in_editorial"],
    ["The city is located near the coast.", "implicit_fact_in_editorial"],
    ["Everyone visits the old town.", "overgeneralization"],
    ["Prices are typically moderate.", "average_wording_unsupported"],
    ["Visitors expect quiet streets.", "preference_claim_without_fact"],
    ["Visits happen in 2026.", "number_in_non_factual"],
    ["The platform rewards short titles.", "platform_authority_unsupported"],
    ["Studies show that titles matter.", "vague_attribution"],
    ["The rules are mandatory.", "regulatory_claim_without_regulatory_fact"],
  ] as const) {
    const r = valid(registry, editorial(text));
    assert.equal(r.verdict, "rejected", text);
    assert.ok(has(r, code), `${text}: ${codesOf(r).join(",")}`);
  }
  assert.ok(has(valid(registry, editorial("Intro.", { figures: [] })), "figures_not_allowed") === false, "empty figures are tolerated");
});

// --- page level --------------------------------------------------------------------------------

test("page: context agreement, unique claim ids, used facts invariant, verdict precedence", () => {
  const registry = registryWith(priceFact());
  const good = priceClaim();
  assert.ok(validateGeneratedPage({ ...pageOf([good], [PRICE_ID]), topic: "occupancy-guide" }, context(), registry).findings.some((f) => f.code === "page_context_mismatch"));
  assert.ok(validateGeneratedPage({ ...pageOf([good], [PRICE_ID]), citySlug: "other-city" }, context(), registry).findings.some((f) => f.code === "page_context_mismatch"));
  assert.ok(validateGeneratedPage(pageOf([good, good], [PRICE_ID]), context(), registry).findings.some((f) => f.code === "duplicate_claim_id"));
  for (const used of [[], [PRICE_ID, PRICE_ID], [PRICE_ID, "fact:fixture:fixture-city:extra"], ["fact:fixture:fixture-city:other"]]) {
    assert.ok(validateGeneratedPage(pageOf([good], used), context(), registry).findings.some((f) => f.code === "used_facts_mismatch"), JSON.stringify(used));
  }
  assert.ok(validateGeneratedPage({ ...pageOf([good], [PRICE_ID]), usedFactIds: "none" }, context(), registry).findings.some((f) => f.code === "used_facts_mismatch"));
  // one rejected claim rejects the page; needs_human_decision does not hide a rejection
  const mixed = validateGeneratedPage(pageOf([good, advice("This will double your bookings."), claim({ claimId: "claim:c3", kind: "factual", text: "Calendar unavailability, not occupancy, was 42%.", supportingFactIds: ["fact:fixture:fixture-city:unavailability:2026q3:v1"], figures: [], inheritedDisplayConstraints: [] })], [PRICE_ID, "fact:fixture:fixture-city:unavailability:2026q3:v1"]), context(), registry);
  assert.equal(mixed.verdict, "rejected");
  assert.equal(mixed.counts.accepted, 1);
  assert.equal(mixed.counts.rejected, 2);
  // the page country granularity needs no city
  const country = createFactRegistry();
  const countryFact = priceFact({ factId: "fact:fixture:country:price:2026q3:v1", scope: { level: "country", countryCode: "ZZ" } });
  assert.equal(country.register(countryFact).ok, true);
  const countryClaim = factualOf(countryFact, "median");
  assert.equal(validateGeneratedPage({ ...pageOf([countryClaim], [countryFact.factId]), citySlug: "ignored" }, context({ target: { level: "country", countryCode: "ZZ" } }), country).verdict, "accepted");
});

// =====================================================================================================
// S3.2 — reproductions of S3.1 defects F1-F12, positive controls, rendering API
// =====================================================================================================

test("S3.2 rendering: the sentence is built from the fact, English only, and the format is pinned", () => {
  assert.equal(
    PRICE_TEXT,
    "In fixture-city, ZZ (platform: not specified, property type: not specified), the median nightly price is €111.11 (confidence: high, 25 listings observed from 2026-06-01 to 2026-08-31, source: Fixture Publisher (test only)).",
  );
  assert.equal(rendering(priceFact(), "median").text, rendering(priceFact(), "median").text, "deterministic");
  const quartile = rendering(priceFact(), "p25");
  assert.match(quartile.text, /the lower-quartile nightly price is €90\.00 /);
  assert.deepEqual(quartile.figures.map((f) => f.valuePath), ["p25", "sampleSize"]);
  assert.match(rendering(priceFact(), "p75").text, /upper-quartile nightly price is €130\.00/);
  assert.match(rendering(unavailabilityFact()).text, /42% of the observed calendar nights were unavailable \(confidence: high, 900 nights observed across 25 listings from 2026-06-01 to 2026-08-31/);
  assert.ok(!/occupan/i.test(rendering(unavailabilityFact()).text), "the unavailability rendering never speaks of occupancy");
  assert.equal(rendering(editorialFact()).text, "Editorial note: FIXTURE sentence without any figure.");
  assert.match(rendering(ruleFact({})).text, /^FIXTURE rule \(in force from 2026-01-01\)$/);
  assert.deepEqual(rendering(priceFact({ platform: "airbnb", propertyType: "apartment" }), "median").text.slice(0, 66), "In fixture-city, ZZ (platform: Airbnb, property type: apartment), ");
  // several facts: one sentence each, in citation order, constraints merged without duplicates
  const both = renderFactualClaim([{ fact: priceFact(), statistic: "median" }, { fact: editorialFact() }]);
  assert.equal(both.ok && both.value.text, `${PRICE_TEXT} Editorial note: FIXTURE sentence without any figure.`);
  assert.equal(both.ok && both.value.inheritedDisplayConstraints.join(","), "label_as_editorial_note,show_confidence,show_observation_period,show_sample_size");
  assert.deepEqual(both.ok && both.value.supportingFactIds, [PRICE_ID, editorialFact().factId]);
});

test("S3.2 rendering: what cannot be rendered is refused, never approximated", () => {
  const refusal = (selection: Parameters<typeof renderFactualClaim>[0]) => {
    const outcome = renderFactualClaim(selection);
    return outcome.ok ? "rendered" : outcome.reason;
  };
  assert.equal(refusal([{ fact: priceFact(), statistic: "median" }]), "rendered");
  assert.equal(refusal([]), "invalid_selection");
  assert.equal(refusal([{ fact: priceFact() }]), "invalid_selection", "a price needs a statistic");
  assert.equal(refusal([{ fact: priceFact(), statistic: "p10" }]), "invalid_selection", "a statistic the fact does not carry");
  assert.equal(refusal([{ fact: editorialFact(), statistic: "median" }]), "invalid_selection", "a statistic on a non-price fact");
  assert.equal(refusal([{ fact: priceFact(), statistic: "median" }, { fact: priceFact(), statistic: "p25" }]), "invalid_selection", "the same fact twice");
  assert.equal(refusal([{ fact: priceFact({ value: { ...priceValue(111.11), currency: "CHF" } }), statistic: "median" }]), "unsupported_fact", "a currency without a safe written form");
  assert.equal(refusal([{ fact: priceFact({ observedPeriod: null }), statistic: "median" }]), "unsupported_fact", "no period to show");
  assert.equal(refusal([{ fact: priceFact({ value: { metric: "official_statistic", name: "FIXTURE", value: 5 } }) }]), "unsupported_fact");
  assert.equal(refusal([{ fact: editorialFact({ value: { category: "visual_character", statement: "Une phrase de test.", language: "fr", basis: "editorial_observation" } }) }]), "unsupported_fact", "English only");
  assert.equal(refusal([{ fact: editorialFact({ value: { category: "visual_character", statement: "Line one\nline two", language: "en", basis: "editorial_observation" } }) }]), "unsupported_fact", "a single clean line");
  assert.equal(refusal([{ fact: priceFact({ scope: { level: "city", countryCode: "ZZ", citySlug: "x".repeat(400) } }), statistic: "median" }]), "unsupported_fact", "bounded fields");
  // figures name what is stated: exactly one statistic plus the sample size
  const facts = [priceFact()];
  const fig = (valuePath: string) => ({ literal: "1", factId: PRICE_ID, valuePath });
  assert.equal(selectionsFromFigures(facts, [fig("median"), fig("sampleSize")]).ok, true);
  for (const figures of [[], [fig("median")], [fig("median"), fig("p25"), fig("sampleSize")], [fig("sampleSize"), fig("sampleSize")], [fig("median"), fig("sampleSize"), fig("mean")]]) {
    assert.equal(selectionsFromFigures(facts, figures).ok, false, JSON.stringify(figures.map((f) => f.valuePath)));
  }
  assert.equal(selectionsFromFigures([editorialFact()], [{ literal: "1", factId: editorialFact().factId, valuePath: "median" }]).ok, false);
});

test("S3.2 positive controls: rendered claims are accepted, so the validator does not simply refuse everything", () => {
  const airbnb = priceFact({ platform: "airbnb", propertyType: "apartment" });
  const registry = registryWith(airbnb);
  const ctx = context({ platform: "airbnb", propertyType: "apartment" });
  for (const statistic of ["median", "p25", "p75"] as const) {
    const r = valid(registry, factualOf(airbnb, statistic), ctx);
    assert.equal(r.verdict, "accepted", `${statistic}: ${JSON.stringify(r.findings)}`);
  }
  // distinct claims about the same fact, a plain-advice sentence and a hypothesis, on one page
  const page = validateGeneratedPage(
    pageOf(
      [
        factualOf(airbnb, "median", { claimId: "claim:a" }),
        advice("Compare your own listing with the figures above before changing anything.", { claimId: "claim:b" }),
        hypothesis("Brighter photos may help guests to understand the space.", "may", { claimId: "claim:c" }),
        editorial("Let us now turn to the next step.", { claimId: "claim:d" }),
        advice("Commencez par choisir une photo claire pour présenter la pièce principale du logement.", { claimId: "claim:e" }),
      ],
      [airbnb.factId],
    ),
    ctx,
    registry,
  );
  assert.equal(page.verdict, "accepted", JSON.stringify(page));
  assert.equal(page.counts.accepted, 5);
  // an unavailability rendering reaches only the provisional-threshold wait, nothing else
  const unavailable = unavailabilityFact();
  assert.deepEqual(codesOf(valid(registryWith(unavailable), factualOf(unavailable), context({ topic: "occupancy-guide" }))), ["requirement_threshold_unconfirmed"]);
});

test("S3.2 F1: a median is not a maximum, a revenue, an average, a recommendation or another statistic", () => {
  const registry = registryWith(priceFact());
  const variants: [string, string][] = [
    ["maximum", PRICE_TEXT.replace("median", "maximum")],
    ["average", PRICE_TEXT.replace("median", "average")],
    ["monthly revenue", PRICE_TEXT.replace("median nightly price", "median monthly revenue")],
    ["per month", PRICE_TEXT.replace("€111.11", "€111.11 per month")],
    ["earn", `Hosts earn a median of €111.11 (confidence: high, 25 listings observed from 2026-06-01 to 2026-08-31, source: ${PUBLISHER}).`],
    ["recommendation", PRICE_TEXT.replace("the median nightly price is", "hosts should charge")],
    ["hosts instead of listings", PRICE_TEXT.replace("25 listings", "25 hosts")],
  ];
  for (const [label, text] of variants) {
    const r = valid(registry, priceClaim({ text }));
    notAccepted(r, label);
    assert.ok(has(r, "rendered_text_mismatch"), `${label}: ${codesOf(r).join(",")}`);
  }
  // a quartile written as the median
  const quartileAsMedian = valid(registry, priceClaim({ text: PRICE_TEXT.replace("€111.11", "€90"), figures: [{ literal: "90", factId: PRICE_ID, valuePath: "p25" }, PRICE_FIGURES[1]] }));
  notAccepted(quartileAsMedian, "p25 as median");
  assert.ok(has(quartileAsMedian, "rendered_text_mismatch"));
  // price per night versus revenue: an unavailability ratio cannot be written as a price
  const unavailable = unavailabilityFact();
  const asPrice = valid(registryWith(unavailable), factualOf(unavailable, undefined, { text: rendering(unavailable).text.replace("42% of the observed calendar nights were unavailable", "the nightly revenue is €42") }), context({ topic: "occupancy-guide" }));
  notAccepted(asPrice, "unavailability as revenue");
  assert.ok(has(asPrice, "rendered_text_mismatch"));
});

test("S3.2 F2: city, country, segment, platform, period and confidence are those of the fact", () => {
  const registry = registryWith(priceFact());
  const variants: [string, string, string?][] = [
    ["another city", PRICE_TEXT.replace("In fixture-city, ZZ", "In Paris")],
    ["whole country", PRICE_TEXT.replace("In fixture-city, ZZ", "Across the whole country")],
    ["segment widened", PRICE_TEXT.replace("property type: not specified", "property type: luxury villas")],
    ["another platform", PRICE_TEXT.replace("platform: not specified", "platform: Booking.com")],
    ["currently", PRICE_TEXT.replace("the median", "currently the median")],
    ["last year", PRICE_TEXT.replace("the median", "last year the median")],
    ["a month of the period", PRICE_TEXT.replace("observed from 2026-06-01 to 2026-08-31", "observed in March"), "display_period_missing"],
    ["a year instead of the period", PRICE_TEXT.replace("observed from 2026-06-01 to 2026-08-31", "observed in 2026"), "display_period_missing"],
    ["inverted period", PRICE_TEXT.replace("from 2026-06-01 to 2026-08-31", "from 2026-08-31 to 2026-06-01"), "display_period_missing"],
    ["another confidence", PRICE_TEXT.replace("confidence: high", "confidence: low"), "display_confidence_missing"],
    ["no source", PRICE_TEXT.replace(`, source: ${PUBLISHER}`, "")],
  ];
  for (const [label, text, code] of variants) {
    const r = valid(registry, priceClaim({ text }));
    notAccepted(r, label);
    assert.ok(has(r, "rendered_text_mismatch"), `${label}: ${codesOf(r).join(",")}`);
    if (code !== undefined) assert.ok(has(r, code), `${label}: ${codesOf(r).join(",")}`);
  }
  // the dates are checked in the free-text path too: written in the wrong order they do not satisfy the obligation
  const inverted = valid(registry, hypothesis(`The median nightly price may be about €111.11 (confidence: high, 25 listings observed from 2026-08-31 to 2026-06-01).`, "may", {
    basisFactIds: [PRICE_ID],
    figures: [{ literal: "111.11", factId: PRICE_ID, valuePath: "median" }, { literal: "25", factId: PRICE_ID, valuePath: "sampleSize" }],
  }));
  assert.ok(has(inverted, "display_period_missing"));
  // a segment fact is not a whole-city fact
  const villaFact = priceFact({ propertyType: "villa" });
  assert.ok(has(valid(registryWith(villaFact), factualOf(villaFact, "median")), "fact_property_type_mismatch"), "a villa fact does not describe the city's homes");
});

test("S3.2 F3: a conclusion cannot ride on a rendered sentence; it is a separate claim, judged on its own", () => {
  const registry = registryWith(priceFact());
  const conclusions = [
    "Hosts should charge it.", "Hosts should charge more.", "This is a fair price.", "This keeps you competitive.",
    "Hosts with a pool receive better reviews.", "Charging less fills the calendar.", "It outperforms the rest.", "It exceeds expectations.",
    "Prices skyrocketed.", "Prices went up.", "Prices spiked.", "Guests book early, so guests save money.", "Since it is cheap, it sells.",
    "Which explains the demand.", "We promise results.", "Stays are more expensive.", "Les prix grimpent.", "Les prix ont grimpé.", "Les prix montent.", "Les prix baissent parce que la demande chute.",
  ];
  for (const conclusion of conclusions) {
    const r = valid(registry, priceClaim({ text: `${PRICE_TEXT} ${conclusion}` }));
    notAccepted(r, conclusion);
    assert.ok(has(r, "rendered_text_mismatch"), conclusion);
  }
  assert.ok(has(valid(registry, priceClaim({ text: `${PRICE_TEXT} Hosts with a pool receive better reviews.` })), "unsupported_comparison"));
  const invalidSelection = valid(registry, priceClaim({ figures: [PRICE_FIGURES[0]] }));
  assert.equal(invalidSelection.findings.find((f) => f.code === "rendered_selection_invalid")?.severity, "rejected");
  // the same conclusions as claims of their own are refused by the wording rules, not by the mismatch
  const own: [string, string][] = [
    ["Hosts should charge more for the main room.", "unjustified_price_recommendation"],
    ["Lower your prices to stay competitive with the other hosts.", "unjustified_price_recommendation"],
    ["The listing may be a fair price for the main room.", "unjustified_price_recommendation"],
    ["Hosts with a pool receive better reviews from the guests.", "unsupported_comparison"],
    ["Charging less fills the calendar for the whole season.", "causal_wording"],
    ["Prices went up during the summer for the guests.", "unsupported_trend"],
    ["Guests book early so the calendar will fill up.", "causal_wording"],
    ["We promise that the new title will bring the guests.", "guarantee_wording"],
    ["Les prix grimpent en été pour les voyageurs.", "unsupported_trend"],
    ["Les prix baissent parce que la demande est faible pour les voyageurs.", "causal_wording"],
  ];
  for (const [text, code] of own) {
    const r = valid(registry, advice(text));
    notAccepted(r, text);
    assert.ok(has(r, code), `${text}: ${codesOf(r).join(",")}`);
  }
  // a conclusion with a claim of its own is allowed to exist when it is advice that promises nothing
  const page = validateGeneratedPage(pageOf([priceClaim({ claimId: "claim:a" }), advice("Compare your own listing with the figure above before changing anything.", { claimId: "claim:b" })], [PRICE_ID]), context(), registry);
  assert.equal(page.verdict, "accepted", JSON.stringify(page));
});

test("S3.2 F4: unsupported languages are not validated automatically, and a few English words do not make a text English", () => {
  const registry = registryWith(priceFact());
  const foreign: [string, string][] = [
    ["pt", "Isto garante o dobro de reservas para todos os anfitriões."],
    ["nl", "Dit garandeert dubbel zoveel boekingen voor alle gastheren."],
    ["ar", "هذا يضمن مضاعفة الحجوزات لجميع المضيفين."],
    ["es", "Los precios subieron un cuarenta por ciento durante el verano."],
    ["de", "Das Gesetz verlangt eine Registrierung für alle Gastgeber."],
    ["it", "Questo garantisce il doppio delle prenotazioni per tutti gli ospiti."],
    ["es with english words", "Los precios de la ciudad subieron un cuarenta por ciento from the last year."],
    ["english sentence then portuguese", "Choose a clear first photo for the listing. Isto garante o dobro de reservas para todos."],
    ["too short to tell", "Photos."],
  ];
  for (const [label, text] of foreign) {
    for (const make of [advice, editorial, (t: string) => hypothesis(t, "may")]) {
      const r = valid(registry, make(text));
      notAccepted(r, label);
      assert.ok(has(r, "language_not_verified") || has(r, "script_not_supported"), `${label}: ${codesOf(r).join(",")}`);
    }
    assert.ok(has(valid(registry, priceClaim({ text })), "rendered_text_mismatch"), label);
  }
  // the screen never claims certainty: it answers en, fr or undetermined
  assert.equal(screenLanguage("Choose a first photo that shows the main room clearly."), "en");
  assert.equal(screenLanguage("Commencez par choisir une photo claire pour présenter la pièce principale."), "fr");
  assert.equal(screenLanguage("Los precios subieron un cuarenta por ciento durante el verano."), "undetermined");
  assert.equal(screenLanguage("Hello"), "undetermined");
  assert.equal(screenLanguage("The photos"), "undetermined", "two words are not evidence");
  assert.equal(screenLanguage("Use the photos"), "en");
  assert.equal(screenLanguage("The le prix du"), "undetermined", "a narrow lead is not a language");
  assert.equal(screenLanguage("The prices of the city are le prix du hotel"), "undetermined", "mixed evidence is not English");
  // a long English paragraph does not carry a foreign sentence along with it
  const carried = "Choose a clear first photo for the listing and describe the main room of the unit to the guests with the title. Isto garante o dobro de reservas.";
  assert.equal(screenLanguage(carried), "undetermined");
  notAccepted(valid(registry, advice(carried)), "carried foreign sentence");
  assert.equal(screenLanguage(""), "undetermined");
  // French text is accepted as advice (covered by the lexical lists) but a French factual sentence is not a rendering
  assert.equal(valid(registry, advice("Commencez par choisir une photo claire pour présenter la pièce principale du logement.")).verdict, "accepted");
  const french = valid(registry, priceClaim({ text: "Le prix médian par nuit est de 111,11 € (confiance : élevée, 25 annonces observées du 2026-06-01 au 2026-08-31)." }));
  notAccepted(french, "french factual");
  assert.ok(has(french, "rendered_text_mismatch") && has(french, "language_not_verified"));
  // a fact whose statement is not English cannot be stated automatically
  const fr = editorialFact({ value: { category: "visual_character", statement: "Une phrase de test sans chiffre.", language: "fr", basis: "editorial_observation" } });
  const frClaim = valid(registryWith(fr), claim({ kind: "factual", text: "Editorial note: Une phrase de test sans chiffre.", supportingFactIds: [fr.factId], figures: [], inheritedDisplayConstraints: ["label_as_editorial_note"] }), context({ topic: "first-photo" }));
  assert.ok(has(frClaim, "factual_render_unsupported"));
  assert.equal(frClaim.findings.find((f) => f.code === "factual_render_unsupported")?.severity, "needs_human_decision");
});

test("S3.2 F5: digits of every script and full-width forms are read as digits", () => {
  const registry = registryWith(priceFact());
  assert.deepEqual(analyzeClaimText("Occupancy is ٩٩٪").tokens.map((t) => [t.category, t.candidates[0]]), [["percent", 99]]);
  assert.deepEqual(analyzeClaimText("Occupancy is ９９%").tokens.map((t) => [t.category, t.candidates[0]]), [["percent", 99]]);
  assert.deepEqual(analyzeClaimText("Occupancy is ९९%").tokens.map((t) => [t.category, t.candidates[0]]), [["percent", 99]]);
  assert.deepEqual(analyzeClaimText("Price €١١١٫١١").tokens.map((t) => [t.category, t.candidates[0]]), [["currency", 111.11]]);
  assert.equal(fold("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  for (const text of ["Hosts see occupancy at ٩٩٪ in the whole city.", "Hosts see occupancy at ９９% in the whole city."]) {
    assert.ok(has(valid(registry, advice(text)), "number_in_non_factual"), text);
    assert.ok(has(valid(registry, editorial(text)), "number_in_non_factual"), text);
    assert.ok(has(valid(registry, priceClaim({ text: `${PRICE_TEXT} ${text}` })), "unbacked_number"), text);
  }
  // a figure written with other digits is not the rendering either
  notAccepted(valid(registry, priceClaim({ text: PRICE_TEXT.replace("25 listings", "٢٥ listings") })), "arabic-indic sample size");
  // an ordinary Latin digit stays what it was
  assert.ok(has(valid(registry, advice("Hosts see occupancy at 99% in the whole city.")), "number_in_non_factual"));
});

test("S3.2 F6: invisible characters and look-alike letters cannot hide a wording", () => {
  const registry = registryWith(priceFact());
  const hidden: [string, string, string][] = [
    ["zero-width space", "This will guar​antee more bookings for the guests.", "guarantee_wording"],
    ["soft hyphen", "This will guaran­tee more bookings for the guests.", "guarantee_wording"],
    ["word joiner", "The aver⁠age price is high in the city for the guests.", "average_wording_unsupported"],
    ["zero-width joiner", "Prices incre‍ase in summer for the guests and the hosts.", "unsupported_trend"],
    ["bidi mark", "This will guar‮antee more bookings for the guests.", "guarantee_wording"],
    ["full-width letters", "Ｔｈｉｓ ｗｉｌｌ ｇｕａｒａｎｔｅｅ more bookings for the guests.", "guarantee_wording"],
    ["ligature", "The ﬁrst photo will guarantee more bookings for the guests.", "guarantee_wording"],
  ];
  for (const [label, text, code] of hidden) {
    const r = valid(registry, advice(text));
    notAccepted(r, label);
    assert.ok(has(r, code), `${label}: ${codesOf(r).join(",")}`);
  }
  // letters of another alphabet that look Latin are refused as such
  const lookalikes = ["This will guаrantee more bookings for the guests.", "The price is higher thаn the other one for the guests.", "Photos are ɡood for the listing and for the guests."];
  for (const text of lookalikes) {
    const r = valid(registry, advice(text));
    notAccepted(r, text);
    assert.ok(has(r, "script_not_supported"), `${text}: ${codesOf(r).join(",")}`);
    assert.equal(r.findings.find((f) => f.code === "script_not_supported")?.severity, "needs_human_decision");
  }
  assert.equal(hasUnsupportedScript("Plain English text, with é and ç and œ."), false);
  assert.equal(hasUnsupportedScript("Cyrillic а inside"), true);
  assert.equal(hasUnsupportedScript("ıncrease"), false, "a dotless i is folded to i and then matched like any i");
  assert.ok(has(valid(registry, advice("Prices ıncrease in summer for the guests and the hosts.")), "unsupported_trend"));
  // hostile text neither throws nor is quadratic
  const started = Date.now();
  for (const text of ["\uD800 lone surrogate", "a".concat("́".repeat(900)), "​".repeat(900), "٩".repeat(900), "ﬁ".repeat(450)]) {
    assert.doesNotThrow(() => valid(registry, advice(text)), text.slice(0, 12));
  }
  assert.ok(Date.now() - started < 2000);
});

test("S3.2 F7: a hypothesis marker must be a whole word and belong to every proposition", () => {
  const registry = registryWith(priceFact());
  const refused: [string, string][] = [
    ["Maybe not; bookings in fixture-city doubled.", "may"],
    ["Prices doubled in fixture-city last year in all districts. It may be nice.", "may"],
    ["It may be that things changed; prices tripled last year.", "may"],
    ["Photos may help guests to see the space, but they improve every booking in the city.", "may"],
    ["Prices doubled in fixture-city last year for the guests of the hosts.", "may"],
  ];
  for (const [text, marker] of refused) {
    const r = valid(registry, hypothesis(text, marker));
    notAccepted(r, text);
    assert.ok(has(r, "hypothesis_marker_missing"), `${text}: ${codesOf(r).join(",")}`);
  }
  const substring = valid(registry, hypothesis("Maybe photos help guests to understand the space.", "may"));
  assert.ok(has(substring, "hypothesis_marker_missing"), "'maybe' is not 'may'");
  const wrongDeclared = valid(registry, hypothesis("Brighter photos might help guests to understand the space.", "may"));
  assert.ok(has(wrongDeclared, "hypothesis_marker_missing"), "the declared marker must be the one in the text");
  // the marker is recognised on accents and case, and every proposition carries one
  assert.equal(valid(registry, hypothesis("Prices may rise, and photos may help guests to understand the space.")).verdict, "accepted");
  assert.equal(valid(registry, hypothesis("Brighter photos might help guests to understand the space. Titles could help too.", "might")).verdict, "accepted");
  assert.equal(valid(registry, hypothesis("Des photos plus claires pourraient aider les voyageurs à comprendre le logement.", "pourraient")).verdict, "accepted");
  assert.equal(valid(registry, hypothesis("Brighter photos MAY help guests to understand the space.", "May")).verdict, "accepted");
});

test("S3.2 F8: a negation or a named source shields only what it is attached to", () => {
  const registry = registryWith(priceFact());
  for (const text of [
    "This does not guarantee success, but it guarantees more bookings.",
    "We do not guarantee anything, but results are guaranteed to improve.",
    "No guarantee is given, and yet the title guarantees more guests.",
    "Cela ne garantit pas le succès mais garantit plus de réservations pour les voyageurs.",
  ]) {
    const r = valid(registry, advice(text));
    notAccepted(r, text);
    assert.ok(has(r, "guarantee_wording"), `${text}: ${codesOf(r).join(",")}`);
  }
  for (const text of ["You can count on more bookings from the new title.", "A new title is sure to bring more guests to the listing.", "Un nouveau titre est sûr d'avoir plus de réservations pour les voyageurs."]) {
    assert.ok(has(valid(registry, advice(text)), "guarantee_wording"), text);
  }
  assert.ok(has(valid(registry, editorial("The old town hosts a famous market for the guests.")), "implicit_fact_in_editorial"));
  assert.equal(valid(registry, advice("A new title does not guarantee more bookings.")).verdict, "accepted", "a plain disclaimer is still fine");
  assert.equal(valid(registry, advice("There is no guarantee that a new title will work for the guests.")).verdict, "accepted");
  // the publisher named in one sentence does not excuse a vague attribution in another
  const r = valid(registry, priceClaim({ text: `${PRICE_TEXT} According to the data, hosts must lower prices.` }));
  assert.ok(has(r, "vague_attribution"));
  assert.deepEqual(r.findings.filter((f) => f.code === "vague_attribution").map((f) => f.ref), ["sentence[1]"], "only the second sentence is flagged");
});

test("S3.2 F9: one number backs one role, and the unit says which", () => {
  const registry = registryWith(priceFact());
  const extra = (text: string) => valid(registry, priceClaim({ text: `${PRICE_TEXT} ${text}` }));
  assert.ok(has(extra("25 hosts agree."), "unbacked_number"));
  assert.ok(has(extra("Also 25 listings."), "unbacked_number"), "the same number written twice needs two figures");
  assert.ok(has(extra("The price is €111.11 again."), "unbacked_number"));
  // free-text path: sample size is a count of listings, not of hosts, and each written number needs its own figure
  const hosts = valid(registry, hypothesis(`The median nightly price may be about €111.11 ${FIGURE_TAIL.replace("25 listings", "25 hosts")}.`, "may", { basisFactIds: [PRICE_ID], figures: [{ literal: "111.11", factId: PRICE_ID, valuePath: "median" }, { literal: "25", factId: PRICE_ID, valuePath: "sampleSize" }] }));
  assert.ok(has(hosts, "figure_value_mismatch"));
  const twice = valid(registry, hypothesis(`The median nightly price may be about €111.11 ${FIGURE_TAIL} and 25 listings may agree.`, "may", { basisFactIds: [PRICE_ID], figures: [{ literal: "111.11", factId: PRICE_ID, valuePath: "median" }, { literal: "25", factId: PRICE_ID, valuePath: "sampleSize" }] }));
  assert.ok(has(twice, "unbacked_number"));
  // nights are nights: observed nights written as listings do not match
  const unavailable = unavailabilityFact();
  const nightsAsListings = valid(registryWith(unavailable), factualOf(unavailable, undefined, { text: rendering(unavailable).text.replace("900 nights", "900 listings") }), context({ topic: "occupancy-guide" }));
  assert.ok(has(nightsAsListings, "figure_value_mismatch"));
  assert.deepEqual(codesOf(valid(registryWith(unavailable), factualOf(unavailable), context({ topic: "occupancy-guide" }))), ["requirement_threshold_unconfirmed"], "the rendered nights are accepted as nights");
});

test("S3.2 F10: only real list and step numbering is structural", () => {
  const registry = registryWith(priceFact());
  for (const text of [
    "At this point 120 hosts charge more.", "It is the No. 1 market for the guests.", "Step 90 percent of hosts agree on this.",
    "First line.\n120. hosts agree with the guests.", "Hosts in the city number 5. Guests agree with the hosts.", "Part 120 of the guests agree.", "Rule 5 applies to the hosts.", "In step 3 the guests choose a photo.",
  ]) {
    const r = valid(registry, advice(text));
    notAccepted(r, text);
    assert.ok(has(r, "number_in_non_factual"), `${text}: ${codesOf(r).join(",")}`);
  }
  assert.deepEqual(analyzeClaimText("Step 3: pick a photo.").tokens.map((t) => t.structural), [true]);
  assert.deepEqual(analyzeClaimText("1. Pick a photo.\n2) Write a title.").tokens.map((t) => t.structural), [true, true]);
  assert.deepEqual(analyzeClaimText("Step 90: pick a photo.").tokens.map((t) => t.structural), [false]);
  assert.equal(valid(registry, advice("1. Choose a clear first photo for the listing.\n2. Write a precise title for the page.")).verdict, "accepted");
});

test("S3.2 F11: fractions, quantifiers and spelled-out numbers are quantities", () => {
  const registry = registryWith(priceFact());
  for (const text of [
    "A third of the listings are small for the guests.", "Two thirds of hosts agree with the guests.", "One in four stays is cancelled by the guests.",
    "Trois logements sur dix sont chers pour les voyageurs.", "Dozens of hosts agree with the guests.", "Many hosts agree with the guests.",
    "Several hosts agree with the guests.", "Add twelve photos to the listing for the guests.", "The city has two airports for the guests.",
    "A majority of the hosts agree with the guests.", "A third are small for the guests.", "Une moitié des logements est chère pour les voyageurs.", "Un quart des logements est cher pour les voyageurs.",
  ]) {
    for (const make of [advice, editorial]) {
      const r = valid(registry, make(text));
      notAccepted(r, text);
      assert.ok(has(r, "unquantified_quantity") || has(r, "number_in_non_factual"), `${text}: ${codesOf(r).join(",")}`);
    }
    notAccepted(valid(registry, priceClaim({ text: `${PRICE_TEXT} ${text}` })), `factual + ${text}`);
  }
  assert.equal(valid(registry, advice("Choose one clear photo for the first image of the listing.")).verdict, "accepted", "'one' alone is not a quantity claim");
});

test("S3.2 F12: occupancy negations are not excused, and a qualitative claim is the fact's own statement", () => {
  withLongStayRuleRequired(() => {
  const unavailable = unavailabilityFact();
  const registry = registryWith(unavailable);
  const base = rendering(unavailable).text;
  for (const extra of ["Those 25 listings are not empty, they are fully booked.", "Calendars are not about occupancy.", "No apartment was left unoccupied."]) {
    const r = valid(registry, factualOf(unavailable, undefined, { text: `${base} ${extra}` }), context({ topic: "occupancy-guide" }));
    assert.ok(has(r, "occupancy_wording_for_unavailability"), `${extra}: ${codesOf(r).join(",")}`);
  }
  const note = editorialFact();
  const noteRegistry = registryWith(note);
  const ctx = context({ topic: "first-photo" });
  for (const text of [
    "Editorial note: FIXTURE sentence without any figure. Guests love it.",
    "Editorial note: this arch is the most photographed place for the guests.",
    "FIXTURE sentence without any figure.",
    "Editorial note: FIXTURE sentence without any figures.",
  ]) {
    const r = valid(noteRegistry, factualOf(note, undefined, { text }), ctx);
    notAccepted(r, text);
    assert.ok(has(r, "rendered_text_mismatch"), `${text}: ${codesOf(r).join(",")}`);
  }
  // the exact statement is compared, and the provisional threshold still holds the claim back
  const exact = valid(noteRegistry, factualOf(note), ctx);
  assert.equal(exact.verdict, "needs_human_decision");
  assert.deepEqual(codesOf(exact), ["requirement_threshold_unconfirmed"]);
  // a regulatory rule is also stated as registered, with its dates
  const current = ruleFact({ rule: "FIXTURE rule about the registration of the hosts." });
  const ruleCtx = context({ topic: "long-stay-guide", asOf: "2026-06-01T00:00:00Z" });
  const ruleRegistry = registryWith(timezoneFact(), current);
  assert.deepEqual(codesOf(valid(ruleRegistry, factualOf(current), ruleCtx)), ["requirement_threshold_unconfirmed"]);
  assert.ok(has(valid(ruleRegistry, factualOf(current, undefined, { text: "FIXTURE rule about the registration of the hosts, always." }), ruleCtx), "rendered_text_mismatch"));
  });
});

test("S3.2 confidentiality and robustness: new diagnostics carry no text, number or identifier", () => {
  const registry = registryWith(priceFact());
  const texts = [
    `${PRICE_TEXT} Hosts in Paris should charge 777 euros ${UUID} host@example.invalid`,
    "Это гарантирует рост бронирований для всех хозяев 987654321.",
    "Isto garante o dobro de reservas 123456789 para todos os anfitriões.",
    "Many hosts earn 555 euros, a third of them in Paris, so guests book early.",
  ];
  const results = texts.flatMap((text) => [valid(registry, priceClaim({ text })), valid(registry, advice(text)), valid(registry, hypothesis(text))]);
  for (const r of results) {
    const serialised = JSON.stringify(r);
    for (const forbidden of ["777", "987654321", "123456789", "555", "Paris", "example.invalid", UUID, "гарантирует", "garante", "anfitriões", "earn"]) {
      assert.ok(!serialised.includes(forbidden), `diagnostics must not contain "${forbidden}"`);
    }
    for (const f of r.findings) assert.match(f.ref, ALLOWED_REF);
  }
  // a page-level run carries no more than a claim-level run
  const page = validateGeneratedPage(pageOf(texts.map((text, index) => advice(text, { claimId: `claim:n${index}` })), []), context(), registry);
  assert.ok(!JSON.stringify(page).includes("Paris"));
  // the normalisation itself neither mutates the input nor depends on it
  const input = { ...advice("Prices ıncrease in summer for the guests and the hosts.") };
  const copy = structuredClone(input);
  valid(registry, input);
  assert.deepEqual(input, copy);
});
