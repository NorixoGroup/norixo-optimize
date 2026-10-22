import assert from "node:assert/strict";
import test from "node:test";

import { createEditorialCatalog, sha256Hex, type EditorialCatalog } from "../lib/seo/v3/editorialCatalog";
import { assembleEditorialPage, compareEditorialPages, DRAFT_BLUEPRINTS, DRAFT_PRICING_GUIDE_ENRICHED, measureRepetition, type Blueprints, type EditorialPage } from "../lib/seo/v3/editorialPage";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import type { LocalFact } from "../lib/seo/v3/localFact";
import { TOPIC_REQUIREMENTS } from "../lib/seo/v3/topicRequirements";
import type { LocalSeoTopicSlug } from "../lib/seo/v3/topics";
import { withSimulatedThresholdDecision } from "./seo-v3-demo-thresholds";

/**
 * S5.4-F tests: several local facts per page. FICTIONAL data only (fixture-a/b/c/d, ZZ, "test only"). The requirement
 * table change used here (neighbourhood_context as an optional pricing-guide requirement) is SIMULATED in this process by
 * seo-v3-demo-thresholds.ts: it has not been authorised. Nothing here is an approval and nothing is publishable.
 *
 *   npx tsx scripts/seo-v3-local-facts.test.ts
 */

const ASOF = "2026-10-01T00:00:00Z";
const MEASURED = ["show_sample_size", "show_observation_period", "show_confidence"];
const PUB = "Fixture Publisher (test only)";
const scopeOf = (slug: string) => ({ level: "city", countryCode: "ZZ", citySlug: slug }) as const;

const licensed = () => ({
  sourceId: "fixture-licensed", sourceType: "licensed_dataset", publisher: PUB, title: null, locator: { kind: "document_citation", citation: "FIXTURE" }, publishedAt: "2026-08-15",
  consultedAt: "2026-09-01T09:00:00Z", collectionMethod: { kind: "dataset_download", description: "fixture" }, termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
  publicationRestrictions: [], evidence: [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }],
});
const editorial = () => ({ ...licensed(), sourceId: "fixture-editorial", sourceType: "editorial_note", locator: { kind: "internal_reference", reference: "fixture-editorial-note" }, collectionMethod: { kind: "editorial_judgement", description: "fixture" }, evidence: [{ kind: "internal_record", reference: "fixture-record" }] });
const approved = (topics: string[]) => ({ use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-03T10:00:00Z", scope: topics } } });
const common = (slug: string, id: string) => ({
  factId: `fact:fixture:${slug}:${id}:2026q3:v1`, scope: scopeOf(slug), platform: "airbnb", propertyType: null, unit: null, collectedAt: "2026-09-01T10:00:00Z", validUntil: "2026-12-01T00:00:00Z",
  confidence: { level: "high", rationale: "FIXTURE" }, validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-02T10:00:00Z", note: null }, version: 1, supersedes: null,
});
const price = (slug: string, median: number): LocalFact =>
  ({ ...common(slug, "price"), kind: "quantitative", source: licensed(), observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, usage: { ...approved(["pricing-guide", "market-analysis"]), displayConstraints: MEASURED }, relevantTopics: ["pricing-guide", "market-analysis"],
    value: { metric: "nightly_price_distribution", currency: "EUR", median, p25: Math.round(median * 0.8), p75: Math.round(median * 1.2), sampleSize: 25 } }) as unknown as LocalFact;
const note = (slug: string, id: string, category: string, statement: string, topics = ["pricing-guide"]): LocalFact =>
  ({ ...common(slug, id), kind: "qualitative", source: editorial(), observedPeriod: null, usage: { ...approved(topics), displayConstraints: ["label_as_editorial_note"] }, relevantTopics: topics,
    value: { category, statement, language: "en", basis: "editorial_observation" } }) as unknown as LocalFact;
const calendar = (slug: string, ratio: number): LocalFact =>
  ({ ...common(slug, "calendar"), kind: "quantitative", source: licensed(), observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, usage: { ...approved(["market-analysis"]), displayConstraints: [...MEASURED, "label_as_unavailability_not_occupancy"] }, relevantTopics: ["market-analysis"],
    value: { metric: "calendar_unavailability_rate", ratio, semantics: "calendar_unavailability_not_occupancy", observedNights: 900, sampleSize: 25 } }) as unknown as LocalFact;

const DEMAND_A = "FIXTURE demand note for the first fictional city: guests arrive for weekend breaks from neighbouring towns, recorded for tests only.";
const DEMAND_B = "FIXTURE demand note for the second fictional city: a yearly trade fair brings professionals to the exhibition quarter, recorded for tests only.";
const AREA_A = "FIXTURE area note for the first fictional city: stays gather around the old harbour and the railway station, recorded for tests only.";
const AREA_B = "FIXTURE area note for the second fictional city: stays gather near the exhibition centre and along the river promenade, recorded for tests only.";

function registryOf(...facts: LocalFact[]): FactRegistry {
  const registry = createFactRegistry();
  for (const fact of facts) assert.equal(registry.register(fact).ok, true, JSON.stringify(registry.register(fact)));
  return registry;
}
const FULL = () =>
  registryOf(
    price("fixture-a", 111.11), note("fixture-a", "demand", "demand_driver", DEMAND_A), note("fixture-a", "area", "neighbourhood_context", AREA_A), calendar("fixture-a", 0.37),
    price("fixture-b", 142.5), note("fixture-b", "demand", "demand_driver", DEMAND_B), note("fixture-b", "area", "neighbourhood_context", AREA_B), calendar("fixture-b", 0.52),
  );

type Spec = { blockId: string; kind: "editorial_non_factual" | "methodological_advice" | "explicit_hypothesis"; topic: LocalSeoTopicSlug; text: string; marker?: string };
const BLOCKS: readonly Spec[] = [
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
const CATALOG: EditorialCatalog = createEditorialCatalog(BLOCKS.map((b) => ({
  blockId: b.blockId, language: "en", kind: b.kind, text: b.text, topics: [b.topic], hypothesisMarker: b.marker ?? null,
  approval: { status: "approved", approvedBy: "fixture-reviewer (test only)", approvedAt: "2026-09-10T00:00:00Z", textHash: sha256Hex(b.text) },
})));
const ENRICHED: Blueprints = { "pricing-guide": DRAFT_PRICING_GUIDE_ENRICHED };
const build = (registry: FactRegistry, slug: string, topic: LocalSeoTopicSlug = "pricing-guide", blueprints?: Blueprints): EditorialPage =>
  assembleEditorialPage({ registry, catalog: CATALOG, target: scopeOf(slug), platform: "airbnb", propertyType: null, topic, asOf: ASOF, language: "en", ...(blueprints === undefined ? {} : { blueprints }) });

test("S5.4-G real table: neighbourhood_context is an optional requirement of pricing-guide only", () => {
  const spec = TOPIC_REQUIREMENTS["pricing-guide"];
  assert.deepEqual(spec.required.map((r) => r.requirementId), ["nightly_price_distribution"]);
  assert.deepEqual(spec.optional.map((r) => r.requirementId), ["demand_driver", "neighbourhood_context"]);
  const added = spec.optional.find((r) => r.requirementId === "neighbourhood_context")!;
  assert.equal(added.thresholdBasis, "provisional_pending_human_decision", "its threshold is not approved");
  // the other topics keep their own lists
  for (const topic of Object.keys(TOPIC_REQUIREMENTS) as LocalSeoTopicSlug[]) {
    if (topic === "pricing-guide") continue;
    const ids = [...TOPIC_REQUIREMENTS[topic].required, ...TOPIC_REQUIREMENTS[topic].optional].map((r) => r.requirementId);
    if (topic === "business-travel-guide") assert.ok(ids.includes("neighbourhood_context"));
    else assert.ok(!ids.includes("neighbourhood_context") || ["business-travel-guide"].includes(topic), topic);
  }
  // with the provisional threshold the real engine does not render the note: the page is refused (the slot is no longer a plan/table mismatch)
  const page = build(FULL(), "fixture-a", "pricing-guide", ENRICHED);
  assert.equal(page.status, "refused");
  assert.deepEqual(page.metrics!.slotsWithoutRequirement, []);
  assert.ok(page.metrics!.unansweredSlots.includes("area"));
});

test("S5.4-F simulated thresholds: several local facts are placed, each with its own traceable claims", () => {
  withSimulatedThresholdDecision(() => {
    const page = build(FULL(), "fixture-a", "pricing-guide", ENRICHED);
    assert.equal(page.status, "fixture_demo_only", JSON.stringify(page.reasons));
    assert.deepEqual(page.metrics!.slotsWithoutRequirement, []);
    assert.equal(page.metrics!.distinctFacts, 3);
    assert.deepEqual(page.metrics!.distinctFactCategories, ["qualitative:demand_driver", "qualitative:neighbourhood_context", "quantitative:nightly_price_distribution"]);
    assert.equal(page.metrics!.contextFacts, 2);
    assert.equal(page.metrics!.factualClaims, 5, "three price statistics and two notes");
    assert.deepEqual(page.sections.filter((s) => s.role === "local_facts").map((s) => s.slotId), ["prices", "demand", "area"]);
    assert.equal(page.placedFactIds.length, 3);
    assert.ok(page.placedFactIds.every((id) => (page.base!.usedFactIds as readonly string[]).includes(id)));
    assert.deepEqual(page.metrics!.unplacedClaimIds, [], "nothing on the S4 page is left out");
    // the calendar fact is not relevant to this topic: it is not on the page
    assert.ok(!page.placedFactIds.some((id) => id.includes(":calendar:")));
  });
});

test("S5.4-F optional facts: an absent optional fact never blocks, and a missing one is not replaced by text", () => {
  withSimulatedThresholdDecision(() => {
    const noArea = registryOf(price("fixture-a", 111.11), note("fixture-a", "demand", "demand_driver", DEMAND_A));
    // the S5.4-E plan, which does not ask for the area: accepted exactly as before
    const classic = build(noArea, "fixture-a");
    assert.equal(classic.status, "fixture_demo_only");
    assert.equal(classic.metrics!.distinctFacts, 2);
    // the enriched plan asks for more: refused for depth, not for a missing optional slot
    const enriched = build(noArea, "fixture-a", "pricing-guide", ENRICHED);
    assert.equal(enriched.status, "refused");
    assert.deepEqual(enriched.reasons, ["too_few_context_facts", "too_few_distinct_facts", "too_few_fact_categories"]);
    assert.ok(enriched.metrics!.unansweredSlots.includes("area"));
    assert.ok(!enriched.reasons.includes("required_slot_unanswered"));
  });
});

test("S5.4-F relevance: a fact the topic does not use cannot be added to lengthen a page", () => {
  withSimulatedThresholdDecision(() => {
    const visual = note("fixture-a", "visual", "visual_character", "FIXTURE visual note for the first fictional city, recorded for tests only.");
    const withExtra = registryOf(price("fixture-a", 111.11), note("fixture-a", "demand", "demand_driver", DEMAND_A), note("fixture-a", "area", "neighbourhood_context", AREA_A), visual, calendar("fixture-a", 0.37));
    const base = build(FULL(), "fixture-a", "pricing-guide", ENRICHED);
    const padded = build(withExtra, "fixture-a", "pricing-guide", ENRICHED);
    assert.deepEqual(padded.placedFactIds, base.placedFactIds, "the visual and calendar facts, though registered and approved, add nothing");
    assert.equal(JSON.stringify(padded.sections), JSON.stringify(base.sections));
    // a fact that is not declared relevant to the topic is not offered at all
    const wrongTopic = registryOf(price("fixture-a", 111.11), note("fixture-a", "demand", "demand_driver", DEMAND_A), note("fixture-a", "area", "neighbourhood_context", AREA_A, ["market-analysis"]));
    assert.equal(build(wrongTopic, "fixture-a", "pricing-guide", ENRICHED).status, "refused");
  });
});

test("S5.4-F duplicates: two notes with the same statement are refused as padding", () => {
  withSimulatedThresholdDecision(() => {
    const twin = registryOf(price("fixture-a", 111.11), note("fixture-a", "demand", "demand_driver", DEMAND_A), note("fixture-a", "area", "neighbourhood_context", DEMAND_A));
    const page = build(twin, "fixture-a", "pricing-guide", ENRICHED);
    assert.equal(page.status, "refused");
    assert.ok(page.reasons.includes("duplicate_fact_statement"));
  });
});

test("S5.4-F cities and topics: distinct facts per city and per topic, shared price only", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    const a = build(registry, "fixture-a", "pricing-guide", ENRICHED);
    const b = build(registry, "fixture-b", "pricing-guide", ENRICHED);
    const marketA = build(registry, "fixture-a", "market-analysis");
    const marketB = build(registry, "fixture-b", "market-analysis");
    for (const page of [a, b, marketA, marketB]) assert.equal(page.status, "fixture_demo_only", JSON.stringify(page.reasons));
    const cmp = compareEditorialPages([{ key: "a/price", page: a }, { key: "b/price", page: b }, { key: "a/market", page: marketA }, { key: "b/market", page: marketB }]);
    const pair = (x: string, y: string) => cmp.pairs.find((p) => p.a === x && p.b === y)!;
    assert.deepEqual(pair("a/price", "b/price").codes, [], "two cities: different notes, not only different amounts");
    assert.deepEqual(pair("a/market", "a/price").codes, [], "two topics of one city: distinct facts");
    assert.equal(pair("a/market", "a/price").sharedFactIds.length, 1);
    assert.deepEqual(pair("a/market", "b/market").codes, ["numeric_only_difference"], "market-analysis still differs only by figures: it needs its own context facts");
    assert.ok(a.metrics!.distinctFacts > marketA.metrics!.distinctFacts);
  });
});

test("S5.4-F measures: more distinct facts and a larger specific share than the S5.4-E plan, without any added text", () => {
  withSimulatedThresholdDecision(() => {
    const registry = FULL();
    const classicA = build(registry, "fixture-a");
    const classicB = build(registry, "fixture-b");
    const richA = build(registry, "fixture-a", "pricing-guide", ENRICHED);
    const richB = build(registry, "fixture-b", "pricing-guide", ENRICHED);
    const before = measureRepetition([{ key: "a", page: classicA }, { key: "b", page: classicB }]);
    const after = measureRepetition([{ key: "a", page: richA }, { key: "b", page: richB }]);
    assert.equal(classicA.metrics!.distinctFacts, 2);
    assert.equal(richA.metrics!.distinctFacts, 3);
    assert.equal(classicA.metrics!.distinctFactCategories.length, 2);
    assert.equal(richA.metrics!.distinctFactCategories.length, 3);
    // the engine added no sentence of its own: the extra claims are exactly the extra fact's claim
    assert.equal(after.pages[0]!.placedClaims, before.pages[0]!.placedClaims + 1);
    assert.equal(after.pairs[0]!.identicalSentences, before.pairs[0]!.identicalSentences, "the shared sentences are the same approved blocks");
    assert.ok(after.pages[0]!.specificShare! > before.pages[0]!.specificShare!, "the specific share rises only because a further local fact is stated");
    assert.ok(after.pages[0]!.sharedTemplateShare! > 0.6, "still above the provisional threshold: reported, not decided");
    assert.equal(after.thresholdsApplied, false);
    assert.equal(after.pairs[0]!.factDifferences, 6);
  });
});

test("S5.4-F nothing is publishable: statuses, flags and the restored tables", () => {
  const before = TOPIC_REQUIREMENTS["pricing-guide"];
  withSimulatedThresholdDecision(() => {
    for (const slug of ["fixture-a", "fixture-b"]) {
      const page = build(FULL(), slug, "pricing-guide", ENRICHED);
      assert.equal(page.fixtureOnly, true);
      assert.equal(page.mode, "fixture");
      assert.equal(page.publishable, false);
      assert.equal(page.publicationAuthorised, false);
      assert.equal(page.indexingAuthorised, false);
    }
    assert.notEqual(TOPIC_REQUIREMENTS["pricing-guide"], before, "swapped inside");
  });
  assert.equal(TOPIC_REQUIREMENTS["pricing-guide"], before, "restored");
  assert.throws(() => withSimulatedThresholdDecision((async () => undefined) as never), TypeError);
  assert.equal(TOPIC_REQUIREMENTS["pricing-guide"], before, "restored after an asynchronous attempt");
  assert.deepEqual(Object.keys(DRAFT_BLUEPRINTS).sort(), ["market-analysis", "pricing-guide"]);
});
