import assert from "node:assert/strict";
import test from "node:test";

import { createEditorialCatalog, sha256Hex, type EditorialCatalog } from "../lib/seo/v3/editorialCatalog";
import { assembleEditorialPage, compareEditorialPages, DRAFT_BLUEPRINTS, EDITORIAL_PAGE_VERSION, measureRepetition, type EditorialPage } from "../lib/seo/v3/editorialPage";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import type { LocalFact } from "../lib/seo/v3/localFact";
import type { LocalSeoTopicSlug } from "../lib/seo/v3/topics";
import { withSimulatedThresholdDecision } from "./seo-v3-demo-thresholds";

/**
 * S5.4-B tests: editorial page structure, depth gate, differentiation. EVERYTHING is fictional: cities `fixture-a`,
 * `fixture-b`, `fixture-c`, country Fixtureland (ZZ), publishers "test only", reviewers "fixture-reviewer (test only)".
 * No block here is an approved catalogue; no threshold decision exists (see seo-v3-demo-thresholds.ts).
 *
 *   npx tsx scripts/seo-v3-editorial-page.test.ts
 */

const ASOF = "2026-10-01T00:00:00Z";
const MEASURED = ["show_sample_size", "show_observation_period", "show_confidence"];
const PUBLISHER = "Fixture Publisher (test only)";

const licensed = () => ({
  sourceId: "fixture-licensed", sourceType: "licensed_dataset", publisher: PUBLISHER, title: null, locator: { kind: "document_citation", citation: "FIXTURE - not a real publication" },
  publishedAt: "2026-08-15", consultedAt: "2026-09-01T09:00:00Z", collectionMethod: { kind: "dataset_download", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: [],
  evidence: [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }],
});
const editorial = () => ({
  ...licensed(), sourceId: "fixture-editorial", sourceType: "editorial_note", locator: { kind: "internal_reference", reference: "fixture-editorial-note" },
  collectionMethod: { kind: "editorial_judgement", description: "fixture" }, evidence: [{ kind: "internal_record", reference: "fixture-record" }],
});
const approved = (topics: string[]) => ({ use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-03T10:00:00Z", scope: topics } } });
const validated = { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-02T10:00:00Z", note: null };
const scopeOf = (slug: string) => ({ level: "city", countryCode: "ZZ", citySlug: slug }) as const;

const PRICE_TOPICS = ["pricing-guide", "market-analysis"];
const common = (slug: string, id: string) => ({
  factId: `fact:fixture:${slug}:${id}:2026q3:v1`, scope: scopeOf(slug), platform: "airbnb", propertyType: null, unit: null, collectedAt: "2026-09-01T10:00:00Z",
  validUntil: "2026-12-01T00:00:00Z", confidence: { level: "high", rationale: "FIXTURE" }, validation: validated, version: 1, supersedes: null,
});
const price = (slug: string, median: number): LocalFact =>
  ({ ...common(slug, "price"), kind: "quantitative", source: licensed(), observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, usage: { ...approved(PRICE_TOPICS), displayConstraints: MEASURED }, relevantTopics: PRICE_TOPICS,
    value: { metric: "nightly_price_distribution", currency: "EUR", median, p25: Math.round(median * 0.8), p75: Math.round(median * 1.2), sampleSize: 25 } }) as unknown as LocalFact;
const demand = (slug: string, statement: string): LocalFact =>
  ({ ...common(slug, "demand"), kind: "qualitative", source: editorial(), observedPeriod: null, usage: { ...approved(["pricing-guide"]), displayConstraints: ["label_as_editorial_note"] }, relevantTopics: ["pricing-guide"],
    value: { category: "demand_driver", statement, language: "en", basis: "editorial_observation" } }) as unknown as LocalFact;
const calendar = (slug: string, ratio: number): LocalFact =>
  ({ ...common(slug, "calendar"), kind: "quantitative", source: licensed(), observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, usage: { ...approved(["market-analysis"]), displayConstraints: [...MEASURED, "label_as_unavailability_not_occupancy"] }, relevantTopics: ["market-analysis"],
    value: { metric: "calendar_unavailability_rate", ratio, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize: 25 } }) as unknown as LocalFact;

function registryOf(...facts: LocalFact[]): FactRegistry {
  const registry = createFactRegistry();
  for (const fact of facts) {
    const outcome = registry.register(fact);
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
  }
  return registry;
}

// FICTIONAL blocks: written for these tests, "approved" by a test-only reviewer. They are not a catalogue to reuse.
const BLOCKS: readonly { blockId: string; kind: "editorial_non_factual" | "methodological_advice" | "explicit_hypothesis"; topic: LocalSeoTopicSlug; text: string; marker?: string }[] = [
  { blockId: "block:pricing-guide:introduction:1", kind: "editorial_non_factual", topic: "pricing-guide", text: "This guide looks at how local price evidence can inform a nightly rate decision." },
  { blockId: "block:pricing-guide:method:1", kind: "methodological_advice", topic: "pricing-guide", text: "Compare the figures on this page with the features of your own listing before you change anything." },
  { blockId: "block:pricing-guide:recommend:1", kind: "methodological_advice", topic: "pricing-guide", text: "When a local demand note applies, check whether your listing speaks to that audience." },
  { blockId: "block:pricing-guide:hypothesis:1", kind: "explicit_hypothesis", topic: "pricing-guide", text: "The local demand note may help guests to understand the area.", marker: "may" },
  { blockId: "block:pricing-guide:conclusion:1", kind: "editorial_non_factual", topic: "pricing-guide", text: "These points are a starting checklist for your own listing." },
  { blockId: "block:market-analysis:introduction:1", kind: "editorial_non_factual", topic: "market-analysis", text: "This analysis presents the local market data that is available for the area." },
  { blockId: "block:market-analysis:method:1", kind: "methodological_advice", topic: "market-analysis", text: "Treat calendar unavailability as a signal about the calendar only, not as a measure of bookings." },
  { blockId: "block:market-analysis:hypothesis:1", kind: "explicit_hypothesis", topic: "market-analysis", text: "Hosts may block dates for reasons that the data does not show.", marker: "may" },
  { blockId: "block:market-analysis:conclusion:1", kind: "editorial_non_factual", topic: "market-analysis", text: "Combine this market picture with what you know about your own listing." },
];
const catalogOf = (blocks = BLOCKS): EditorialCatalog =>
  createEditorialCatalog(
    blocks.map((b) => ({
      blockId: b.blockId, language: "en", kind: b.kind, text: b.text, topics: [b.topic], hypothesisMarker: b.marker ?? null,
      approval: { status: "approved", approvedBy: "fixture-reviewer (test only)", approvedAt: "2026-09-10T00:00:00Z", textHash: sha256Hex(b.text) },
    })),
  );

const A_DEMAND = "FIXTURE note for the first fictional city: mostly weekend visitors from nearby towns, written for tests only.";
const B_DEMAND = "FIXTURE note for the second fictional city: a yearly trade fair draws professionals, written for tests only.";
const FULL = () =>
  registryOf(price("fixture-a", 111.11), price("fixture-b", 142.5), demand("fixture-a", A_DEMAND), demand("fixture-b", B_DEMAND), calendar("fixture-a", 0.37), calendar("fixture-b", 0.52));
const build = (registry: FactRegistry, slug: string, topic: LocalSeoTopicSlug, catalog = catalogOf()): EditorialPage =>
  assembleEditorialPage({ registry, catalog, target: scopeOf(slug), platform: "airbnb", propertyType: null, topic, asOf: ASOF, language: "en" });

test("S5.4-B fixture catalogue: every fictional block is accepted by the S4 catalogue checks", () => {
  const catalog = catalogOf();
  assert.deepEqual(catalog.excluded, [], JSON.stringify(catalog.excluded));
  assert.equal(catalog.blocks.length, BLOCKS.length);
});

test("S5.4-B structured page (fixture mode): ordered roles, facts, conditional blocks, derived limits and sources, nothing authorised", () => {
  withSimulatedThresholdDecision(() => {
    const page = build(FULL(), "fixture-a", "pricing-guide");
    assert.equal(page.status, "fixture_demo_only", JSON.stringify(page.reasons));
    assert.equal(page.version, EDITORIAL_PAGE_VERSION);
    assert.deepEqual(page.sections.map((s) => s.slotId), ["introduction", "prices", "demand", "method", "recommend", "hypothesis", "limits", "sources", "conclusion"]);
    assert.deepEqual(page.sections.map((s) => s.role), ["introduction", "local_facts", "local_facts", "topic_analysis", "practical_recommendations", "interpretation", "data_limits", "sources", "conclusion"]);
    assert.deepEqual(page.sections.map((s) => s.origin), ["approved_blocks", "validated_facts", "validated_facts", "approved_blocks", "approved_blocks", "approved_blocks", "derived_from_facts", "derived_from_facts", "approved_blocks"]);
    assert.equal(page.searchIntent, "decide_a_nightly_rate_with_local_evidence");
    // limits and sources are data derived from the facts, never prose
    const limits = page.sections.find((s) => s.slotId === "limits")!;
    assert.deepEqual(limits.claims, []);
    assert.equal(limits.limits!.length, 2);
    assert.ok(limits.limits!.some((l) => l.sampleSize === 25 && l.confidence === "high"));
    const sources = page.sections.find((s) => s.slotId === "sources")!;
    assert.deepEqual(sources.sources!.map((s) => s.publisher).sort(), [PUBLISHER, PUBLISHER]);
    // the claim texts are exactly those of the validated S4 page
    const baseTexts = new Set(page.base!.sections.flatMap((s) => s.claims.map((c) => c.text)));
    for (const section of page.sections) for (const claim of section.claims) assert.ok(baseTexts.has(claim.text));
    assert.deepEqual(page.metrics!.unplacedClaimIds, []);
    // never publishable
    assert.equal(page.publishable, false);
    assert.equal(page.publicationAuthorised, false);
    assert.equal(page.indexingAuthorised, false);
    assert.equal(page.fixtureOnly, true, "a page built from test-only sources is marked as a demonstration");
    assert.equal(page.base!.eligibility.eligibility, "needs_data", "S4 never states publishable_standalone");
  });
});

test("S5.4-B conditional recommendations: a block appears only with the facts it comments on", () => {
  withSimulatedThresholdDecision(() => {
    const noDemand = build(registryOf(price("fixture-a", 111.11), calendar("fixture-a", 0.37)), "fixture-a", "pricing-guide");
    assert.equal(noDemand.status, "refused");
    assert.ok(noDemand.reasons.includes("context_fact_missing"));
    // the conditional slots are absent without their fact, but the required ones are still answered
    assert.ok(noDemand.metrics!.unansweredSlots.includes("recommend"));
    assert.ok(noDemand.metrics!.unansweredSlots.includes("hypothesis"));
    assert.ok(!noDemand.sections.some((s) => s.slotId === "recommend"));
  });
});

test("S5.4-B cities: the pages differ in context and analysis, not only in numbers", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    const a = build(registry, "fixture-a", "pricing-guide");
    const b = build(registry, "fixture-b", "pricing-guide");
    assert.equal(a.status, "fixture_demo_only");
    assert.equal(b.status, "fixture_demo_only");
    const demandText = (p: EditorialPage) => p.sections.find((s) => s.slotId === "demand")!.claims[0]!.text;
    assert.notEqual(demandText(a), demandText(b));
    assert.ok(demandText(a).includes("weekend visitors") && demandText(b).includes("trade fair"));
    const cmp = compareEditorialPages([{ key: "a/pricing-guide", page: a }, { key: "b/pricing-guide", page: b }]);
    assert.equal(cmp.pairs[0]!.relation, "same_topic_other_city");
    assert.ok(cmp.pairs[0]!.templateSimilarity < 1, "not identical once city and numbers are masked");
    assert.deepEqual(cmp.flagged, []);
  });
});

test("S5.4-B cities: a topic whose pages differ only by figures is flagged", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    const a = build(registry, "fixture-a", "market-analysis");
    const b = build(registry, "fixture-b", "market-analysis");
    assert.equal(a.status, "fixture_demo_only", JSON.stringify(a.reasons));
    assert.equal(b.status, "fixture_demo_only");
    const cmp = compareEditorialPages([{ key: "a/market-analysis", page: a }, { key: "b/market-analysis", page: b }]);
    assert.deepEqual(cmp.pairs[0]!.codes, ["numeric_only_difference"]);
    assert.deepEqual(cmp.flagged.map((f) => f.key), ["a/market-analysis", "b/market-analysis"]);
  });
});

test("S5.4-B topics: two topics of one city carry different facts, different questions and different intent", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    const guide = build(registry, "fixture-a", "pricing-guide");
    const market = build(registry, "fixture-a", "market-analysis");
    assert.equal(guide.status, "fixture_demo_only");
    assert.equal(market.status, "fixture_demo_only", JSON.stringify(market.reasons));
    assert.notEqual(guide.searchIntent, market.searchIntent);
    const questions = (p: EditorialPage) => p.sections.map((s) => s.question);
    assert.notDeepEqual(questions(guide), questions(market));
    // shared fact: the price; specific facts: the demand note vs the calendar rate
    const cmp = compareEditorialPages([{ key: "a/guide", page: guide }, { key: "a/market", page: market }]);
    const pair = cmp.pairs[0]!;
    assert.equal(pair.relation, "same_city_other_topic");
    assert.equal(pair.sharedFactIds.length, 1);
    assert.ok(pair.sharedFactIds[0]!.includes(":price:"));
    assert.deepEqual(pair.codes, []);
    assert.deepEqual(guide.metrics!.distinctFactCategories, ["qualitative:demand_driver", "quantitative:nightly_price_distribution"]);
    assert.deepEqual(market.metrics!.distinctFactCategories, ["quantitative:calendar_unavailability_rate", "quantitative:nightly_price_distribution"]);
  });
});

test("S5.4-B duplicates are refused: the same facts under two topics are one page twice", () => {
  withSimulatedThresholdDecision(() => {
    // fixture-c has only a price: both topics would show the same single fact
    const registry = registryOf(price("fixture-c", 99.5));
    const guide = build(registry, "fixture-c", "pricing-guide");
    const market = build(registry, "fixture-c", "market-analysis");
    for (const page of [guide, market]) {
      assert.equal(page.status, "refused");
      assert.ok(page.reasons.includes("too_few_distinct_facts") && page.reasons.includes("too_few_fact_categories"));
    }
    // and if two ready pages did carry the same facts, the comparison flags them
    const registryAB = FULL();
    const ready = build(registryAB, "fixture-a", "pricing-guide");
    const twin: EditorialPage = { ...ready, topic: "market-analysis" as never };
    const cmp = compareEditorialPages([{ key: "x/pricing", page: ready }, { key: "x/market", page: twin }]);
    assert.ok(cmp.pairs[0]!.codes.includes("identical_fact_set"));
    assert.ok(cmp.pairs[0]!.codes.includes("topic_not_distinct"));
  });
});

test("S5.4-B thin pages are refused even though every fact is valid", () => {
  withSimulatedThresholdDecision(() => {
    const registry = registryOf(price("fixture-c", 99.5));
    const page = build(registry, "fixture-c", "pricing-guide");
    assert.equal(page.base !== null, true, "the S4 page itself is valid and ready");
    assert.equal(page.status, "refused");
    assert.deepEqual(page.reasons, ["context_fact_missing", "too_few_distinct_facts", "too_few_fact_categories"]);
    assert.equal(page.metrics!.distinctFacts, 1);
    assert.equal(page.metrics!.factualClaims, 3, "one fact, three claims: the depth rule counts the fact once");
  });
});

test("S5.4-B an empty or missing catalogue refuses the page: no invented introduction", () => {
  withSimulatedThresholdDecision(() => {
    const empty = build(FULL(), "fixture-a", "pricing-guide", createEditorialCatalog([]));
    assert.equal(empty.status, "refused");
    assert.deepEqual(empty.reasons, ["required_slot_unanswered"]);
    assert.deepEqual(empty.metrics!.unansweredSlots.filter((s) => ["introduction", "conclusion"].includes(s)).sort(), ["conclusion", "introduction"]);
    // a block from another topic, an edited text or an unapproved block never reaches a page
    const wrongTopic = catalogOf(BLOCKS.filter((b) => b.topic === "market-analysis"));
    assert.equal(build(FULL(), "fixture-a", "pricing-guide", wrongTopic).status, "refused");
  });
});

test("S5.4-B no invented claim: every sentence is a validated fact or an approved block, and numbers come from facts", () => {
  withSimulatedThresholdDecision(() => {
    const page = build(FULL(), "fixture-a", "pricing-guide");
    const blockTexts = new Set(BLOCKS.map((b) => b.text));
    for (const claim of page.sections.flatMap((s) => s.claims)) {
      if (claim.kind === "factual") {
        assert.ok(claim.supportingFactIds!.length > 0);
        for (const factId of claim.supportingFactIds!) assert.ok(page.base!.usedFactIds.includes(factId));
      } else {
        assert.ok(blockTexts.has(claim.text), "a non-factual sentence must be an approved block");
        assert.ok(!/\d/.test(claim.text), "blocks carry no number");
      }
    }
    assert.deepEqual(page.base!.missingFacts.map((m) => m.requirementId), []);
  });
});

test("S5.4-B a topic without blueprint is refused; the production blueprints cover two topics only and are drafts", () => {
  withSimulatedThresholdDecision(() => {
    const open = { ...price("fixture-a", 111.11), relevantTopics: [...PRICE_TOPICS, "pricing-positioning"], usage: { ...approved([...PRICE_TOPICS, "pricing-positioning"]), displayConstraints: MEASURED } } as unknown as LocalFact;
    const page = build(registryOf(open), "fixture-a", "pricing-positioning");
    assert.equal(page.baseStatus, "ready_for_editorial_review", "the S4 page is valid; only the structure is missing");
    assert.equal(page.status, "refused");
    assert.ok(page.reasons.includes("no_blueprint"));
  });
  assert.deepEqual(Object.keys(DRAFT_BLUEPRINTS).sort(), ["market-analysis", "pricing-guide"]);
  for (const blueprint of Object.values(DRAFT_BLUEPRINTS)) {
    assert.equal(blueprint!.reviewStatus, "draft");
    assert.equal(blueprint!.depth.thresholdBasis, "provisional_pending_human_decision");
  }
});

test("S5.4-B without the simulated threshold decision the real engine renders no optional context: pages stay refused", () => {
  const page = build(FULL(), "fixture-a", "pricing-guide");
  assert.equal(page.status, "refused");
  assert.ok(page.reasons.includes("context_fact_missing"));
  assert.ok(page.metrics!.unansweredSlots.includes("demand"));
});

test("S5.4-B robustness and determinism: bad input is refused, identical input gives identical output", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    assert.equal(assembleEditorialPage(null as never).status, "refused");
    assert.deepEqual(assembleEditorialPage({ registry, catalog: { blocks: [] } as never, target: scopeOf("fixture-a"), platform: "airbnb", propertyType: null, topic: "pricing-guide", asOf: ASOF, language: "en" }).reasons, ["invalid_request"]);
    const fr = assembleEditorialPage({ registry, catalog: catalogOf(), target: scopeOf("fixture-a"), platform: "airbnb", propertyType: null, topic: "pricing-guide", asOf: ASOF, language: "fr" as never });
    assert.equal(fr.status, "refused");
    const x = JSON.stringify(build(registry, "fixture-a", "pricing-guide"));
    assert.equal(JSON.stringify(build(registry, "fixture-a", "pricing-guide")), x);
    const keys = [{ key: "b", page: build(registry, "fixture-b", "pricing-guide") }, { key: "a", page: build(registry, "fixture-a", "pricing-guide") }];
    assert.equal(JSON.stringify(compareEditorialPages(keys)), JSON.stringify(compareEditorialPages([...keys].reverse())));
  });
});

test("S5.4-E pricing-guide: median, lower and upper quartile, a local context note, limits and no pricing advice", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    const a = build(registry, "fixture-a", "pricing-guide");
    const b = build(registry, "fixture-b", "pricing-guide");
    assert.equal(a.status, "fixture_demo_only", JSON.stringify(a.reasons));
    const prices = a.sections.find((s) => s.slotId === "prices")!;
    assert.deepEqual(prices.claims.map((c) => c.claimId), ["claim:fact:nightly_price_distribution", "claim:fact:nightly_price_distribution:p25", "claim:fact:nightly_price_distribution:p75"]);
    assert.match(prices.claims[0]!.text, /median nightly price is €111\.11/);
    assert.match(prices.claims[1]!.text, /lower-quartile nightly price is €89\.00/);
    assert.match(prices.claims[2]!.text, /upper-quartile nightly price is €133\.00/);
    assert.equal(a.metrics!.distinctFacts, 2, "two facts: the price distribution and the demand note");
    assert.equal(a.metrics!.factualClaims, 4, "four claims: three statistics and the note");
    // the quartiles are the fact's own values, never computed by the engine
    const fact = registry.get("fact:fixture:fixture-a:price:2026q3:v1")!;
    assert.deepEqual(prices.claims.flatMap((c) => (c as unknown as { figures: { valuePath: string; literal: string }[] }).figures.filter((f) => f.valuePath !== "sampleSize").map((f) => f.valuePath)), ["median", "p25", "p75"]);
    assert.equal((fact.value as { p25: number }).p25, 89);
    // limits of interpretation come from derived data, and a block says what the figure does not show only if one is approved
    const limits = a.sections.find((s) => s.slotId === "limits")!;
    assert.equal(limits.limits!.length, 2);
    // nothing in a non-factual sentence advises a price or states an amount
    for (const claim of a.sections.flatMap((s) => s.claims).filter((c) => c.kind !== "factual")) {
      assert.ok(!/\b(raise|lower|increase|decrease|charge|undercut|competitive|cheap|expensive|cost)\b/i.test(claim.text), claim.text);
      assert.ok(!/[\d€$£%]/.test(claim.text), claim.text);
    }
    // two cities: the amounts and the local note differ; the explanations are shared
    const text = (p: EditorialPage, slot: string) => p.sections.find((s) => s.slotId === slot)!.claims.map((c) => c.text);
    assert.notDeepEqual(text(a, "prices"), text(b, "prices"));
    assert.notDeepEqual(text(a, "demand"), text(b, "demand"));
    assert.deepEqual(text(a, "introduction"), text(b, "introduction"));
    const report = measureRepetition([{ key: "a", page: a }, { key: "b", page: b }]);
    assert.equal(report.pages[0]!.placedClaims, 9);
    assert.equal(report.pairs[0]!.factDifferences, 4);
    // enrichment is not a quality verdict: more data does not lower the share of wording the two pages have in common
    assert.ok(report.pages[0]!.sharedTemplateShare! > 0.6, "still above the provisional threshold, reported and not decided");
    assert.equal(report.thresholdsApplied, false);
    assert.equal(a.publishable, false);
  });
});
