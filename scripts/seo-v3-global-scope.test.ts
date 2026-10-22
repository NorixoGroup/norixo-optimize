import assert from "node:assert/strict";
import test from "node:test";

import { createEditorialCatalog, sha256Hex, type EditorialCatalog } from "../lib/seo/v3/editorialCatalog";
import { assembleEditorialPage, DRAFT_BLUEPRINTS, planHashOf, type PageBlueprint } from "../lib/seo/v3/editorialPage";
import { assembleGlobalPage, GLOBAL_PAGE_VERSION, ILLUSTRATION_DISCLAIMER, renderGlobalPageText, textSimilarity, tooSimilar, type GlobalPageSpec } from "../lib/seo/v3/globalPage";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import { isPageScope, LOCAL_SCOPE_MIN_DISTINCT_FACTS } from "../lib/seo/v3/pageScope";
import type { LocalFact } from "../lib/seo/v3/localFact";
import { withSimulatedThresholdDecision } from "./seo-v3-demo-thresholds";

/**
 * S5.4-P tests: page scope (global | local) and the global method page. Fixtures are FICTIONAL (cities `fixture-a`, publishers
 * "test only"); no approval is real and no threshold decision exists.
 *
 *   npx tsx scripts/seo-v3-global-scope.test.ts
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

function registryOf(...facts: LocalFact[]): FactRegistry {
  const registry = createFactRegistry();
  for (const fact of facts) {
    const outcome = registry.register(fact);
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
  }
  return registry;
}

const catalog = (): EditorialCatalog => createEditorialCatalog([
  { blockId: "block:pricing-guide:introduction:1", language: "en", kind: "editorial_non_factual", text: "This guide looks at how local price evidence can inform a nightly rate decision.", topics: ["pricing-guide"], hypothesisMarker: null,
    approval: { status: "approved", approvedBy: "fixture-reviewer (test only)", approvedAt: "2026-09-10T00:00:00Z", textHash: sha256Hex("This guide looks at how local price evidence can inform a nightly rate decision.") } },
]);
const lenient = (scope?: unknown): PageBlueprint => {
  const base = DRAFT_BLUEPRINTS["pricing-guide"]!;
  return {
    ...base,
    slots: base.slots.map((slot) => ({ ...slot, required: false })),
    depth: { ...base.depth, minDistinctFacts: 1, minDistinctFactCategories: 1, requiresContextFact: false, minContextFacts: 0, distinctiveSlotIds: [] },
    ...(scope === undefined ? {} : { scope }),
  } as PageBlueprint;
};
const city = (registry: FactRegistry, blueprint: PageBlueprint) =>
  assembleEditorialPage({ registry, catalog: catalog(), target: scopeOf("fixture-a"), platform: "airbnb", propertyType: null, topic: "pricing-guide", asOf: ASOF, language: "en", blueprints: { "pricing-guide": blueprint } });
const DEMAND = "FIXTURE note for the first fictional city: mostly weekend visitors from nearby towns, written for tests only.";

// --- scope on city pages ---------------------------------------------------------------------------------------

test("S5.4-P scope values and the provisional minimum", () => {
  assert.equal(isPageScope("global"), true);
  assert.equal(isPageScope("local"), true);
  assert.equal(isPageScope("regional"), false);
  assert.equal(isPageScope(undefined), false);
  assert.equal(LOCAL_SCOPE_MIN_DISTINCT_FACTS, 2);
});

test("S5.4-P a plan without a scope keeps its hash and its behaviour; a declared scope changes the hash", () => {
  const base = DRAFT_BLUEPRINTS["pricing-guide"]!;
  assert.equal(planHashOf({ ...base, scope: undefined } as PageBlueprint), planHashOf(base));
  assert.notEqual(planHashOf({ ...base, scope: "local" }), planHashOf(base));
  assert.notEqual(planHashOf({ ...base, scope: "local" }), planHashOf({ ...base, scope: "global" }));
  withSimulatedThresholdDecision(() => {
    const oneFact = registryOf(price("fixture-a", 111.11));
    const legacy = city(oneFact, lenient());
    assert.equal(legacy.status, "fixture_demo_only", JSON.stringify(legacy.reasons));
  });
});

test("S5.4-P local scope: one fact is refused, two distinct facts pass the scope rule (and nothing else is relaxed)", () => {
  withSimulatedThresholdDecision(() => {
    const one = city(registryOf(price("fixture-a", 111.11)), lenient("local"));
    assert.equal(one.status, "refused");
    assert.ok(one.reasons.includes("local_scope_below_minimum_facts"));
    const two = city(registryOf(price("fixture-a", 111.11), demand("fixture-a", DEMAND)), lenient("local"));
    assert.equal(two.status, "fixture_demo_only", JSON.stringify(two.reasons));
    assert.equal(two.placedFactIds.length, 2);
    // the topic's own depth rules still apply on top of the scope rule
    const strict = { ...DRAFT_BLUEPRINTS["pricing-guide"]!, scope: "local" } as PageBlueprint;
    const stillRefused = city(registryOf(price("fixture-a", 111.11)), strict);
    assert.equal(stillRefused.status, "refused");
    assert.ok(stillRefused.reasons.includes("context_fact_missing"));
    assert.ok(stillRefused.reasons.includes("local_scope_below_minimum_facts"));
  });
});

test("S5.4-P a facts of another city are never inherited: the count uses the exact scope", () => {
  withSimulatedThresholdDecision(() => {
    const registry = registryOf(price("fixture-a", 111.11), demand("fixture-b", DEMAND));
    const page = city(registry, lenient("local"));
    assert.equal(page.status, "refused");
    assert.ok(page.reasons.includes("local_scope_below_minimum_facts"));
  });
});

test("S5.4-P a global plan is refused on a city page and an invalid scope is refused", () => {
  withSimulatedThresholdDecision(() => {
    const registry = registryOf(price("fixture-a", 111.11), demand("fixture-a", DEMAND));
    assert.ok(city(registry, lenient("global")).reasons.includes("global_blueprint_on_city_page"));
    const invalid = city(registry, lenient("regional"));
    assert.equal(invalid.status, "refused");
    assert.ok(invalid.reasons.includes("invalid_scope"));
  });
});

// --- global page -----------------------------------------------------------------------------------------------

// JSON-shaped spec edited by the mutation helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const P = (id: string, text: string) => ({ kind: "prose", id, text }) as const;
const goodSpec = (): GlobalPageSpec => ({
  scope: "global", topic: "listing-audit", language: "en", h1: "How to Audit Your Listing Step by Step", searchIntent: "A host wants to find what to fix first in a listing.",
  sections: [
    { sectionId: "s1", role: "introduction", heading: "What an audit is for", blocks: [P("p1", "An audit is a structured review of your own listing that ends with a ranked list of fixes.")] },
    { sectionId: "s2", role: "method", heading: "The method", blocks: [{ kind: "steps", id: "st1", items: ["Write down your goal and your target guest.", "Look at the first impression a traveller gets."] }] },
    { sectionId: "s3", role: "example", heading: "Worked example", blocks: [{
      kind: "illustration", id: "il1", title: "A funnel with invented numbers",
      assumptions: [{ key: "views", label: "Listing views", value: 300, unit: "views" }, { key: "bookings", label: "Bookings", value: 6, unit: "bookings" }],
      steps: [{ key: "rate", label: "Booking rate", op: "div", a: "bookings", b: "views", unit: "", display: "percent" }],
      reading: "Use this as a method on your own numbers, not as a target.",
    }] },
    { sectionId: "s4", role: "common_mistakes", heading: "Common mistakes", blocks: [{ kind: "steps", id: "st2", items: ["Changing many things on the same day."] }] },
    { sectionId: "s5", role: "checklist", heading: "Checklist", blocks: [{ kind: "checklist", id: "ck1", items: ["My goal is written down.", "I know my bottleneck."] }] },
    { sectionId: "s6", role: "faq", heading: "Questions", blocks: [
      { kind: "faq", id: "f1", question: "How often should I audit?", answer: "After each major change and at a regular rhythm that suits you." },
      { kind: "faq", id: "f2", question: "Do I need a tool?", answer: "No, a notebook is enough to follow the method." },
      { kind: "faq", id: "f3", question: "Should I change the price first?", answer: "Audit first, because price is one lever among several." },
    ] },
  ],
  callToAction: { text: "Paste your listing link into NORIXO Optimize to get a prioritised list of fixes." },
});
const mutate = (fn: (spec: Loose) => void): unknown => {
  const spec = JSON.parse(JSON.stringify(goodSpec()));
  fn(spec);
  return spec;
};

test("S5.4-P a valid global page: no city, no fact, pending a person, never publishable", () => {
  const page = assembleGlobalPage(goodSpec(), { placeNames: ["Paris", "France"] });
  assert.equal(page.status, "pending_human_editorial_validation", JSON.stringify(page.reasons));
  assert.equal(page.version, GLOBAL_PAGE_VERSION);
  assert.equal(page.scope, "global");
  assert.equal(page.citySlug, null);
  assert.equal(page.humanEditorialValidationRequired, true);
  assert.equal(page.publishable, false);
  assert.equal(page.publicationAuthorised, false);
  assert.equal(page.indexingAuthorised, false);
  assert.equal(page.metrics!.faqEntries, 3);
  assert.equal(assembleGlobalPage(goodSpec()).contentHash, page.contentHash, "deterministic");
  assert.ok(!JSON.stringify(page).includes("fact:"), "no fact id anywhere");
});

test("S5.4-P global page: wrong scope, topic, language, shape and unexpected fields are refused", () => {
  const reason = (spec: unknown) => assembleGlobalPage(spec).reasons;
  assert.deepEqual(reason(mutate((s) => { s.scope = "local"; })), ["scope_not_global"]);
  assert.deepEqual(reason(mutate((s) => { delete s.scope; })), ["scope_not_global"]);
  assert.deepEqual(reason(mutate((s) => { s.topic = "no-such-topic"; })), ["unknown_topic"]);
  assert.deepEqual(reason(mutate((s) => { s.language = "fr"; })), ["language_not_supported"]);
  assert.deepEqual(reason(mutate((s) => { s.citySlug = "paris"; })), ["unexpected_field"], "a city cannot be attached");
  assert.deepEqual(reason(null), ["malformed_spec"]);
  assert.deepEqual(reason("page"), ["malformed_spec"]);
});

test("S5.4-P no number in prose: digits, percent and currency signs are refused everywhere", () => {
  for (const text of ["Most listings gain 20 photos.", "Aim for 3 percent more.", "Raise your price by 5%.", "A nightly rate of $120 works.", "Try \u20ac80 per night.", "Aim for \u0661\u0662 photos."]) {
    const refused = assembleGlobalPage(mutate((s) => { s.sections[0].blocks[0].text = text; }));
    assert.equal(refused.status, "refused", text);
    assert.ok(refused.reasons.includes("digit_in_prose"), text);
  }
  assert.ok(assembleGlobalPage(mutate((s) => { s.h1 = "10 Tips to Audit"; })).reasons.includes("digit_in_prose"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.callToAction.text = "Get 50 more bookings."; })).reasons.includes("digit_in_prose"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[5].blocks[0].answer = "Typically 2 weeks."; })).reasons.includes("digit_in_prose"));
});

test("S5.4-P statements about the world are refused: averages, trends, platform authority, guarantees, comparisons", () => {
  for (const text of ["On average, hosts earn more in summer.", "Prices are rising every year.", "Airbnb always ranks complete listings higher.", "This method guarantees more bookings.", "Hosts in this market earn more than elsewhere."]) {
    const refused = assembleGlobalPage(mutate((s) => { s.sections[0].blocks[0].text = text; }));
    assert.equal(refused.status, "refused", text);
    assert.ok(refused.reasons.includes("factual_wording"), `${text} -> ${refused.reasons.join(",")}`);
  }
});

test("S5.4-P a global page names no place when the caller lists place names; French text is refused", () => {
  const withParis = mutate((s) => { s.sections[0].blocks[0].text = "In Paris, an audit is a structured review of your own listing."; });
  assert.ok(assembleGlobalPage(withParis, { placeNames: ["Paris"] }).reasons.includes("place_name_in_global_page"));
  assert.equal(assembleGlobalPage(withParis).status, "pending_human_editorial_validation", "without the list nothing is claimed about places");
  const french = mutate((s) => { s.sections[0].blocks[0].text = "Un audit est une revue structurée de votre annonce, avec une liste de corrections classées par priorité."; });
  assert.ok(assembleGlobalPage(french).reasons.includes("language_not_verified"));
});

test("S5.4-P structure: required roles, FAQ minimum, unique ids, sober call to action", () => {
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections = s.sections.filter((x: Loose) => x.role !== "checklist"); })).reasons.includes("missing_role"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[5].blocks.pop(); })).reasons.includes("too_few_faq"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[1].sectionId = "s1"; })).reasons.includes("duplicate_id"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[1].blocks[0].id = "p1"; })).reasons.includes("duplicate_id"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.callToAction.text = "Sign up now!"; })).reasons.includes("call_to_action_invalid"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[0].blocks = []; })).reasons.includes("section_empty"));
});

test("S5.4-P hypothetical illustration: results are computed from the structure and labelled; the disclaimer cannot be changed", () => {
  const page = assembleGlobalPage(goodSpec());
  const item = page.sections.find((s) => s.role === "example")!.items[0]!;
  assert.equal(item.kind, "illustration");
  if (item.kind !== "illustration") return;
  assert.equal(item.usableAsEvidence, false);
  assert.equal(item.disclaimer, ILLUSTRATION_DISCLAIMER);
  assert.deepEqual(item.lines, ["Assumption: Listing views = 300 views", "Assumption: Bookings = 6 bookings", "Calculation: Booking rate = bookings / views = 2%"]);
  assert.ok(renderGlobalPageText(page).includes(ILLUSTRATION_DISCLAIMER));
  // an author cannot type a result, a disclaimer or a fact reference
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[2].blocks[0].disclaimer = "These are real statistics."; })).reasons.includes("malformed_spec"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[2].blocks[0].steps[0].result = 99; })).reasons.includes("illustration_invalid"));
  assert.ok(assembleGlobalPage(mutate((s) => { s.sections[2].blocks[0].assumptions[0].factId = "fact:x"; })).reasons.includes("illustration_invalid"));
});

test("S5.4-P illustration arithmetic and references are checked", () => {
  const ill = (fn: (block: Loose) => void) => assembleGlobalPage(mutate((s) => fn(s.sections[2].blocks[0])));
  assert.ok(ill((b) => { b.steps[0].b = "missing"; }).reasons.includes("illustration_unresolved_reference"));
  assert.ok(ill((b) => { b.assumptions[0].value = 0; }).reasons.includes("illustration_arithmetic"), "division by zero");
  assert.ok(ill((b) => { b.assumptions[0].value = Number.POSITIVE_INFINITY; }).reasons.includes("illustration_invalid"));
  assert.ok(ill((b) => { b.assumptions[0].value = 1e12; }).reasons.includes("illustration_invalid"));
  assert.ok(ill((b) => { b.assumptions[1].key = "views"; }).reasons.includes("illustration_invalid"), "duplicate key");
  assert.ok(ill((b) => { b.steps[0].op = "pow"; }).reasons.includes("illustration_invalid"));
  assert.ok(ill((b) => { b.steps = []; }).reasons.includes("malformed_spec"));
  // numbers cannot hide in labels, units or the reading
  assert.ok(ill((b) => { b.assumptions[0].label = "Views in 2026"; }).reasons.includes("illustration_wording"));
  assert.ok(ill((b) => { b.steps[0].unit = "50%"; }).reasons.includes("illustration_wording"));
  assert.ok(ill((b) => { b.reading = "Real hosts reach 10 percent."; }).reasons.includes("digit_in_prose"));
  assert.ok(ill((b) => { b.reading = "Hosts on average reach this."; }).reasons.includes("factual_wording"));
  // a chain of steps uses earlier results
  const chained = ill((b) => {
    b.assumptions.push({ key: "hoped", label: "Hoped rate", value: 0.5, unit: "" });
    b.steps.push({ key: "more", label: "More bookings", op: "mul", a: "views", b: "hoped", unit: "bookings", display: "number" }, { key: "gain", label: "Gain", op: "sub", a: "more", b: "bookings", unit: "bookings", display: "number" }, { key: "total", label: "Total", op: "add", a: "more", b: "gain", unit: "bookings", display: "number" });
  });
  assert.equal(chained.status, "pending_human_editorial_validation", JSON.stringify(chained.reasons));
  const lines = (chained.sections.find((s) => s.role === "example")!.items[0] as unknown as { lines: string[] }).lines;
  assert.equal(lines.at(-2), "Calculation: Gain = more - bookings = 144 bookings");
  assert.equal(lines.at(-1), "Calculation: Total = more + gain = 294 bookings");
});

test("S5.4-P duplication: a copy with a swapped word is flagged, a different page is not", () => {
  const base = renderGlobalPageText(assembleGlobalPage(goodSpec()));
  const copy = base.replace("Listing views", "Listing visits");
  assert.ok(tooSimilar(base, copy), String(textSimilarity(base, copy)));
  assert.equal(textSimilarity(base, base), 1);
  const other = renderGlobalPageText(assembleGlobalPage(mutate((s) => {
    s.topic = "photo-order"; s.h1 = "Ordering Photos";
    s.sections[0].blocks[0].text = "Photo order is the sequence in which a traveller meets your space, from the cover to the last image.";
    s.sections[1].blocks[0].items = ["List your strongest views of the space.", "Put the image that best fits your guest first."];
    s.sections[3].blocks[0].items = ["Starting with a hallway picture."];
    s.sections[4].blocks[0].items = ["The cover shows the main living space."];
    s.sections[5].blocks.forEach((b: Loose, i: number) => { b.question = `Question number ${["one", "two", "three"][i]} about photo sequence?`; b.answer = `A different answer ${["alpha", "beta", "gamma"][i]} about showing rooms in a sensible order.`; });
  })));
  assert.ok(!tooSimilar(base, other), String(textSimilarity(base, other)));
});

test("S5.4-P a plain-text render of a refused page is empty", () => {
  assert.equal(renderGlobalPageText(assembleGlobalPage(null)), "");
});
