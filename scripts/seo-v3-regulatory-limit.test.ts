import assert from "node:assert/strict";
import test from "node:test";

import { renderFactualClaim } from "../lib/seo/v3/claimRender";
import { validateClaim } from "../lib/seo/v3/claimValidation";
import { sha256Hex } from "../lib/seo/v3/editorialCatalog";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import { evaluateTopicFacts } from "../lib/seo/v3/topicFactEvaluation";
import { FACT_FILE_SCHEMA, importFactStore } from "../lib/seo/v3/factStore";
import type { LocalFact } from "../lib/seo/v3/localFact";
import { SOURCE_REGISTRY_SCHEMA } from "../lib/seo/v3/sourceRegistry";
import { TOPIC_REQUIREMENTS, type FactRequirement, type TopicRequirements } from "../lib/seo/v3/topicRequirements";
import { runExclusive } from "./seo-v3-test-guard";

/**
 * S5.4-L tests: a regulatory fact may carry a STRUCTURED numeric limit, rendered only from that structure and checked by S3.
 * Everything is FICTIONAL: city fixture-city (ZZ), authority "Fixture Council (test only)", invented limits. Nothing here is a
 * real rule, a source approval or a publication. The long-stay threshold is provisional in the real table; one helper treats
 * it as confirmed for the duration of a test, in this process only, so that S3's wording and number checks can be seen alone.
 *
 *   npx tsx scripts/seo-v3-regulatory-limit.test.ts
 */

const AS_OF = "2026-10-22T17:00:00Z";
const SCOPE = { level: "city", countryCode: "ZZ", citySlug: "fixture-city" } as const;
const OTHER = { level: "city", countryCode: "ZZ", citySlug: "other-city" } as const;
const TOPIC = "long-stay-guide";
const LIMIT = { direction: "maximum", value: 90, unit: "days", per: "calendar_year", condition: "main_residence" } as const;

const source = () => ({
  sourceId: "fixture-council", sourceType: "official_authority", publisher: "Fixture Council (test only)", title: null, locator: { kind: "document_citation", citation: "FIXTURE act" },
  publishedAt: "2026-01-10", consultedAt: "2026-09-10T09:00:00Z", collectionMethod: { kind: "manual_reading", description: "fixture" },
  termsOfUse: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" }, publicationRestrictions: ["attribution_required"],
  evidence: [{ kind: "content_hash", algorithm: "sha256", value: "a".repeat(64) }],
});
const common = {
  platform: "airbnb", propertyType: null, unit: null, source: source(), collectedAt: "2026-09-10T10:00:00Z", observedPeriod: null, validUntil: "2027-03-01T00:00:00Z",
  confidence: { level: "high", rationale: "FIXTURE" }, validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-11T10:00:00Z", note: null },
  usage: { use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-12T10:00:00Z", scope: [TOPIC] } }, displayConstraints: ["attribute_source"] },
  relevantTopics: [TOPIC], version: 1, supersedes: null,
};
const zone = (scope: typeof SCOPE | typeof OTHER = SCOPE): LocalFact =>
  ({ ...common, factId: `fact:fixture:${scope.citySlug}:tz:2026:v1`, kind: "geographic", scope, platform: null, usage: { ...common.usage, displayConstraints: [] }, value: { attribute: "timezone", value: "Europe/Paris" } }) as unknown as LocalFact;
const ruleFact = (value: Record<string, unknown> = {}, over: Record<string, unknown> = {}, scope: typeof SCOPE | typeof OTHER = SCOPE): LocalFact =>
  ({ ...common, factId: `fact:fixture:${scope.citySlug}:rule:2026:v1`, kind: "regulatory", scope,
    value: { ruleType: "night_cap", rule: "FIXTURE rule text without any figure.", effectiveFrom: "2026-01-01", effectiveUntil: null, officialReference: "FIXTURE act, article 1", limit: LIMIT, ...value }, ...over }) as unknown as LocalFact;
const registryOf = (...facts: LocalFact[]): FactRegistry => {
  const registry = createFactRegistry();
  for (const fact of facts) {
    const outcome = registry.register(fact);
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
  }
  return registry;
};
const ctx = (scope: typeof SCOPE | typeof OTHER = SCOPE, asOf = AS_OF) => ({ target: scope, platform: "airbnb", propertyType: null, topic: TOPIC, asOf, use: "public" }) as never;

/** TEST SUPPORT: the long-stay rule's provisional threshold treated as confirmed, in this process only (not a human decision). */
function withConfirmedThreshold<T>(fn: () => T): T {
  const table = TOPIC_REQUIREMENTS as Record<string, TopicRequirements>;
  const original = table[TOPIC]!;
  return runExclusive("withConfirmedThreshold", fn, () => { table[TOPIC] = original; }, () => {
    table[TOPIC] = { ...original, optional: original.optional.map((r) => (r.requirementId === "long_stay_rule" ? ({ ...r, thresholdBasis: "aligned_with_v2_public_overview" } as FactRequirement) : r)) };
  });
}

function claimOf(fact: LocalFact) {
  const rendered = renderFactualClaim([{ fact }]);
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  if (!rendered.ok) throw new Error("unreachable");
  return { claimId: "claim:t", sectionId: "sec:t", kind: "factual", text: rendered.value.text, supportingFactIds: [...rendered.value.supportingFactIds], figures: rendered.value.figures.map((f) => ({ ...f })), inheritedDisplayConstraints: [...rendered.value.inheritedDisplayConstraints] };
}
const verdict = (registry: FactRegistry, claim: unknown, context = ctx()) => validateClaim(claim as never, context, registry);
const codes = (result: ReturnType<typeof verdict>): string[] => result.findings.map((f) => f.code as string).sort();

test("S5.4-L correct limit: 90 days is rendered from the structure, backed by its figure, and accepted by S3", () => {
  withConfirmedThreshold(() => {
    const fact = ruleFact();
    const registry = registryOf(zone(), fact);
    const claim = claimOf(fact);
    assert.equal(claim.text, "In fixture-city, ZZ, the annual limit on rental days for a furnished tourist rental declared as the host's main residence is 90 days. (in force from 2026-01-01) (source: Fixture Council (test only))");
    assert.deepEqual(claim.figures, [{ literal: "90", factId: fact.factId, valuePath: "limit.value" }]);
    const result = verdict(registry, claim);
    assert.equal(result.verdict, "accepted", JSON.stringify(codes(result)));
  });
});

test("S5.4-L another limit with its own proof: 120 days is accepted exactly like 90", () => {
  withConfirmedThreshold(() => {
    const fact = ruleFact({ limit: { ...LIMIT, value: 120 } });
    const result = verdict(registryOf(zone(), fact), claimOf(fact));
    assert.equal(result.verdict, "accepted", JSON.stringify(codes(result)));
    assert.match(claimOf(fact).text, /is 120 days\./);
  });
});

test("S5.4-L invented or altered values are refused: the number must equal the structured limit", () => {
  withConfirmedThreshold(() => {
    const fact = ruleFact();
    const registry = registryOf(zone(), fact);
    const good = claimOf(fact);
    const cases: [string, (c: typeof good) => void, string][] = [
      ["a value that is nowhere in the fact", (c) => { c.text = c.text.replace("90 days", "100 days"); c.figures[0]!.literal = "100"; }, "figure_value_mismatch"],
      ["90 turned into 120 (text and figure)", (c) => { c.text = c.text.replace("90 days", "120 days"); c.figures[0]!.literal = "120"; }, "figure_value_mismatch"],
      ["90 turned into 120 (text only)", (c) => { c.text = c.text.replace("90 days", "120 days"); }, "figure_not_in_text"],
      ["a number with no figure", (c) => { c.figures = []; }, "unbacked_number"],
      ["a second, unbacked number", (c) => { c.text = c.text.replace("main residence", "main residence for 2 guests"); }, "unbacked_number"],
      ["an inconsistent unit (nights instead of days)", (c) => { c.text = c.text.replace("90 days", "90 nights"); }, "figure_value_mismatch"],
    ];
    for (const [label, edit, expected] of cases) {
      const claim = structuredClone(good);
      edit(claim);
      const result = verdict(registry, claim);
      assert.equal(result.verdict, "rejected", label);
      assert.ok(codes(result).includes(expected) || codes(result).includes("rendered_text_mismatch"), `${label}: ${JSON.stringify(codes(result))}`);
      assert.ok(codes(result).includes("rendered_text_mismatch") || codes(result).includes("rendered_selection_invalid"), `${label}: the text is no longer the rendering of the fact`);
    }
  });
});

test("S5.4-L the sense and the conditions cannot be changed: maximum/minimum, the main residence, the period and the place", () => {
  withConfirmedThreshold(() => {
    const fact = ruleFact();
    const registry = registryOf(zone(), fact);
    const good = claimOf(fact);
    const edits: [string, string, string][] = [
      ["maximum turned into minimum", "the annual limit on rental days", "the minimum number of rental days"],
      ["the condition 'main residence' removed", " for a furnished tourist rental declared as the host's main residence", ""],
      ["the condition widened to all listings", "for a furnished tourist rental declared as the host's main residence", "for furnished tourist rentals"],
      ["the annual period dropped", "annual limit", "limit"],
      ["the place generalised", "In fixture-city, ZZ,", "In ZZ,"],
      ["the entry date removed", " (in force from 2026-01-01)", ""],
      ["the attribution removed", " (source: Fixture Council (test only))", ""],
    ];
    for (const [label, from, to] of edits) {
      const claim = structuredClone(good);
      assert.ok(claim.text.includes(from), label);
      claim.text = claim.text.replace(from, to);
      const result = verdict(registry, claim);
      assert.notEqual(result.verdict, "accepted", label);
      assert.ok(codes(result).includes("rendered_text_mismatch") || codes(result).includes("display_attribution_missing"), `${label}: ${JSON.stringify(codes(result))}`);
    }
  });
});

test("S5.4-L each structured field changes the rendering: value, unit, direction, period and condition are all kept", () => {
  const texts = new Map<string, string>();
  const add = (label: string, fact: LocalFact) => texts.set(label, claimOf(fact).text);
  add("base", ruleFact());
  add("value", ruleFact({ limit: { ...LIMIT, value: 91 } }));
  add("unit", ruleFact({ limit: { ...LIMIT, unit: "nights" } }));
  add("condition", ruleFact({ limit: { ...LIMIT, condition: "all_listings" } }));
  add("period", ruleFact({ limit: { ...LIMIT, per: "stay" } }));
  add("min", ruleFact({ ruleType: "minimum_stay", limit: { direction: "minimum", value: 90, unit: "days", per: "stay", condition: "main_residence" } }));
  assert.equal(new Set(texts.values()).size, texts.size, "six facts, six different sentences");
  assert.match(texts.get("unit")!, /rental nights .* is 90 nights\./);
  assert.match(texts.get("period")!, /the limit on the length of a stay .* is 90 days\./);
  assert.match(texts.get("min")!, /the minimum length of a stay .* is 90 days\./);
  assert.ok(!texts.get("condition")!.includes("main residence"));
  // the free text of a fact with a limit is never rendered
  assert.ok(!texts.get("base")!.includes("FIXTURE rule text"));
});

test("S5.4-L a limit in nights is accepted with nights and refused with days, and a minimum stay is accepted as a minimum", () => {
  withConfirmedThreshold(() => {
    const nights = ruleFact({ limit: { ...LIMIT, unit: "nights", value: 30 } });
    const registry = registryOf(zone(), nights);
    const good = claimOf(nights);
    assert.match(good.text, /rental nights .* is 30 nights\./);
    const accepted = verdict(registry, good);
    assert.equal(accepted.verdict, "accepted", JSON.stringify(codes(accepted)));
    const swapped = structuredClone(good);
    swapped.text = swapped.text.replace("30 nights", "30 days");
    assert.equal(verdict(registry, swapped).verdict, "rejected");
    const minimum = ruleFact({ ruleType: "minimum_stay", limit: { direction: "minimum", value: 30, unit: "nights", per: "stay", condition: "all_listings" } });
    const result = verdict(registryOf(zone(), minimum), claimOf(minimum));
    assert.equal(result.verdict, "accepted", JSON.stringify(codes(result)));
  });
});

test("S5.4-L a rule of another city or an expired rule is not applicable: the existing mechanisms still apply", () => {
  withConfirmedThreshold(() => {
    const fact = ruleFact();
    const registry = registryOf(zone(), fact, zone(OTHER));
    const other = verdict(registry, claimOf(fact), ctx(OTHER));
    assert.notEqual(other.verdict, "accepted");
    assert.ok(codes(other).length > 0, "a rule of fixture-city is not offered to other-city");
    const ended = ruleFact({ effectiveFrom: "2025-01-01", effectiveUntil: "2026-06-30" });
    const expired = verdict(registryOf(zone(), ended), claimOf(ended));
    assert.equal(expired.verdict, "rejected");
    assert.ok(codes(expired).includes("fact_rule_no_longer_in_force"));
    const future = ruleFact({ effectiveFrom: "2027-01-01" });
    assert.ok(codes(verdict(registryOf(zone(), future), claimOf(future))).includes("fact_rule_not_yet_in_force"));
    // a fact whose validity has ended is not accepted either
    const lapsed = ruleFact({}, { validUntil: "2026-10-01T00:00:00Z" });
    assert.notEqual(verdict(registryOf(zone(), lapsed), claimOf(lapsed)).verdict, "accepted");
  });
});

test("S5.4-L the provisional threshold is not weakened: without the test helper the verdict still needs a human decision", () => {
  const fact = ruleFact();
  const result = verdict(registryOf(zone(), fact), claimOf(fact));
  assert.equal(result.verdict, "needs_human_decision");
  assert.deepEqual(codes(result), ["requirement_threshold_unconfirmed"]);
});

test("S5.4-L older regulatory facts without a limit are unchanged, and a number in free text is still refused", () => {
  withConfirmedThreshold(() => {
    const legacy = ruleFact({ limit: undefined, rule: "In fixture-city, a registration number must be shown in every listing." }, {});
    const registry = registryOf(zone(), legacy);
    const claim = claimOf(legacy);
    assert.deepEqual(claim.figures, []);
    assert.match(claim.text, /^In fixture-city, a registration number must be shown in every listing\. \(in force from 2026-01-01\)/);
    const accepted = verdict(registry, claim);
    assert.ok(!codes(accepted).includes("unbacked_number") && !codes(accepted).includes("rendered_text_mismatch"), JSON.stringify(codes(accepted)));
    // the old route to a number is still closed: the figure lives in the structure, not in the sentence
    const numeric = ruleFact({ limit: undefined, rule: "In fixture-city, the annual limit on rental days is 90 days." });
    const refused = verdict(registryOf(zone(), numeric), claimOf(numeric));
    assert.equal(refused.verdict, "rejected");
    assert.ok(codes(refused).includes("unbacked_number"));
    // and a figure cannot be attached to a fact that has no structured limit
    const withFigure = { ...claimOf(legacy), figures: [{ literal: "90", factId: legacy.factId, valuePath: "limit.value" }] };
    assert.equal(verdict(registry, withFigure).verdict, "rejected");
  });
});

test("S5.4-L the structure is validated when the fact is registered", () => {
  const bad: [string, Record<string, unknown>][] = [
    ["value zero", { limit: { ...LIMIT, value: 0 } }], ["fractional value", { limit: { ...LIMIT, value: 1.5 } }], ["text value", { limit: { ...LIMIT, value: "90" } }],
    ["huge value", { limit: { ...LIMIT, value: 99999 } }], ["unknown unit", { limit: { ...LIMIT, unit: "hours" } }], ["unknown direction", { limit: { ...LIMIT, direction: "about" } }],
    ["unknown condition", { limit: { ...LIMIT, condition: "everybody" } }], ["unknown period", { limit: { ...LIMIT, per: "week" } }], ["extra key", { limit: { ...LIMIT, note: "x" } }],
    ["night cap with a minimum", { limit: { ...LIMIT, direction: "minimum" } }], ["tax with a limit", { ruleType: "tax" }], ["registration with a limit", { ruleType: "registration_required" }],
    ["minimum stay with a maximum", { ruleType: "minimum_stay" }], ["not an object", { limit: 90 }],
  ];
  for (const [label, value] of bad) assert.equal(createFactRegistry().register(ruleFact(value)).ok, false, label);
  const minimum = ruleFact({ ruleType: "minimum_stay", limit: { direction: "minimum", value: 30, unit: "nights", per: "stay", condition: "all_listings" } });
  assert.equal(createFactRegistry().register(minimum).ok, true);
  assert.match(claimOf(minimum).text, /the minimum length of a stay for furnished tourist rentals is 30 nights\./);
  assert.equal(createFactRegistry().register(ruleFact({ limit: null })).ok, true, "an explicit null limit is the same as none");
});

test("S5.4-L import: a structured limit is proved only if a verified quote contains that very number", () => {
  const artifact = new TextEncoder().encode("FIXTURE act. Article 1: the annual limit is set at ninety (90) days. Article 2: it applies from 1 January 2026.");
  const sha = sha256Hex(new TextDecoder().decode(artifact));
  const artifacts = (hash: string) => (hash === sha ? artifact : null);
  const registryText = JSON.stringify({ schemaVersion: SOURCE_REGISTRY_SCHEMA, sources: [{
    sourceId: "fixture-council", publisher: "Fixture Council (test only)", sourceType: "official_authority", status: "approved", terms: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
    rights: { publicTextUse: "permitted_with_attribution", derivativeFigures: "permitted" }, requiredRestrictions: ["attribution_required"], allowedHosts: [], reviewedBy: "role:owner",
    reviewedAt: "2026-08-01T00:00:00Z", reviewValidUntil: "2027-08-01T00:00:00Z", note: null }] });
  const record = (quote: string, limitValue = 90) => {
    const base = ruleFact({ limit: { ...LIMIT, value: limitValue } }) as unknown as Record<string, unknown>;
    const rest = Object.fromEntries(Object.entries(base).filter(([key]) => key !== "validation" && key !== "usage"));
    return { ...rest, schemaVersion: "seo-v3-fact-record/1", displayConstraints: ["attribute_source"], workOrderId: "fixture-order",
      source: { ...(base.source as object), evidence: [{ kind: "content_hash", algorithm: "sha256", value: sha }] },
      citations: [{ artifactSha256: sha, quote, locator: "art. 1", applicability: { geographic: "FIXTURE", temporal: "FIXTURE", semantic: "FIXTURE" } }] };
  };
  const run = (rec: unknown) => importFactStore({ factFiles: [{ name: "facts/f.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [rec] }) }], decisionLogs: [], sourceRegistryText: registryText, artifacts, asOf: AS_OF, strict: true, firstImport: true }).report;
  const good = run(record("the annual limit is set at ninety (90) days"));
  assert.equal(good.refused.length, 0, JSON.stringify(good.refused));
  assert.equal(good.accepted.length, 1);
  assert.equal(good.accepted[0]!.evidence, "verified");
  const wrongNumber = run(record("the annual limit is set at ninety (90) days", 120));
  assert.ok(wrongNumber.refused[0]!.issues.some((i) => i.code === "limit_not_in_citation"), JSON.stringify(wrongNumber.refused));
  const noNumber = run(record("it applies from 1 January 2026"));
  assert.ok(noNumber.refused[0]!.issues.some((i) => i.code === "limit_not_in_citation"));
  const partOfAnotherNumber = run(record("Article 1: the annual limit is set at ninety (900) days", 90));
  assert.ok(partOfAnotherNumber.refused[0]!.issues.some((i) => i.code === "limit_not_in_citation"), "900 does not prove 90");
  assert.equal(good.decisionsCreated, 0);
  assert.equal(good.publicationAuthorised, false);
});

test("S5.4-L prices and statistics are untouched", () => {
  const price = ({ ...common, factId: "fact:fixture:fixture-city:price:2026q3:v1", kind: "quantitative", scope: SCOPE, observedPeriod: { start: "2026-06-01", end: "2026-08-31" }, relevantTopics: ["pricing-guide"],
    usage: { use: { publicUse: "approved", approval: { approvedBy: "fixture-approver", approvedAt: "2026-09-12T10:00:00Z", scope: ["pricing-guide"] } }, displayConstraints: ["show_sample_size", "show_observation_period", "show_confidence"] },
    value: { metric: "nightly_price_distribution", currency: "EUR", median: 111.11, p25: 90, p75: 130, sampleSize: 25 } }) as unknown as LocalFact;
  const rendered = renderFactualClaim([{ fact: price, statistic: "median" }]);
  assert.equal(rendered.ok && rendered.value.text, "In fixture-city, ZZ (platform: Airbnb, property type: not specified), the median nightly price is €111.11 (confidence: high, 25 listings observed from 2026-06-01 to 2026-08-31, source: Fixture Council (test only)).");
  assert.deepEqual(rendered.ok && rendered.value.figures.map((f) => f.valuePath), ["median", "sampleSize"]);
  // a "limit.value" figure is meaningless for a price
  const forged = { claimId: "claim:p", sectionId: "sec:p", kind: "factual", text: rendered.ok ? rendered.value.text : "", supportingFactIds: [price.factId], figures: [{ literal: "90", factId: price.factId, valuePath: "limit.value" }], inheritedDisplayConstraints: [...price.usage.displayConstraints] };
  assert.equal(validateClaim(forged as never, { ...(ctx() as object), topic: "pricing-guide" } as never, registryOf(price)).verdict, "rejected");
});

test("S5.4-L no publication: nothing here authorises a page", () => {
  const fact = ruleFact();
  assert.equal(JSON.stringify(fact).includes("publishable"), false);
  const result = importFactStore({ factFiles: [], decisionLogs: [], sourceRegistryText: null, artifacts: () => null, asOf: AS_OF });
  assert.equal(result.report.publicationAuthorised, false);
  assert.equal(result.report.indexingAuthorised, false);
});

// --- S5.4-M review: what the proof does and does not establish -------------------------------------------------------

/** Imports one fictional record whose only artifact is `text`; returns the report. Nothing is validated or approved by this. */
function importWith(text: string, quote: string, limit: Record<string, unknown> | null, ruleType = "night_cap") {
  const artifact = new TextEncoder().encode(text);
  const sha = sha256Hex(text);
  const registryText = JSON.stringify({ schemaVersion: SOURCE_REGISTRY_SCHEMA, sources: [{
    sourceId: "fixture-council", publisher: "Fixture Council (test only)", sourceType: "official_authority", status: "approved", terms: { status: "verified_permissive", summary: null, reference: "FIXTURE-terms" },
    rights: { publicTextUse: "permitted_with_attribution", derivativeFigures: "permitted" }, requiredRestrictions: ["attribution_required"], allowedHosts: [], reviewedBy: "role:owner",
    reviewedAt: "2026-08-01T00:00:00Z", reviewValidUntil: "2027-08-01T00:00:00Z", note: null }] });
  const base = ruleFact({ ruleType, ...(limit === null ? { limit: undefined } : { limit }) }) as unknown as Record<string, unknown>;
  const rest = Object.fromEntries(Object.entries(base).filter(([key]) => key !== "validation" && key !== "usage"));
  const record = { ...rest, schemaVersion: "seo-v3-fact-record/1", displayConstraints: ["attribute_source"], workOrderId: "fixture-order",
    source: { ...(base.source as object), evidence: [{ kind: "content_hash", algorithm: "sha256", value: sha }] },
    citations: quote === "" ? [] : [{ artifactSha256: sha, quote, locator: "art. 1", applicability: { geographic: "FIXTURE", temporal: "FIXTURE", semantic: "FIXTURE" } }] };
  return importFactStore({ factFiles: [{ name: "facts/f.json", text: JSON.stringify({ schemaVersion: FACT_FILE_SCHEMA, facts: [record] }) }], decisionLogs: [], sourceRegistryText: registryText, artifacts: (h) => (h === sha ? artifact : null), asOf: AS_OF, strict: true, firstImport: true });
}
const issuesOf = (r: ReturnType<typeof importWith>) => r.report.refused.flatMap((f) => f.issues.map((i) => i.code));

test("S5.4-M proof: a number only counts when it is written with a unit of the declared kind", () => {
  const text = "FIXTURE act. Article 90 sets the scope. Article 2: from 1 January 2025 the annual limit is ninety (90) days; the notice period is 120 days; a stay of 30 nights is allowed. Reference 2025.";
  // plausible and present: accepted as a DRAFT (still to be validated by a person)
  assert.deepEqual(issuesOf(importWith(text, "the annual limit is ninety (90) days", LIMIT)), []);
  assert.deepEqual(issuesOf(importWith(text, "from 1 January 2025 the annual limit is ninety (90) days", LIMIT)), [], "a quote with a date and the cap");
  // an article number, a year, a day of the month or a number with another unit is not a proof of the cap
  assert.ok(issuesOf(importWith(text, "Article 90 sets the scope", LIMIT)).includes("limit_not_in_citation"), "90 as an article number");
  assert.ok(issuesOf(importWith(text, "from 1 January 2025", { ...LIMIT, value: 25 })).includes("limit_not_in_citation"), "25 inside 2025");
  assert.ok(issuesOf(importWith(text, "from 1 January 2025", { ...LIMIT, value: 2025 })).includes("limit_not_in_citation"), "2025 as a year");
  assert.ok(issuesOf(importWith(text, "from 1 January 2025 the annual limit", { ...LIMIT, value: 1 })).includes("limit_not_in_citation"), "1 as a day of the month");
  assert.ok(issuesOf(importWith(text, "a stay of 30 nights is allowed", { ...LIMIT, value: 30 })).includes("limit_not_in_citation"), "30 nights proves nothing for a limit in days");
  assert.deepEqual(issuesOf(importWith(text, "a stay of 30 nights is allowed", { ...LIMIT, value: 30, unit: "nights" })), [], "but it matches a limit declared in nights");
  assert.ok(issuesOf(importWith(text, "the notice period is 120 days", { ...LIMIT, value: 12 })).includes("limit_not_in_citation"), "12 inside 120");
  assert.ok(issuesOf(importWith(text + " A delay of 125 days applies.", "A delay of 125 days applies.", { ...LIMIT, value: 25 })).includes("limit_not_in_citation"), "25 inside 125 days");
  assert.ok(issuesOf(importWith(text, "FIXTURE act.", LIMIT)).includes("limit_not_in_citation"), "no number at all");
  assert.ok(issuesOf(importWith(text, "", LIMIT)).includes("citation_required"), "no quote at all for an official source");
});

test("S5.4-M proof: the engine does not read the meaning, so a plausible quote is only ever a DRAFT that a person must validate", () => {
  // several numbers: the engine cannot tell which one is the cap, so BOTH 90 and 120 pass the proof as drafts
  const text = "FIXTURE act. The annual limit is ninety (90) days. The notice period is 120 days.";
  const a = importWith(text, "The annual limit is ninety (90) days. The notice period is 120 days.", LIMIT);
  const b = importWith(text, "The annual limit is ninety (90) days. The notice period is 120 days.", { ...LIMIT, value: 120 });
  assert.deepEqual([issuesOf(a), issuesOf(b)], [[], []], "the proof is necessary, not sufficient");
  // another condition or another period in the text: not detectable either
  const other = importWith("FIXTURE act. For secondary residences the limit is 90 days per stay.", "For secondary residences the limit is 90 days per stay.", LIMIT);
  assert.deepEqual(issuesOf(other), []);
  for (const report of [a.report, b.report, other.report]) {
    assert.equal(report.accepted.length, 1);
    assert.equal(report.accepted[0]!.state, "draft", "never validated by the import");
    assert.equal(report.accepted[0]!.publicUse, "requires_human_approval", "never approved for public use");
    assert.equal(report.decisionsCreated, 0);
  }
  // and a draft fact is not usable: S3 does not accept a claim on it
  const draft = [...a.registry.list()][0]!;
  const claim = claimOf(draft);
  const result = verdict(a.registry, claim);
  assert.notEqual(result.verdict, "accepted");
  assert.ok(codes(result).some((c) => /valid|approv|not_/.test(c)), JSON.stringify(codes(result)));
});

test("S5.4-M modelling: the four kinds of limit are different facts and never read as one another", () => {
  const annualCap = ruleFact({ limit: LIMIT });
  const minimumStay = ruleFact({ ruleType: "minimum_stay", limit: { direction: "minimum", value: 3, unit: "nights", per: "stay", condition: "all_listings" } });
  const maximumStay = ruleFact({ limit: { direction: "maximum", value: 30, unit: "nights", per: "stay", condition: "all_listings" } });
  const secondaryCap = ruleFact({ limit: { ...LIMIT, condition: "all_listings" } });
  const text = (f: LocalFact) => claimOf(f).text.replace(/ \(in force.*$/, "");
  assert.match(text(annualCap), /the annual limit on rental days for a furnished tourist rental declared as the host's main residence is 90 days\.$/);
  assert.match(text(minimumStay), /the minimum length of a stay for furnished tourist rentals is 3 nights\.$/);
  assert.match(text(maximumStay), /the limit on the length of a stay for furnished tourist rentals is 30 nights\.$/);
  assert.match(text(secondaryCap), /the annual limit on rental days for furnished tourist rentals is 90 days\.$/);
  assert.equal(new Set([annualCap, minimumStay, maximumStay, secondaryCap].map(text)).size, 4);
  // an annual cap cannot be given the direction or the period of a stay rule, nor a minimum stay a maximum
  for (const bad of [{ ruleType: "night_cap", limit: { ...LIMIT, direction: "minimum" } }, { ruleType: "minimum_stay", limit: { direction: "maximum", value: 3, unit: "nights", per: "stay", condition: "all_listings" } },
    { ruleType: "minimum_stay", limit: { direction: "minimum", value: 3, unit: "nights", per: "calendar_year", condition: "all_listings" } }]) {
    assert.equal(createFactRegistry().register(ruleFact(bad)).ok, false);
  }
});

const evaluate = (registry: FactRegistry) => evaluateTopicFacts(registry, { target: SCOPE, platform: "airbnb", propertyType: null, topic: TOPIC, asOf: AS_OF, use: "public" });
const conflictsOf = (...facts: LocalFact[]) => {
  const registry = registryOf(zone(), ...facts);
  return evaluate(registry).requirements.find((r) => r.requirementId === "long_stay_rule")!.conflictingFactIds;
};
const SECOND = { factId: "fact:fixture:fixture-city:rule:other" };

test("S5.4-M modelling: two night caps of one city are competing facts that a person arbitrates, never merged silently", () => {
  withConfirmedThreshold(() => {
    const annual = ruleFact({ limit: LIMIT });
    const perStay = ruleFact({ limit: { direction: "maximum", value: 30, unit: "nights", per: "stay", condition: "all_listings" } }, SECOND);
    assert.equal(conflictsOf(annual, perStay).length, 2, "an annual cap and a maximum length of stay share the rule type night_cap: one city, one series");
    const other = ruleFact({ limit: { ...LIMIT, value: 120 } }, SECOND);
    assert.equal(conflictsOf(annual, other).length, 2, "two different values for the same rule");
    const secondary = ruleFact({ limit: { ...LIMIT, condition: "all_listings" } }, SECOND);
    assert.equal(conflictsOf(annual, secondary).length, 2, "the same value for another condition is another rule, hence a conflict to arbitrate");
    // a night cap and a minimum stay are different rule types and coexist
    const minimum = ruleFact({ ruleType: "minimum_stay", limit: { direction: "minimum", value: 3, unit: "nights", per: "stay", condition: "all_listings" } }, { factId: "fact:fixture:fixture-city:rule:minimum" });
    const registry = registryOf(zone(), annual, minimum);
    assert.deepEqual(evaluate(registry).requirements.find((r) => r.requirementId === "long_stay_rule")!.conflictingFactIds, []);
  });
});

test("S5.4-M conflict detection reads the limit, not the key order of its JSON nor the free text next to it", () => {
  withConfirmedThreshold(() => {
    const annual = ruleFact({ limit: LIMIT });
    const reordered = ruleFact({ limit: { condition: "main_residence", per: "calendar_year", unit: "days", value: 90, direction: "maximum" } }, SECOND);
    const registry = registryOf(zone(), annual);
    const outcome = registry.register(reordered);
    assert.equal(outcome.ok, false, "the same limit written in another key order is the same fact: refused as a duplicate, not reported as a conflict");
    assert.match(JSON.stringify(outcome), /duplicate_content/);
    const reworded = ruleFact({ rule: "FIXTURE another wording of the same rule.", limit: LIMIT }, SECOND);
    assert.deepEqual(conflictsOf(annual, reworded), [], "free text is not rendered when a limit exists, so it cannot create a contradiction");
  });
});
