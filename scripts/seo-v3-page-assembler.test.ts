import assert from "node:assert/strict";
import test from "node:test";

import { renderFactualClaim } from "../lib/seo/v3/claimRender";
import { validateGeneratedPage, type ClaimContext } from "../lib/seo/v3/claimValidation";
import { assembleGeneratedPage, verifyAssembledPage, type AssembleInput } from "../lib/seo/v3/pageAssembler";
import { createEditorialCatalog, isEditorialCatalog, sha256Hex, APPROVED_EDITORIAL_CATALOG } from "../lib/seo/v3/editorialCatalog";
import { comparePages, diagnosePage, evaluateCompleteness } from "../lib/seo/v3/pageDiagnostics";
import { selectFactualClaims } from "../lib/seo/v3/factualSelection";
import { decideAssembly } from "../lib/seo/v3/assemblyDecision";
import { createFactRegistry, type FactRegistry } from "../lib/seo/v3/factRegistry";
import type { FactSource } from "../lib/seo/v3/factSource";
import type { GeographicScope, LocalFact } from "../lib/seo/v3/localFact";

/**
 * S4 tests: deterministic page assembler, closed editorial catalogue, diagnostics.
 *
 * Every value is a FIXTURE: "fixture-city" does not exist, country "ZZ" is a reserved code, publishers say
 * "test only", numbers are artificial. None of it is, or may become, public data.
 *
 *   npx tsx scripts/seo-v3-page-assembler.test.ts
 */

const AS_OF = "2026-10-01T00:00:00Z";
const CITY = "fixture-city";
const TARGET: GeographicScope = { level: "city", countryCode: "ZZ", citySlug: CITY };
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

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const claim = (overrides: Record<string, unknown> = {}) => ({ claimId: "claim:c1", sectionId: "s1", ...overrides });
function factualOf(fact: LocalFact, statistic?: "median", overrides: Record<string, unknown> = {}) {
  const outcome = renderFactualClaim([{ fact, ...(statistic === undefined ? {} : { statistic }) }]);
  assert.equal(outcome.ok, true);
  const value = (outcome as Extract<typeof outcome, { ok: true }>).value;
  return claim({ kind: "factual", text: value.text, supportingFactIds: [...value.supportingFactIds], figures: [...value.figures], inheritedDisplayConstraints: [...value.inheritedDisplayConstraints], ...overrides });
}

// --- catalogue fixtures: every text below is a FIXTURE, written for these tests only -------------------------

const ADVICE_TEXT = "Compare your own listing with the information above before you change anything.";
const INTRO_TEXT = "Here is a short overview of what follows on this page.";
const HYPOTHESIS_TEXT = "Clear photos may help guests to understand the layout of the space.";
const TOPICS = ["pricing-guide", "pricing-positioning", "competitor-analysis", "market-analysis"];

function approvedBlock(overrides: Record<string, unknown> = {}, text?: string): Record<string, unknown> {
  const body = text ?? (overrides.text as string | undefined) ?? ADVICE_TEXT;
  return {
    blockId: "block:fixture-advice-1", language: "en", kind: "methodological_advice", text: body, topics: [...TOPICS],
    approval: { status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-10T10:00:00Z", textHash: sha256Hex(body) },
    ...overrides,
  };
}
const introBlock = (overrides: Record<string, unknown> = {}) => approvedBlock({ blockId: "block:fixture-intro-1", kind: "editorial_non_factual", text: INTRO_TEXT, ...overrides }, (overrides.text as string | undefined) ?? INTRO_TEXT);
const hypothesisBlock = (overrides: Record<string, unknown> = {}) =>
  approvedBlock({ blockId: "block:fixture-hyp-1", kind: "explicit_hypothesis", hypothesisMarker: "may", text: HYPOTHESIS_TEXT, ...overrides }, (overrides.text as string | undefined) ?? HYPOTHESIS_TEXT);
const FULL_CATALOG = () => createEditorialCatalog([approvedBlock(), introBlock(), hypothesisBlock()]);

const reasonsOf = (catalog: ReturnType<typeof createEditorialCatalog>, id: string) => catalog.excluded.find((entry) => entry.blockId === id)?.reasons ?? [];

function input(registry: FactRegistry, overrides: Partial<AssembleInput> = {}): AssembleInput {
  return { registry, catalog: FULL_CATALOG(), target: TARGET, platform: null, propertyType: null, topic: "pricing-guide", asOf: AS_OF, language: "en", ...overrides };
}
const assemble = (registry: FactRegistry, overrides: Partial<AssembleInput> = {}) => assembleGeneratedPage(input(registry, overrides));
const notReady = (r: ReturnType<typeof assemble>, label: string) => {
  assert.notEqual(r.status, "ready_for_editorial_review", `${label}: ${JSON.stringify(r.reasons)}`);
  assert.equal(r.page, null, label);
};

// --- 1. a page with sufficient facts ---------------------------------------------------------------------------

test("1. sufficient facts: a page ready for editorial review, made of rendered facts and fixed blocks", () => {
  const registry = registryWith(priceFact());
  const r = assemble(registry);
  assert.equal(r.status, "ready_for_editorial_review", JSON.stringify(r.reasons));
  assert.deepEqual(r.reasons, ["all_checks_passed"]);
  const page = r.page!;
  assert.equal(page.pathname, "/airbnb-optimizer/fixture-city/pricing-guide");
  assert.deepEqual(page.sections.map((s) => s.sectionId), ["sec:intro", "sec:nightly_price_distribution", "sec:method", "sec:hypotheses"]);
  assert.deepEqual(page.usedFactIds, [PRICE_ID]);
  assert.equal(r.validation!.verdict, "accepted", JSON.stringify(r.validation));
  // the factual claim is the exact S3 rendering, with its figures and constraints
  const factual = page.sections[1]!.claims[0]!;
  const rendered = renderFactualClaim([{ fact: priceFact(), statistic: "median" }]);
  assert.equal(rendered.ok && factual.text, rendered.ok && rendered.value.text);
  assert.deepEqual(factual.kind === "factual" && factual.figures, rendered.ok && rendered.value.figures);
  assert.deepEqual(factual.kind === "factual" && [...factual.inheritedDisplayConstraints].sort(), ["show_confidence", "show_observation_period", "show_sample_size"]);
  // blocks are used verbatim
  assert.deepEqual(page.sections[0]!.claims.map((c) => c.text), [INTRO_TEXT]);
  assert.deepEqual(page.sections[2]!.claims.map((c) => c.text), [ADVICE_TEXT]);
  assert.deepEqual(page.sections[3]!.claims.map((c) => c.text), [HYPOTHESIS_TEXT]);
  // never a publication, never an indexing decision, never "publishable_standalone"
  assert.equal(r.publicationAuthorised, false);
  assert.equal(r.indexingAuthorised, false);
  assert.notEqual(page.eligibility.eligibility, "publishable_standalone");
  assert.deepEqual(page.eligibility.reasons, ["human_editorial_decision"]);
  assert.ok(!JSON.stringify(page).match(/index|sitemap|canonical|robots/i), "no indexing key or word in the page");
  assert.equal(page.traceability.rollbackTarget, "v2_current_renderer");
  assert.match(page.traceability.contentHash!, /^[0-9a-f]{64}$/);
  assert.equal(r.language, "en");
  // the page is a valid S3 page on its own
  assert.equal(validateGeneratedPage(page, context(), registry).verdict, "accepted");
});

test("1b. a platform-specific page names its platform; a facts-only page needs no block at all", () => {
  const airbnb = priceFact({ platform: "airbnb", propertyType: "apartment" });
  const r = assemble(registryWith(airbnb), { platform: "airbnb", propertyType: "apartment", catalog: APPROVED_EDITORIAL_CATALOG });
  assert.equal(r.status, "ready_for_editorial_review", JSON.stringify(r.reasons));
  assert.match(r.page!.sections[0]!.claims[0]!.text, /platform: Airbnb, property type: apartment/);
  assert.deepEqual(r.page!.sections.map((s) => s.sectionId), ["sec:nightly_price_distribution"], "the production catalogue is empty: only rendered facts");
  assert.equal(APPROVED_EDITORIAL_CATALOG.blocks.length, 0);
});

// --- 2-8. insufficient or unusable facts: refusal, never generic filling -------------------------------------------

test("2-3. a city without data and a topic without data are refused, even with a full catalogue", () => {
  const empty = assemble(createFactRegistry());
  notReady(empty, "empty registry");
  assert.equal(empty.status, "needs_data");
  assert.ok(empty.reasons.includes("no_factual_claim"));
  assert.deepEqual(empty.completeness!.requiredUncovered.map((u) => u.requirementId), ["nightly_price_distribution"]);
  // facts of another city
  const otherCity = assemble(registryWith(priceFact({ scope: { level: "city", countryCode: "ZZ", citySlug: "other-city" } })));
  notReady(otherCity, "other city");
  // a topic whose requirements this fact does not meet
  const otherTopic = assemble(registryWith(priceFact()), { topic: "occupancy-guide" });
  notReady(otherTopic, "other topic");
  assert.equal(otherTopic.status, "needs_data");
  // blocks never create a page by themselves
  assert.equal(empty.page, null);
  assert.equal(empty.differentiation, null);
});

test("4-6. an expired, audit-locked or revoked fact does not make a page", () => {
  const expired = assemble(registryWith(priceFact()), { asOf: "2026-12-02T00:00:00Z" });
  notReady(expired, "expired");
  assert.equal(expired.status, "needs_data");
  const audit = assemble(registryWith(priceFact({ source: auditSource() })));
  notReady(audit, "audit locked");
  const v1 = priceFact();
  const revoked = priceFact({ factId: "fact:fixture:fixture-city:price:2026q3:v2", version: 2, supersedes: PRICE_ID, collectedAt: "2026-09-05T10:00:00Z", validation: { status: "revoked", revokedAt: "2026-09-06T00:00:00Z", reason: "FIXTURE" }, usage: { use: { publicUse: "forbidden" }, displayConstraints: [...MEASURED] }, value: priceValue(112) });
  const onlyRevoked = assemble(registryWith(v1, revoked));
  notReady(onlyRevoked, "revoked series");
  const pending = assemble(registryWith(priceFact({ usage: { use: { publicUse: "requires_human_approval" }, displayConstraints: [...MEASURED] } })));
  notReady(pending, "approval pending");
});

test("7. contradictory facts wait for a human", () => {
  const first = priceFact();
  const second = priceFact({ factId: "fact:fixture:fixture-city:price:second", observedPeriod: { start: "2026-07-01", end: "2026-08-31" }, value: priceValue(500) });
  const r = assemble(registryWith(first, second));
  notReady(r, "contradiction");
  assert.equal(r.status, "needs_human_decision");
  assert.ok(r.completeness!.requiredUncovered.some((u) => u.cause === "contradiction"));
  assert.ok(!JSON.stringify(r).includes("500"));
});

test("8. a wrong scope or platform is not a fact of the page", () => {
  const booking = registryWith(priceFact({ platform: "booking" }));
  notReady(assemble(booking, { platform: "airbnb" }), "booking fact on an airbnb page");
  notReady(assemble(booking), "booking fact on a platform-neutral page");
  assert.equal(assemble(booking, { platform: "booking" }).status, "ready_for_editorial_review");
  notReady(assemble(registryWith(priceFact({ propertyType: "villa" }))), "villa fact on a segment-neutral page");
  notReady(assemble(registryWith(priceFact({ scope: { level: "country", countryCode: "ZZ" } }))), "country fact on a city page");
  // a city page is a city page
  for (const target of [{ level: "country", countryCode: "ZZ" }, { level: "district", countryCode: "ZZ", citySlug: CITY, districtName: "FIXTURE district" }]) {
    const r = assemble(registryWith(priceFact()), { target: target as GeographicScope });
    assert.equal(r.status, "invalid_request");
    assert.equal(r.page, null);
  }
  const bad = assemble(registryWith(priceFact()), { topic: "made-up" as never });
  assert.equal(bad.status, "invalid_request");
});

// --- 9-12. the closed catalogue -----------------------------------------------------------------------------

test("9. a block that is not approved never reaches a page, and is reported by id and code only", () => {
  const catalog = createEditorialCatalog([
    approvedBlock({ blockId: "block:fixture-draft", approval: { status: "draft" } }),
    approvedBlock({ blockId: "block:fixture-pending", approval: { status: "pending_review" } }),
    approvedBlock({ blockId: "block:fixture-rejected", approval: { status: "rejected" } }),
    approvedBlock({ blockId: "block:fixture-no-approval", approval: undefined }),
    approvedBlock({ blockId: "block:fixture-no-reviewer", approval: { status: "approved", approvedBy: "", approvedAt: "2026-09-10T10:00:00Z", textHash: sha256Hex(ADVICE_TEXT) } }),
    approvedBlock({ blockId: "block:fixture-bad-date", approval: { status: "approved", approvedBy: "fixture-editor", approvedAt: "yesterday", textHash: sha256Hex(ADVICE_TEXT) } }),
    introBlock(),
  ]);
  assert.deepEqual(catalog.blocks.map((b) => b.blockId), ["block:fixture-intro-1"]);
  for (const id of ["block:fixture-draft", "block:fixture-pending", "block:fixture-rejected", "block:fixture-no-approval"]) assert.deepEqual(reasonsOf(catalog, id), ["not_approved"], id);
  assert.deepEqual(reasonsOf(catalog, "block:fixture-no-reviewer"), ["approval_incomplete"]);
  assert.deepEqual(reasonsOf(catalog, "block:fixture-bad-date"), ["approval_date_invalid"]);
  const r = assemble(registryWith(priceFact()), { catalog });
  assert.equal(r.status, "ready_for_editorial_review");
  assert.ok(!r.page!.sections.some((s) => s.claims.some((c) => c.text === ADVICE_TEXT)));
  assert.equal(r.excludedBlocks.length, 6);
  assert.ok(!JSON.stringify(r.excludedBlocks).includes("Compare"), "excluded text is not kept");
  // an approval dated after the page's instant does not apply yet
  const future = createEditorialCatalog([approvedBlock({ approval: { status: "approved", approvedBy: "fixture-editor", approvedAt: "2027-01-01T00:00:00Z", textHash: sha256Hex(ADVICE_TEXT) } })]);
  assert.equal(future.blocks.length, 1);
  assert.equal(future.blocksFor("pricing-guide", "en", AS_OF).length, 0);
  assert.equal(future.blocksFor("pricing-guide", "en", "2027-02-01T00:00:00Z").length, 1);
  // a block serves only the topics it names
  assert.equal(createEditorialCatalog([approvedBlock({ topics: ["photo-tips"] })]).blocksFor("pricing-guide", "en", AS_OF).length, 0);
});

test("10. a block in an unsupported language, or declared English but written in another, is refused; so is an unsupported assembly language", () => {
  const catalog = createEditorialCatalog([
    approvedBlock({ blockId: "block:fixture-declared-fr", language: "fr" }),
    approvedBlock({ blockId: "block:fixture-declared-es", language: "es" }),
    approvedBlock({ blockId: "block:fixture-fr-text" }, "Commencez par comparer votre annonce avec les informations ci-dessus pour les voyageurs."),
    approvedBlock({ blockId: "block:fixture-es-text" }, "Compare su anuncio con la información de arriba antes de cambiar nada en el título."),
    approvedBlock({ blockId: "block:fixture-cyrillic" }, "Compare your own listing with the informаtion above before you change anything."),
    approvedBlock({ blockId: "block:fixture-undetermined" }, "Photos"),
  ]);
  assert.equal(catalog.blocks.length, 0);
  assert.deepEqual(reasonsOf(catalog, "block:fixture-declared-fr"), ["language_not_supported"]);
  assert.deepEqual(reasonsOf(catalog, "block:fixture-declared-es"), ["language_not_supported"]);
  for (const id of ["block:fixture-fr-text", "block:fixture-es-text", "block:fixture-cyrillic"]) assert.ok(reasonsOf(catalog, id).includes("text_language_not_verified"), id);
  assert.ok(reasonsOf(catalog, "block:fixture-undetermined").length > 0);
  const registry = registryWith(priceFact());
  const french = assemble(registry, { language: "fr" as never });
  assert.equal(french.status, "invalid_request");
  assert.deepEqual(french.reasons, ["language_not_supported"]);
  assert.equal(french.page, null);
});

test("11. free text cannot enter a block: edited text, placeholders, substitution, numbers, links", () => {
  const registry = registryWith(priceFact());
  const edited = approvedBlock({ text: `${ADVICE_TEXT} Hosts should charge more.` });
  edited.approval = { status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-10T10:00:00Z", textHash: sha256Hex(ADVICE_TEXT) };
  const cases: [string, Record<string, unknown>, string][] = [
    ["text edited after approval", edited, "text_hash_mismatch"],
    ["placeholder", approvedBlock({}, "Compare your listing in {city} with the information above."), "text_has_placeholder"],
    ["template literal", approvedBlock({}, "Compare your listing in ${city} with the information above."), "text_has_placeholder"],
    ["bracket slot", approvedBlock({}, "Compare your listing in [city] with the information above before you change it."), "text_has_placeholder"],
    ["link", approvedBlock({}, "Compare your listing with https://example.invalid/page before you change anything."), "text_has_placeholder"],
    ["digits", approvedBlock({}, "Compare your listing with the 3 examples above before you change anything."), "text_has_number"],
    ["spelled number", approvedBlock({}, "Compare your listing with the three examples above before you change anything."), "text_has_number"],
    ["multi-line", approvedBlock({}, `${ADVICE_TEXT}\n${ADVICE_TEXT}`), "text_invalid"],
    ["too long", approvedBlock({}, `${ADVICE_TEXT} `.repeat(30)), "text_invalid"],
    ["price recommendation", approvedBlock({}, "Hosts should charge more for the main room of the unit than before."), "text_wording_refused"],
    ["local fact", approvedBlock({}, "The old town is famous for its canals and the guests like them."), "text_wording_refused"],
    ["guarantee", approvedBlock({}, "A new title guarantees more bookings for the guests of the unit."), "text_refused_by_validator"],
  ];
  for (const [label, raw, code] of cases) {
    const catalog = createEditorialCatalog([raw]);
    assert.equal(catalog.blocks.length, 0, label);
    assert.ok(catalog.excluded[0]!.reasons.includes(code as never) || (label === "too long" && catalog.excluded[0]!.reasons.includes("malformed_block")), `${label}: ${catalog.excluded[0]!.reasons.join(",")}`);
    assert.equal(assemble(registry, { catalog }).excludedBlocks.length, 1, label);
  }
  // the assembler has no way to take a claim or a text: extra input is ignored
  const sneaky = { ...input(registry), claims: [{ kind: "factual", text: "Prices are the best in the region." }], extraText: "Prices doubled last year." } as AssembleInput;
  const r = assembleGeneratedPage(sneaky);
  assert.equal(r.status, "ready_for_editorial_review");
  assert.ok(!JSON.stringify(r.page).includes("doubled") && !JSON.stringify(r.page).includes("best in the region"));
});

test("12. no hypothesis with a number, a comparison, a trend or a missing marker; unnumbered fixed ones pass", () => {
  const refused: [string, Record<string, unknown>][] = [
    ["a figure", hypothesisBlock({ text: "Clear photos may add 15 euros to the price of the space for the guests." })],
    ["a spelled figure", hypothesisBlock({ text: "Clear photos may add fifteen euros to the price of the space for guests." })],
    ["a comparison", hypothesisBlock({ text: "Clear photos may make the price higher than the price of the other units." })],
    ["a trend", hypothesisBlock({ text: "Prices may be rising in the city for the guests who look at the photos." })],
    ["a superlative", hypothesisBlock({ text: "Clear photos may be the best way to help the guests of the unit." })],
    ["no marker", hypothesisBlock({ text: "Clear photos help guests to understand the layout of the space." })],
    ["undeclared marker", hypothesisBlock({ hypothesisMarker: undefined })],
    ["wrong marker", hypothesisBlock({ hypothesisMarker: "might" })],
    ["marker on advice", approvedBlock({ hypothesisMarker: "may" })],
    ["figures smuggled in", hypothesisBlock({ figures: [{ literal: "1", factId: PRICE_ID, valuePath: "median" }] })],
  ];
  for (const [label, raw] of refused) {
    const catalog = createEditorialCatalog([raw]);
    assert.equal(catalog.blocks.length, 0, `${label}: ${JSON.stringify(catalog.excluded)}`);
  }
  assert.equal(createEditorialCatalog([hypothesisBlock()]).blocks.length, 1);
});

test("12b. catalogue robustness: duplicates, hostile objects, size, determinism, no mutation", () => {
  const dup = createEditorialCatalog([approvedBlock(), approvedBlock({}, "Compare your own listing with the information above before you act on it.")]);
  assert.equal(dup.blocks.length, 0, "an id used twice is ambiguous: none is usable");
  assert.deepEqual(reasonsOf(dup, "block:fixture-advice-1"), ["duplicate_block_id"]);
  let reads = 0;
  const getter = Object.defineProperty({ ...approvedBlock() }, "text", { enumerable: true, get: () => { reads += 1; return ADVICE_TEXT; } });
  const cyclic: Record<string, unknown> = { ...approvedBlock() };
  cyclic.self = cyclic;
  const hostile = createEditorialCatalog([null, "x", 7, [], getter, cyclic, new Proxy(approvedBlock(), {}), { ...approvedBlock(), extra: 1 }, approvedBlock({ blockId: "owner@example.invalid" }), approvedBlock({ blockId: `block:${"a".repeat(40)}` }), approvedBlock({ blockId: "block:fixture-123456789012" })]);
  assert.equal(hostile.blocks.length, 0);
  assert.equal(reads, 0, "an accessor is never invoked");
  assert.ok(!JSON.stringify(hostile.excluded).includes("example.invalid"), "an unsafe id is never echoed");
  assert.equal(createEditorialCatalog("nope" as never).blocks.length, 0);
  assert.equal(createEditorialCatalog(Array.from({ length: 600 }, () => null)).blocks.length, 0);
  const a = createEditorialCatalog([approvedBlock(), introBlock()]);
  const b = createEditorialCatalog([introBlock(), approvedBlock()]);
  assert.equal(a.catalogId, b.catalogId, "order does not matter");
  assert.notEqual(a.catalogId, createEditorialCatalog([approvedBlock()]).catalogId);
  assert.ok(Object.isFrozen(a.blocks) && Object.isFrozen(a.blocks[0]));
});

// --- 13-14. S3 protections still hold on what the assembler produces -----------------------------------------------

test("13. a modified figure, a removed display constraint or an appended conclusion on an assembled claim is caught by S3", () => {
  const registry = registryWith(priceFact());
  const selection = selectFactualClaims(registry, context());
  const base = selection.selected[0]!.claim;
  const pageWith = (claim: Record<string, unknown>) => ({
    citySlug: CITY, topic: "pricing-guide", pathname: `/airbnb-optimizer/${CITY}/pricing-guide`,
    sections: [{ sectionId: "s1", heading: "H", claims: [claim] }], usedFactIds: [PRICE_ID], missingFacts: [], eligibility: {}, generator: {}, traceability: {},
  });
  const verdict = (claim: Record<string, unknown>) => validateGeneratedPage(pageWith(claim), context(), registry).verdict;
  assert.equal(verdict({ ...base }), "accepted");
  assert.equal(verdict({ ...base, figures: base.figures.map((f) => (f.valuePath === "median" ? { ...f, literal: "99.99" } : f)) }), "rejected", "figure modified");
  assert.equal(verdict({ ...base, figures: base.figures.filter((f) => f.valuePath !== "sampleSize") }), "rejected", "figure removed");
  assert.equal(verdict({ ...base, inheritedDisplayConstraints: [] }), "rejected", "constraints removed");
  assert.equal(verdict({ ...base, text: base.text.replace("confidence: high, ", "") }), "rejected", "display constraint removed from the text");
  assert.equal(verdict({ ...base, text: `${base.text} Hosts should charge it.` }), "rejected", "conclusion appended");
  assert.equal(verdict({ ...base, text: base.text.replace("median", "maximum") }), "rejected", "metric changed");
  assert.equal(verdict({ ...base, text: base.text.replace("fixture-city", "Paris") }), "rejected", "city changed");
});

test("14. the final decision: one blocking refusal forbids the ready status, and the precedence is fixed", () => {
  const ok = { topicOverall: "all_required_met", requiredUncovered: 0, notRenderable: 0, factualClaimCount: 1, pageVerdict: "accepted", integrityOk: true } as const;
  assert.equal(decideAssembly(ok).status, "ready_for_editorial_review");
  for (const [label, change, status] of [
    ["topic blocked", { topicOverall: "blocked" }, "needs_data"],
    ["topic needs a human", { topicOverall: "needs_human_decision" }, "needs_human_decision"],
    ["required uncovered", { requiredUncovered: 1 }, "needs_data"],
    ["not renderable", { notRenderable: 1 }, "needs_human_decision"],
    ["no factual claim", { factualClaimCount: 0 }, "needs_data"],
    ["S3 needs data", { pageVerdict: "needs_data" }, "needs_data"],
    ["S3 needs human", { pageVerdict: "needs_human_decision" }, "needs_human_decision"],
    ["S3 rejects", { pageVerdict: "rejected" }, "rejected"],
    ["integrity failure", { integrityOk: false }, "rejected"],
    ["combined: data + human", { topicOverall: "blocked", pageVerdict: "needs_human_decision" }, "needs_human_decision"],
    ["combined: human + reject", { topicOverall: "needs_human_decision", pageVerdict: "rejected" }, "rejected"],
  ] as const) {
    assert.equal(decideAssembly({ ...ok, ...change } as never).status, status, label);
    assert.notEqual(decideAssembly({ ...ok, ...change } as never).status, "ready_for_editorial_review", label);
  }
  const unvalidated = decideAssembly({ ...ok, pageVerdict: null } as never);
  assert.equal(unvalidated.status, "rejected", "a page that was not validated is never ready");
  assert.ok(unvalidated.reasons.includes("page_validation_missing"));
});

// --- 15-17. editorial differentiation --------------------------------------------------------------------------------

test("15. diagnostics: counts and shares of what the page really contains; no threshold and no verdict", () => {
  const registry = registryWith(priceFact());
  const r = assemble(registry);
  const d = r.differentiation!;
  assert.equal(d.factualClaimCount, 3, "S5.4-E: the median and the two quartiles that the fixture fact carries");
  assert.equal(d.cityFactCount, 1);
  assert.equal(d.countryFactCount, 0);
  assert.equal(d.supportedSectionCount, 1);
  assert.equal(d.genericBlockCount, 3);
  assert.deepEqual(d.genericBlockIds, ["block:fixture-advice-1", "block:fixture-hyp-1", "block:fixture-intro-1"]);
  assert.ok(d.localVerifiableShare! > 0 && d.localVerifiableShare! < 1);
  assert.deepEqual(d.missingSections, [{ requirementId: "demand_driver", required: false, cause: "no_usable_fact" }, { requirementId: "neighbourhood_context", required: false, cause: "no_usable_fact" }], "the optional sections without a fact are reported as missing, not filled");
  assert.ok(!Object.keys(d).some((k) => /eligib|publish|index|score|threshold|pass/i.test(k)), "a diagnostic carries no decision");
  assert.match(d.note, /no threshold, no eligibility, no indexing decision/);
  // the same facts with no blocks: only local content
  const bare = assemble(registry, { catalog: APPROVED_EDITORIAL_CATALOG }).differentiation!;
  assert.equal(bare.genericBlockCount, 0);
  assert.equal(bare.localVerifiableShare, 1);
  // a page that omits an unmet requirement reports it as missing, instead of filling it
  const country = priceFact({ factId: "fact:fixture:country:price:2026q3:v1", scope: { level: "country", countryCode: "ZZ" } });
  const sel = selectFactualClaims(registryWith(country), context({ topic: "market-analysis" }));
  const completeness = evaluateCompleteness(sel);
  assert.equal(completeness.allRequiredCovered, false);
  assert.ok(completeness.optionalOmitted.length > 0, "optional sections without a usable fact are omitted");
});

test("16. repetitive page versus a page with locally differentiated information", () => {
  const registry = registryWith(priceFact());
  const cityB = priceFact({ factId: "fact:fixture:city-b:price:2026q3:v1", scope: { level: "city", countryCode: "ZZ", citySlug: "city-b" }, value: priceValue(75) });
  const registryB = registryWith(cityB);
  const repetitiveA = assemble(registry).page!;
  const repetitiveB = assemble(registryB, { target: { level: "city", countryCode: "ZZ", citySlug: "city-b" } }).page!;
  const report = comparePages([{ key: "city-b", page: repetitiveB }, { key: "fixture-city", page: repetitiveA }]);
  assert.equal(report.pairs.length, 1);
  assert.deepEqual(report.pairs[0]!.sharedBlockIds, ["block:fixture-advice-1", "block:fixture-hyp-1", "block:fixture-intro-1"]);
  assert.equal(report.pairs[0]!.identicalClaimCount, 3, "the three generic blocks are identical, the rendered facts are not");
  // a hand-built differentiated page: several facts of several kinds, no blocks
  const qualitative = editorialFact({ factId: "fact:fixture:fixture-city:visual:2026:v1" });
  const reg2 = registryWith(priceFact(), qualitative);
  const claims = [factualOf(priceFact(), "median", { claimId: "claim:a" }), factualOf(qualitative, undefined, { claimId: "claim:b" })];
  const differentiated = {
    citySlug: CITY, topic: "pricing-guide", pathname: `/airbnb-optimizer/${CITY}/pricing-guide`,
    sections: [{ sectionId: "s1", heading: "A", claims: [claims[0]] }, { sectionId: "s2", heading: "B", claims: [claims[1]] }],
    usedFactIds: [PRICE_ID, qualitative.factId], missingFacts: [], eligibility: {}, generator: {}, traceability: {},
  } as never;
  const empty = evaluateCompleteness({ report: undefined as never, selected: [], uncovered: [] });
  const dDiff = diagnosePage(differentiated, reg2, empty);
  const dRep = diagnosePage(repetitiveA, registry, empty);
  assert.equal(dDiff.factualClaimCount, 2);
  assert.equal(dDiff.supportedSectionCount, 2);
  assert.equal(dDiff.genericBlockCount, 0);
  assert.equal(dDiff.localVerifiableShare, 1);
  assert.ok(dRep.localVerifiableShare! < dDiff.localVerifiableShare!, "the repetitive page is mostly generic text");
  assert.ok(dRep.genericBlockCount > dDiff.genericBlockCount);
  const cmp = comparePages([{ key: "x", page: repetitiveA }, { key: "y", page: differentiated }, { key: "z", page: repetitiveB }]);
  const sim = (a: string, b: string) => cmp.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))!.templateSimilarity;
  assert.ok(sim("x", "z") > sim("x", "y"), "two pages of the same blocks are more alike than a differentiated one");
  assert.deepEqual(comparePages([{ key: "y", page: differentiated }, { key: "x", page: repetitiveA }, { key: "z", page: repetitiveB }]), cmp, "order independent");
});

// --- 17-20. determinism, confidentiality, immutability, isolation --------------------------------------------------

test("17. the result is identical on two runs and for any registration order", () => {
  const facts = [priceFact(), editorialFact(), unavailabilityFact()];
  const one = JSON.stringify(assemble(registryWith(...facts)));
  assert.equal(JSON.stringify(assemble(registryWith(...facts))), one);
  assert.equal(JSON.stringify(assemble(registryWith(...[...facts].reverse()))), one);
  const realNow = Date.now; const realFetch = globalThis.fetch; const realRandom = Math.random;
  Date.now = () => { throw new Error("clock"); }; Math.random = () => { throw new Error("random"); }; globalThis.fetch = (() => { throw new Error("network"); }) as typeof fetch;
  try { assert.equal(JSON.stringify(assemble(registryWith(...facts))), one); } finally { Date.now = realNow; Math.random = realRandom; globalThis.fetch = realFetch; }
  assert.equal(JSON.parse(one).status, "ready_for_editorial_review");
});

test("18. diagnostics carry no text, number or identifier supplied by the caller", () => {
  const registry = registryWith(priceFact());
  const secret = "owner host@example.invalid 987654321 https://www.airbnb.com/rooms/1";
  const catalog = createEditorialCatalog([
    approvedBlock({ blockId: "block:fixture-leak" }, `Compare your listing with ${secret} before you change anything.`),
    approvedBlock({ blockId: `block:${secret}` }),
    { blockId: "block:fixture-garbage", text: secret },
  ]);
  const results = [
    assemble(registry, { catalog }),
    assemble(createFactRegistry(), { catalog }),
    assemble(registry, { target: { level: "city", countryCode: "ZZ", citySlug: secret } as GeographicScope }),
    assemble(registry, { topic: secret as never }),
    assemble(registry, { asOf: secret }),
  ];
  for (const r of results) {
    const text = JSON.stringify(r);
    for (const forbidden of ["example.invalid", "987654321", "airbnb.com/rooms", "owner", "Compare your listing"]) assert.ok(!text.includes(forbidden), forbidden);
  }
  assert.equal(results[0]!.status, "ready_for_editorial_review", "a refused block never blocks the page of rendered facts");
});

test("19. the registry and the catalogue are never modified; the input is not mutated", () => {
  const registry = registryWith(priceFact(), unavailabilityFact());
  const before = JSON.stringify(registry.list());
  const catalog = FULL_CATALOG();
  const catalogBefore = JSON.stringify(catalog.blocks);
  const request = input(registry, { catalog });
  const frozen = JSON.stringify({ ...request, registry: null, catalog: null });
  assemble(registry);
  assembleGeneratedPage(request);
  assert.equal(JSON.stringify(registry.list()), before);
  assert.equal(registry.size(), 2);
  assert.equal(JSON.stringify(catalog.blocks), catalogBefore);
  assert.equal(JSON.stringify({ ...request, registry: null, catalog: null }), frozen);
  const result = assembleGeneratedPage(request);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.reasons));
});

test("20. the S4 modules are isolated: no public code imports them and they import no route, generator or SEO infrastructure", () => {
  const root = join(__dirname, "..");
  const v4 = ["editorialCatalog", "factualSelection", "pageAssembler", "pageDiagnostics", "assemblyDecision"];
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (["node_modules", ".next", ".git", "diagnostics", ".agents"].includes(name)) return [];
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx|js|mjs)$/.test(name) ? [full] : [];
    });
  const importers = [...walk(join(root, "app")), ...walk(join(root, "lib")), ...walk(join(root, "components")), ...walk(join(root, "scripts"))].filter((file) => {
    if (file.includes(`${join("lib", "seo", "v3")}`) || file.includes("seo-v3-")) return false;
    return v4.some((name) => readFileSync(file, "utf8").includes(`v3/${name}`));
  });
  assert.deepEqual(importers, [], "nothing outside lib/seo/v3 and its tests imports the S4 modules");
  for (const name of v4) {
    const source = readFileSync(join(root, "lib", "seo", "v3", `${name}.ts`), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
    for (const specifier of imports) {
      assert.ok(specifier.startsWith("./") || specifier === "node:crypto", `${name} imports ${specifier}`);
    }
    assert.ok(!/fetch\(|process\.env|Date\.now|new Date\(|Math\.random|XMLHttpRequest/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), `${name} reads no clock, network, environment or randomness`);
  }
});

// --- sensitivity additions -------------------------------------------------------------------------------------------

test("21. a fact that cannot be rendered, a pending human decision and an S3 rejection each keep the page back, for their own reason", () => {
  // a currency without a safe written form: S2 accepts the fact, the renderer cannot state it
  const chf = priceFact({ value: { ...priceValue(111.11), currency: "CHF" } });
  const unrenderable = assemble(registryWith(chf));
  notReady(unrenderable, "unrenderable");
  assert.equal(unrenderable.status, "needs_human_decision");
  assert.ok(unrenderable.reasons.includes("fact_not_renderable"));
  assert.ok(unrenderable.completeness!.requiredUncovered.some((u) => u.cause === "not_renderable"));
  // a provisional threshold awaiting a human is reported as such, not rendered
  const unavailable = unavailabilityFact();
  const pending = assemble(registryWith(unavailable), { topic: "occupancy-guide", catalog: createEditorialCatalog([approvedBlock({ topics: ["occupancy-guide"] })]) });
  notReady(pending, "provisional threshold");
  assert.equal(pending.status, "needs_human_decision");
  assert.ok(pending.completeness!.requiredUncovered.some((u) => u.requirementId === "calendar_unavailability_rate" && u.cause === "human_decision_pending"));
  // a rendered sentence that the S3 wording rules refuse (a publisher whose name reads as a platform's authority)
  const authority = priceFact({ source: { ...licensed(), publisher: "Airbnb recommends Data (test only)" } });
  const rejected = assemble(registryWith(authority));
  notReady(rejected, "S3 rejection");
  assert.equal(rejected.status, "rejected");
  assert.ok(rejected.reasons.includes("page_validation_rejected"));
  assert.equal(rejected.validation!.verdict, "rejected");
});

test("22. a country-wide fact counts as country-wide in the diagnostic", () => {
  const country = priceFact({ factId: "fact:fixture:country:price:2026q3:v1", scope: { level: "country", countryCode: "ZZ" } });
  const city = priceFact();
  const registry = registryWith(country, city);
  const page = {
    citySlug: CITY, topic: "pricing-guide", pathname: `/airbnb-optimizer/${CITY}/pricing-guide`,
    sections: [{ sectionId: "s1", heading: "A", claims: [factualOf(city, "median", { claimId: "claim:a" })] }, { sectionId: "s2", heading: "B", claims: [factualOf(country, "median", { claimId: "claim:b" })] }],
    usedFactIds: [country.factId, city.factId], missingFacts: [], eligibility: {}, generator: {}, traceability: {},
  } as never;
  const d = diagnosePage(page, registry, evaluateCompleteness({ report: undefined as never, selected: [], uncovered: [] }));
  assert.equal(d.cityFactCount, 1);
  assert.equal(d.countryFactCount, 1);
  assert.equal(d.supportedSectionCount, 2);
});

// =====================================================================================================
// S4.2 — D1 to D5 and the coverage gaps found by S4.1
// =====================================================================================================

const hand = (citySlug: string, claims: [string, string, string][]) =>
  ({
    citySlug, topic: "pricing-guide", pathname: `/airbnb-optimizer/${citySlug}/pricing-guide`,
    sections: [{ sectionId: "s1", heading: "H", claims: claims.map(([claimId, kind, text]) => ({ claimId, kind, text })) }],
    usedFactIds: [], missingFacts: [], eligibility: {}, generator: {}, traceability: {},
  }) as never;
const SENSITIVE = "owner@example.invalid 987654321 Always reply to every guest within one hour";

test("D1. only a catalogue built by createEditorialCatalog is accepted, and a rejected one leaves no trace in the result", () => {
  const registry = registryWith(priceFact());
  const text = "Always reply to every guest within one hour.";
  const forged = {
    catalogId: "x", blocks: [], excluded: [{ blockId: "owner@example.invalid", reasons: ["leak 987654321"] }],
    blocksFor: () => [{ blockId: "block:forged-1", language: "en", kind: "methodological_advice", text, topics: ["pricing-guide"], hypothesisMarker: null, approvedBy: "x", approvedAt: "2000-01-01T00:00:00Z", textHash: sha256Hex(text) }],
  };
  const genuine = FULL_CATALOG();
  const throwing = Object.defineProperties({}, { blocksFor: { get() { throw new Error("hostile"); } }, excluded: { get() { throw new Error("hostile"); } } });
  const rejected: [string, unknown][] = [
    ["hand-made object", forged],
    ["spread copy of a genuine catalogue", { ...genuine }],
    ["Proxy of a genuine catalogue", new Proxy(genuine, {})],
    ["object inheriting a genuine catalogue", Object.create(genuine)],
    ["structuredClone-like copy", JSON.parse(JSON.stringify({ catalogId: genuine.catalogId, blocks: genuine.blocks, excluded: [] }))],
    ["accessors that throw", throwing],
    ["null", null], ["undefined", undefined], ["string", "catalogue"], ["array", []],
  ];
  for (const [label, catalog] of rejected) {
    assert.equal(isEditorialCatalog(catalog), false, label);
    let result: ReturnType<typeof assemble> | undefined;
    assert.doesNotThrow(() => { result = assemble(registry, { catalog: catalog as never }); }, label);
    assert.equal(result!.status, "invalid_request", label);
    assert.equal(result!.page, null, label);
    assert.deepEqual(result!.excludedBlocks, [], `${label}: nothing of a rejected catalogue is copied`);
    const serialised = JSON.stringify(result);
    for (const forbidden of ["owner@example.invalid", "987654321", "Always reply", "forged", "leak"]) assert.ok(!serialised.includes(forbidden), `${label}: ${forbidden}`);
  }
  // positive controls: genuine catalogues, including the empty production one, are accepted
  assert.equal(isEditorialCatalog(genuine), true);
  assert.equal(isEditorialCatalog(APPROVED_EDITORIAL_CATALOG), true);
  assert.equal(assemble(registry, { catalog: genuine }).status, "ready_for_editorial_review");
  assert.equal(assemble(registry, { catalog: APPROVED_EDITORIAL_CATALOG }).status, "ready_for_editorial_review");
  // a genuine catalogue cannot be extended or altered afterwards
  assert.ok(Object.isFrozen(genuine) && Object.isFrozen(genuine.blocks) && Object.isFrozen(genuine.excluded));
  assert.equal(Reflect.set(genuine, "blocksFor", forged.blocksFor), false);
  assert.equal(Reflect.set(genuine.blocks[0]!, "text", "changed"), false);
  // what this proves, and what it does not: the approver named in a block is still only a claim
  const selfApproved = createEditorialCatalog([approvedBlock({ approval: { status: "approved", approvedBy: "anybody", approvedAt: "2026-01-01T00:00:00Z", textHash: sha256Hex(ADVICE_TEXT) } })]);
  assert.equal(isEditorialCatalog(selfApproved) && selfApproved.blocks.length, 1, "provenance of the catalogue is not authenticity of the approval");
});

test("D2. every Unicode number, control, format and separator is refused in a block; ordinary English stays accepted", () => {
  const withChar = (ch: string) => `Compare your own listing with the ${ch} examples above before you change anything.`;
  const numbers: [string, string][] = [
    ["roman III", "Ⅲ"], ["roman VIII", "Ⅷ"], ["small roman", "ⅲ"], ["dingbat 1", "❶"], ["negative circled", "➊"], ["circled 1", "①"], ["superscript 2", "²"], ["fraction half", "½"],
    ["arabic-indic 3", "٣"], ["devanagari 3", "३"], ["fullwidth 3", "３"], ["mathematical bold 3", "𝟑"], ["ascii 3", "3"], ["ideographic number", "〇"],
  ];
  for (const [label, ch] of numbers) {
    const catalog = createEditorialCatalog([approvedBlock({}, withChar(ch))]);
    assert.equal(catalog.blocks.length, 0, label);
    assert.ok(catalog.excluded[0]!.reasons.includes("text_has_number"), `${label}: ${catalog.excluded[0]!.reasons.join(",")}`);
  }
  const hidden: [string, string][] = [
    ["line separator", " "], ["paragraph separator", " "], ["bidi override", "‮"], ["bidi isolate", "⁦"], ["left-to-right mark", "‎"], ["zero-width space", "​"],
    ["zero-width joiner", "‍"], ["word joiner", "⁠"], ["soft hyphen", "­"], ["byte order mark", "﻿"], ["tab", "\t"], ["next line", "\u0085"], ["null", "\u0000"],
    ["escape", "\u001B"], ["no-break space", " "], ["ideographic space", "　"], ["thin space", " "], ["newline", "\n"], ["carriage return", "\r"],
  ];
  for (const [label, ch] of hidden) {
    const catalog = createEditorialCatalog([approvedBlock({}, withChar(ch))]);
    assert.equal(catalog.blocks.length, 0, label);
    assert.ok(catalog.excluded[0]!.reasons.length > 0, label);
  }
  // spelled-out and fullwidth-letter quantities were already refused; they stay refused
  for (const text of ["Compare your own listing with the three examples above before you change anything.", "Compare your own listing with the ｔｈｒｅｅ examples above before you change anything.", "Compare your own listing with many examples above before you change anything.", "Compare your own listing with a third of the examples above before you change anything."]) {
    assert.equal(createEditorialCatalog([approvedBlock({}, text)]).blocks.length, 0, text);
  }
  // ordinary English text is not refused
  for (const text of [ADVICE_TEXT, INTRO_TEXT, "Compare your listing, step by step, with the information above before you change the title or the description.", "Don't change several things at once: compare the information above with your own listing first."]) {
    const kind = text === INTRO_TEXT ? "editorial_non_factual" : "methodological_advice";
    const catalog = createEditorialCatalog([approvedBlock({ kind }, text)]);
    // the last sample uses a quantifier word and is expected to be refused; the others must pass
    if (text.startsWith("Don't")) assert.equal(catalog.blocks.length, 0, "a quantifier is a quantifier");
    else assert.equal(catalog.blocks.length, 1, `${text}: ${JSON.stringify(catalog.excluded)}`);
  }
  assert.equal(createEditorialCatalog([hypothesisBlock()]).blocks.length, 1);
});

test("D3. pages that differ only by city and figures are identical in template; template, raw text and local share are separate measures", () => {
  const cityB = priceFact({ factId: "fact:fixture:city-b:price:2026q3:v1", scope: { level: "city", countryCode: "YY", citySlug: "beta-city" }, value: priceValue(87) });
  const bare = APPROVED_EDITORIAL_CATALOG;
  const a = assemble(registryWith(priceFact({ value: priceValue(101) })), { catalog: bare }).page!;
  const b = assemble(registryWith(cityB), { target: { level: "city", countryCode: "YY", citySlug: "beta-city" }, catalog: bare }).page!;
  const report = comparePages([{ key: "alpha", page: a }, { key: "beta", page: b }]);
  const pair = report.pairs[0]!;
  assert.equal(pair.templateSimilarity, 1, "city, country code and figures are masked");
  assert.equal(pair.templateIdentical, true);
  assert.ok(pair.rawTextSimilarity < pair.templateSimilarity, "raw text hides the repetition");
  assert.deepEqual(pair.localTextShare, { a: 1, b: 1 }, "a high local share is not a sign of originality");
  assert.match(report.note, /not evidence of quality or originality/);
  assert.ok(![...Object.keys(pair), ...Object.keys(report)].some((key) => /eligib|publish|index|score|threshold|pass/i.test(key)), "no decision in the report");
  // two really different pages
  const qualitative = editorialFact();
  const different = hand("gamma-town", [["claim:a", "factual", "Editorial note: FIXTURE sentence without any figure about the arches of the old harbour."], ["claim:b", "factual", "The harbour closes at dusk and the ferry leaves from the north pier."]]);
  const unlike = comparePages([{ key: "alpha", page: a }, { key: "gamma", page: different }]).pairs[0]!;
  assert.ok(unlike.templateSimilarity < 0.2, JSON.stringify(unlike));
  assert.equal(unlike.templateIdentical, false);
  void qualitative;
  // symmetry, order independence, duplicate keys
  const forward = comparePages([{ key: "alpha", page: a }, { key: "beta", page: b }, { key: "gamma", page: different }]);
  const backward = comparePages([{ key: "gamma", page: different }, { key: "beta", page: b }, { key: "alpha", page: a }]);
  assert.deepEqual(forward, backward);
  assert.equal(comparePages([{ key: "alpha", page: a }, { key: "beta", page: b }]).pairs[0]!.templateSimilarity, comparePages([{ key: "beta", page: b }, { key: "alpha", page: a }]).pairs[0]!.templateSimilarity);
  const duplicated = comparePages([{ key: "alpha", page: a }, { key: "alpha", page: b }]);
  assert.deepEqual(duplicated.duplicateKeys, ["alpha"]);
  assert.deepEqual(duplicated.pairs, []);
  assert.deepEqual(forward.maxTemplateSimilarityByPage, { alpha: 1, beta: 1, gamma: forward.maxTemplateSimilarityByPage.gamma });
  assert.ok(forward.maxTemplateSimilarityByPage.gamma! < 0.2);
});

test("D3b. very short pages, exact values, shared blocks and identical claims", () => {
  const tiny = (text: string) => hand("a-town", [["claim:t", "editorial_non_factual", text]]);
  const sim = (x: unknown, y: unknown) => comparePages([{ key: "x", page: x as never }, { key: "y", page: y as never }]).pairs[0]!;
  assert.equal(sim(tiny("Short intro"), tiny("Short intro")).templateSimilarity, 1, "identical tiny pages are identical");
  assert.equal(sim(tiny("Short intro"), tiny("Other words")).templateSimilarity, 0);
  assert.equal(sim(hand("a-town", []), hand("b-town", [])).templateSimilarity, 1, "two empty pages are identical");
  assert.equal(sim(hand("a-town", []), tiny("Short intro")).templateSimilarity, 0);
  // exact Jaccard on 4-word shingles: {a b c d, b c d e} vs {a b c d, b c d f} -> 1/3
  assert.equal(sim(tiny("alpha beta gamma delta epsilon"), tiny("alpha beta gamma delta zeta")).rawTextSimilarity, 0.3333);
  assert.equal(sim(tiny("alpha beta gamma delta epsilon"), tiny("alpha beta gamma delta zeta")).templateSimilarity, 0.3333);
  // digits and the city of the page are masked, other words are not
  assert.equal(sim(hand("alpha-town", [["claim:t", "factual", "In alpha-town the price is 101 today"]]), hand("beta-city", [["claim:t", "factual", "In beta-city the price is 87 today"]])).templateSimilarity, 1);
  assert.ok(sim(hand("alpha-town", [["claim:t", "factual", "In alpha-town the price is 101 today"]]), hand("beta-city", [["claim:t", "factual", "In beta-city the cost is 87 today"]])).templateSimilarity < 1);
  // shared blocks and identical claims (case-insensitive)
  const withBlocks = (ids: string[], extra = "") => hand("a-town", [...ids.map((id) => [`claim:blk:${id}`, "methodological_advice", `Text of ${id} for the guests of the unit`] as [string, string, string]), ["claim:f", "factual", `Rendered fact ${extra}`]]);
  const shared = sim(withBlocks(["x", "y"], "ONE"), withBlocks(["x"], "one"));
  assert.deepEqual(shared.sharedBlockIds, ["block:x"]);
  assert.equal(shared.identicalClaimCount, 2, "the shared block and the same fact in another case");
  // max similarity is tracked per page
  const three = comparePages([{ key: "p", page: tiny("Short intro") }, { key: "q", page: tiny("Short intro") }, { key: "r", page: tiny("Other words") }]);
  assert.deepEqual(three.maxTemplateSimilarityByPage, { p: 1, q: 1, r: 0 });
  // the local share is rounded to four decimals and is null for an empty page
  assert.equal(sim(hand("a-town", [["claim:f", "factual", "aa"], ["claim:b", "methodological_advice", "bbbb"]]), hand("a-town", [])).localTextShare.a, 0.3333);
  assert.equal(sim(hand("a-town", []), hand("a-town", [])).localTextShare.a, null);
  const registry = registryWith(priceFact());
  assert.equal(diagnosePage(hand("a-town", [["claim:f", "factual", "aa"], ["claim:b", "methodological_advice", "bbbb"]]), registry, evaluateCompleteness({ report: undefined as never, selected: [], uncovered: [] })).localVerifiableShare, 0.3333);
});

test("D4. the returned result is deeply frozen, and a page that travelled can be verified again", () => {
  const registry = registryWith(priceFact());
  const catalog = FULL_CATALOG();
  const result = assemble(registry, { catalog });
  const page = result.page!;
  const nested: [string, object][] = [
    ["result", result], ["page", page], ["sections", page.sections], ["section", page.sections[0]!], ["claims", page.sections[1]!.claims], ["factual claim", page.sections[1]!.claims[0]!],
    ["figures", (page.sections[1]!.claims[0] as unknown as { figures: object }).figures], ["figure", (page.sections[1]!.claims[0] as unknown as { figures: object[] }).figures[0]!],
    ["constraints", (page.sections[1]!.claims[0] as unknown as { inheritedDisplayConstraints: object }).inheritedDisplayConstraints], ["block claim", page.sections[0]!.claims[0]!],
    ["usedFactIds", page.usedFactIds], ["missingFacts", page.missingFacts], ["eligibility", page.eligibility], ["reasons", page.eligibility.reasons], ["traceability", page.traceability],
    ["inputFacts", page.traceability.inputFacts], ["generator", page.generator], ["validation", result.validation!], ["completeness", result.completeness!], ["differentiation", result.differentiation!], ["reasons of result", result.reasons],
  ];
  for (const [label, value] of nested) assert.ok(Object.isFrozen(value), `${label} must be frozen`);
  const factual = page.sections[1]!.claims[0]!;
  assert.equal(Reflect.set(factual, "text", "The maximum nightly price is €1."), false);
  assert.equal(Reflect.set(page.sections[0]!.claims[0]!, "text", "Prices doubled."), false);
  assert.equal(Reflect.set(page, "usedFactIds", []), false);
  assert.equal(Reflect.set(page.sections, "length", 0), false);
  assert.equal(Reflect.set(page.eligibility, "eligibility", "publishable_standalone"), false);
  assert.equal(Reflect.set(result, "publicationAuthorised", true), false);
  // the page does not alias anything the caller or the catalogue holds
  assert.notStrictEqual(page.sections[0]!.claims[0], catalog.blocks[0]);
  assert.equal(assemble(registry, { catalog }).page!.sections[0]!.claims[0]!.text, INTRO_TEXT);
  // verification of a page that travelled (JSON, cache, another module)
  const travelled = () => JSON.parse(JSON.stringify(page));
  const verify = (candidate: unknown) => verifyAssembledPage(candidate, context(), registry, catalog);
  assert.deepEqual(verify(travelled()), { ok: true, reasons: [] });
  type Doc = { traceability: { contentHash: string }; sections: { claims: { kind: string; text: string }[] }[]; eligibility: { eligibility: string }; usedFactIds: string[] };
  const tamper = (edit: (copy: Doc) => void) => { const copy = travelled() as Doc; edit(copy); return verify(copy); };
  const sortKeys = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(sortKeys) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])) : value;
  const stableStringify = (value: unknown): string => JSON.stringify(sortKeys(value));
  const rehash = (copy: Doc) => { copy.traceability.contentHash = sha256Hex(stableStringify(copy.sections)); };
  const factualAt = (copy: Doc) => copy.sections.find((section) => section.claims[0]!.kind === "factual")!.claims[0]!;
  const edited = tamper((copy) => { factualAt(copy).text = factualAt(copy).text.replace("median", "maximum"); });
  assert.equal(edited.ok, false);
  assert.ok(edited.reasons.includes("content_hash_mismatch") && edited.reasons.includes("page_validation_not_accepted"));
  const rehashed = tamper((copy) => { factualAt(copy).text = factualAt(copy).text.replace("median", "maximum"); rehash(copy); });
  assert.deepEqual(rehashed.reasons, ["page_validation_not_accepted"], "recomputing the hash does not get past S3");
  const swappedBlock = tamper((copy) => { copy.sections[0].claims[0].text = "Here is another overview of what follows on this page."; rehash(copy); });
  assert.deepEqual(swappedBlock.reasons, ["block_not_in_catalog"], "a sentence that S3 accepts but the catalogue does not hold is refused");
  assert.ok(tamper((copy) => { copy.eligibility.eligibility = "publishable_standalone"; }).reasons.includes("eligibility_overstated"));
  assert.ok(tamper((copy) => { copy.usedFactIds = []; }).reasons.includes("page_validation_not_accepted"));
  assert.equal(verifyAssembledPage(travelled(), context(), registry, { blocksFor: () => [] } as never).ok, false, "a hand-made catalogue verifies nothing");
  for (const bad of [null, undefined, "x", 7, [], {}, { sections: "no" }]) assert.deepEqual(verify(bad).reasons, ["malformed_page"]);
});

test("D5. invalid, hostile and malformed inputs give invalid_request, never an exception, and echo nothing", () => {
  const registry = registryWith(priceFact());
  const base = input(registry);
  const cyclic: Record<string, unknown> = { level: "city", countryCode: "ZZ", citySlug: CITY };
  cyclic.self = cyclic;
  const hostileRegistry = new Proxy({}, { get() { throw new Error("hostile registry"); } });
  let reads = 0;
  const withGetter = Object.defineProperty({ ...base }, "topic", { enumerable: true, get() { reads += 1; throw new Error(SENSITIVE); } });
  const cases: [string, unknown][] = [
    ["null input", null], ["undefined input", undefined], ["string input", "request"], ["number input", 7], ["array input", []], ["empty object", {}],
    ["null registry", { ...base, registry: null }], ["registry without methods", { ...base, registry: {} }], ["registry that throws", { ...base, registry: hostileRegistry }],
    ["null catalogue", { ...base, catalog: null }], ["Proxy catalogue", { ...base, catalog: new Proxy(base.catalog, {}) }],
    ["undefined target", { ...base, target: undefined }], ["Proxy target", { ...base, target: new Proxy({ level: "city", countryCode: "ZZ", citySlug: CITY }, {}) }],
    ["cyclic target", { ...base, target: cyclic }], ["accessor target", { ...base, target: Object.defineProperty({ level: "city", countryCode: "ZZ" }, "citySlug", { enumerable: true, get() { throw new Error(SENSITIVE); } }) }],
    ["throwing accessor on the input", withGetter], ["sensitive topic", { ...base, topic: SENSITIVE }], ["sensitive slug", { ...base, target: { level: "city", countryCode: "ZZ", citySlug: SENSITIVE } }],
    ["sensitive platform", { ...base, platform: SENSITIVE }], ["object platform", { ...base, platform: { toString() { throw new Error(SENSITIVE); } } }], ["undefined language", { ...base, language: undefined }],
    ["huge asOf", { ...base, asOf: "x".repeat(1_000_000) }], ["proto topic", { ...base, topic: "__proto__" }], ["relative slug", { ...base, target: { level: "city", countryCode: "ZZ", citySlug: "../../etc" } }],
  ];
  for (const [label, raw] of cases) {
    let result: ReturnType<typeof assembleGeneratedPage> | undefined;
    assert.doesNotThrow(() => { result = assembleGeneratedPage(raw as never); }, label);
    assert.equal(result!.status, "invalid_request", label);
    assert.equal(result!.page, null, label);
    assert.equal(result!.publicationAuthorised, false);
    const serialised = JSON.stringify(result);
    for (const forbidden of ["owner@example.invalid", "987654321", "Always reply", "hostile", "etc"]) assert.ok(!serialised.includes(forbidden), `${label}: ${forbidden}`);
  }
  assert.ok(reads <= 1);
  // valid requests still work after all of this on the same registry (no state is kept)
  assert.equal(assembleGeneratedPage(base).status, "ready_for_editorial_review");
  assert.equal(assembleGeneratedPage(base).status, "ready_for_editorial_review");
});

test("S4.2 coverage: approval dates in the assembler, provenance of the fingerprints, catalogue identity, approval record details", () => {
  // a block approved after the page's instant is not on the page; the same block is on it later
  const later = createEditorialCatalog([approvedBlock({ approval: { status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-20T00:00:00Z", textHash: sha256Hex(ADVICE_TEXT) } })]);
  const registry = registryWith(priceFact());
  const early = assemble(registry, { catalog: later, asOf: "2026-09-10T00:00:00Z" });
  assert.equal(early.status, "ready_for_editorial_review");
  assert.ok(!early.page!.sections.some((s) => s.sectionId === "sec:method"));
  assert.ok(assemble(registry, { catalog: later }).page!.sections.some((s) => s.sectionId === "sec:method"));
  // fingerprints: the catalogue, the registry content and the fact versions all count
  const one = assemble(registry, { catalog: FULL_CATALOG() }).page!.traceability;
  assert.notEqual(assemble(registry, { catalog: createEditorialCatalog([approvedBlock()]) }).page!.traceability.inputsFingerprint, one.inputsFingerprint);
  assert.equal(assemble(registry, { catalog: FULL_CATALOG() }).page!.traceability.inputsFingerprint, one.inputsFingerprint);
  const extended = registryWith(priceFact(), editorialFact());
  assert.notEqual(assemble(extended).page!.traceability.registrySnapshotId, one.registrySnapshotId);
  assert.equal(assemble(registryWith(editorialFact(), priceFact())).page!.traceability.registrySnapshotId, assemble(extended).page!.traceability.registrySnapshotId);
  const v2 = priceFact({
    factId: "fact:fixture:fixture-city:price:2026q3:v2", version: 2, supersedes: PRICE_ID, collectedAt: "2026-09-05T10:00:00Z",
    validation: { status: "human_validated", validatedBy: "fixture-reviewer", validatedAt: "2026-09-06T10:00:00Z", note: null },
    usage: { ...approvedFor(["pricing-guide", "competitor-analysis"], "2026-09-07T10:00:00Z"), displayConstraints: [...MEASURED] }, value: priceValue(112),
  });
  const upgraded = assemble(registryWith(priceFact(), v2));
  assert.equal(upgraded.status, "ready_for_editorial_review", JSON.stringify(upgraded.reasons));
  assert.deepEqual(upgraded.page!.usedFactIds, [v2.factId]);
  assert.deepEqual(upgraded.page!.traceability.inputFacts, [{ factId: v2.factId, version: 2 }]);
  assert.match(upgraded.page!.sections.find((s) => s.sectionId === "sec:nightly_price_distribution")!.claims[0]!.text, /€112\.00/);
  // catalogue identity covers the text, the kind and the topics
  const idOf = (overrides: Record<string, unknown> = {}, text?: string) => createEditorialCatalog([approvedBlock(overrides, text)]).catalogId;
  assert.notEqual(idOf(), idOf({}, "Compare your own listing with the information above before you act on it."));
  assert.notEqual(idOf(), idOf({ topics: ["pricing-guide"] }));
  assert.notEqual(idOf(), idOf({ kind: "editorial_non_factual" }));
  // approval record details
  const hash = sha256Hex(ADVICE_TEXT);
  const reasons = (approval: unknown, extra: Record<string, unknown> = {}) => createEditorialCatalog([approvedBlock({ approval, ...extra })]).excluded[0]?.reasons;
  assert.deepEqual(reasons({ status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-10T10:00:00Z", textHash: hash, extra: 1 }), ["not_approved"]);
  assert.deepEqual(reasons({ status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-10T10:00:00Z", textHash: hash.toUpperCase() }), ["approval_incomplete"]);
  assert.deepEqual(reasons({ status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-10T10:00:00Z", textHash: hash.slice(1) }), ["approval_incomplete"]);
  assert.ok(reasons({ status: "approved", approvedBy: "fixture-editor", approvedAt: "2026-09-10T10:00:00Z", textHash: hash }, { topics: ["pricing-guide", "pricing-guide"] })!.includes("topics_invalid"));
  assert.equal(FULL_CATALOG().blocksFor("pricing-guide", "en", "garbage").length, 0);
  assert.equal(FULL_CATALOG().blocksFor("pricing-guide", "fr" as never, AS_OF).length, 0);
  // reasons are sorted and deduplicated
  const combined = decideAssembly({ topicOverall: "blocked", requiredUncovered: 1, notRenderable: 1, factualClaimCount: 0, pageVerdict: "needs_human_decision", integrityOk: false });
  assert.deepEqual([...combined.reasons], [...combined.reasons].sort());
  assert.equal(new Set(combined.reasons).size, combined.reasons.length);
});

test("D3c. masking: country codes anywhere, and the place phrase of a rendered fact including its district", () => {
  const sim = (x: unknown, y: unknown) => comparePages([{ key: "x", page: x as never }, { key: "y", page: y as never }]).pairs[0]!.templateSimilarity;
  const one = (slug: string, text: string) => hand(slug, [["claim:f", "factual", text]]);
  // a country code in free position
  assert.equal(sim(one("a-town", "Prices in ZZ are listed below for guests"), one("b-town", "Prices in YY are listed below for guests")), 1);
  assert.ok(sim(one("a-town", "Prices in ZZ are listed below for guests"), one("b-town", "Prices in Spain are listed below for guests")) < 1, "only two-letter upper-case codes are masked");
  // the place phrase of a rendered fact, with a district name that is not the slug
  const rendered = (district: string, slug: string, code: string) => `In ${district}, ${slug}, ${code} (platform: not specified, property type: not specified), the median nightly price is €90.00.`;
  assert.equal(sim(one("alpha-town", rendered("north quarter", "alpha-town", "ZZ")), one("beta-city", rendered("old port area", "beta-city", "YY"))), 1);
  assert.ok(sim(one("alpha-town", rendered("north quarter", "alpha-town", "ZZ")), one("beta-city", rendered("old port area", "beta-city", "YY").replace("median", "lowest"))) < 1);
});

// --- S5.4-E. quartiles (p25, p75) of a validated price fact --------------------------------------------------------

const priceSection = (r: ReturnType<typeof assemble>) => r.page!.sections.find((section) => section.heading === "Observed nightly prices")!;

test("E1. a price fact that carries p25 and p75 states the median, then the quartiles, each as its own claim of the same fact", () => {
  const registry = registryWith(priceFact());
  const r = assemble(registry, { catalog: APPROVED_EDITORIAL_CATALOG });
  assert.equal(r.status, "ready_for_editorial_review", JSON.stringify(r.reasons));
  const claims = priceSection(r).claims;
  assert.deepEqual(claims.map((c) => c.claimId), ["claim:fact:nightly_price_distribution", "claim:fact:nightly_price_distribution:p25", "claim:fact:nightly_price_distribution:p75"]);
  assert.match(claims[0]!.text, /the median nightly price is €111\.11 \(confidence: high, 25 listings observed from 2026-06-01 to 2026-08-31/);
  assert.match(claims[1]!.text, /the lower-quartile nightly price is €90\.00 \(confidence: high, 25 listings/);
  assert.match(claims[2]!.text, /the upper-quartile nightly price is €130\.00 \(confidence: high, 25 listings/);
  for (const [claim, stat] of [[claims[0]!, "median"], [claims[1]!, "p25"], [claims[2]!, "p75"]] as const) {
    assert.equal(claim.kind, "factual");
    assert.deepEqual((claim as unknown as { supportingFactIds: string[] }).supportingFactIds, [PRICE_ID]);
    assert.deepEqual((claim as unknown as { figures: { valuePath: string }[] }).figures.map((f) => f.valuePath).sort(), [stat, "sampleSize"].sort());
  }
  assert.deepEqual(r.page!.usedFactIds, [PRICE_ID], "same fact, nothing new is used");
  assert.equal(r.validation!.verdict, "accepted", "S3 still validates every claim");
  assert.equal(r.publicationAuthorised, false);
  assert.equal(r.indexingAuthorised, false);
});

test("E2. without p25 and p75 the page is exactly what it was: the median only", () => {
  const withQuartiles = assemble(registryWith(priceFact()), { catalog: APPROVED_EDITORIAL_CATALOG });
  const without = assemble(registryWith(priceFact({ value: priceValue(111.11) })), { catalog: APPROVED_EDITORIAL_CATALOG });
  const claims = priceSection(without).claims;
  assert.equal(claims.length, 1);
  assert.equal(claims[0]!.text, priceSection(withQuartiles).claims[0]!.text, "the median sentence is unchanged");
  assert.equal(claims[0]!.claimId, "claim:fact:nightly_price_distribution");
  // one quartile only: only that one
  const onlyP75 = assemble(registryWith(priceFact({ value: priceValue(111.11, { p75: 130 }) })), { catalog: APPROVED_EDITORIAL_CATALOG });
  assert.deepEqual(priceSection(onlyP75).claims.map((c) => c.claimId.split(":").pop()), ["nightly_price_distribution", "p75"]);
});

test("E3. nothing is computed or repaired: a quartile out of order with the median or unusable never reaches a page", () => {
  // S2 already refuses these facts at registration; the S4 selection repeats the same checks as a second line of defence
  // (not reachable through a real registry, so not testable from here).
  const cases: [string, Record<string, unknown>][] = [
    ["p25 above the median", { p25: 120, p75: 130 }],
    ["p75 below the median", { p25: 90, p75: 100 }],
    ["negative p25", { p25: -5 }],
    ["p25 not a number", { p25: Number.NaN }],
    ["p75 infinite", { p75: Number.POSITIVE_INFINITY }],
    ["p25 as text", { p25: "90" }],
  ];
  for (const [label, extra] of cases) {
    const outcome = createFactRegistry().register(priceFact({ value: priceValue(111.11, extra) }));
    assert.equal(outcome.ok, false, label);
    assert.equal(assemble(createFactRegistry(), { catalog: APPROVED_EDITORIAL_CATALOG }).page, null, "no fact, no page");
  }
});

test("E4. other facts are unchanged: one claim for an unavailability rate, none for a missing fact", () => {
  const registry = registryWith(priceFact(), unavailabilityFact());
  const r = assemble(registry, { catalog: APPROVED_EDITORIAL_CATALOG });
  const sections = r.page ? r.page.sections : [];
  const calendar = sections.find((section) => section.heading === "Calendar unavailability");
  if (calendar !== undefined) assert.equal(calendar.claims.length, 1);
  assert.equal(assemble(createFactRegistry(), { catalog: APPROVED_EDITORIAL_CATALOG }).page, null);
});

test("E5. a tampered quartile sentence is refused by S3 even when the hash is recomputed", () => {
  const registry = registryWith(priceFact());
  const r = assemble(registry, { catalog: APPROVED_EDITORIAL_CATALOG });
  const copy = JSON.parse(JSON.stringify(r.page)) as { sections: { heading: string; claims: { text: string }[] }[]; traceability: { contentHash: string } };
  const claim = copy.sections.find((section) => section.heading === "Observed nightly prices")!.claims[1]!;
  claim.text = claim.text.replace("lower-quartile", "upper-quartile");
  const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
  copy.traceability.contentHash = sha256Hex(JSON.stringify(sort(copy.sections)));
  const verdict = verifyAssembledPage(copy, context(), registry, APPROVED_EDITORIAL_CATALOG);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("page_validation_not_accepted"));
  claim.text = claim.text.replace("€90.00", "€95.00");
  assert.equal(verifyAssembledPage(copy, context(), registry, APPROVED_EDITORIAL_CATALOG).ok, false, "an invented amount is refused");
});

// --- S5.4-G. neighbourhood_context, an OPTIONAL requirement of pricing-guide ------------------------------------------

const areaNote = (overrides: Record<string, unknown> = {}) =>
  editorialFact({
    factId: "fact:fixture:fixture-city:area:2026:v1", relevantTopics: ["pricing-guide"], usage: { ...approvedFor(["pricing-guide"]), displayConstraints: ["label_as_editorial_note"] },
    value: { category: "neighbourhood_context", statement: "FIXTURE area sentence without any figure.", language: "en", basis: "editorial_observation" }, ...overrides,
  });

test("G1. a price-only pricing-guide page is unchanged: the new optional fact is absent and nothing is blocked", () => {
  const r = assemble(registryWith(priceFact()), { catalog: APPROVED_EDITORIAL_CATALOG });
  assert.equal(r.status, "ready_for_editorial_review", JSON.stringify(r.reasons));
  assert.deepEqual(r.completeness!.requiredUncovered, []);
  assert.ok(r.completeness!.optionalOmitted.some((u) => u.requirementId === "neighbourhood_context" && u.cause === "no_usable_fact"));
});

test("G2. with its provisional threshold the note is present but not rendered: reported as a pending human decision, never filled", () => {
  const r = assemble(registryWith(priceFact(), areaNote()), { catalog: APPROVED_EDITORIAL_CATALOG });
  assert.equal(r.status, "ready_for_editorial_review");
  assert.ok(r.completeness!.optionalOmitted.some((u) => u.requirementId === "neighbourhood_context" && u.cause === "human_decision_pending"));
  assert.ok(!r.page!.sections.some((section) => section.claims.some((claim) => claim.text.includes("FIXTURE area sentence"))));
});

test("G3. a note about another topic is never offered to pricing-guide", () => {
  const stranger = areaNote({ relevantTopics: ["business-travel-guide"], usage: { ...approvedFor(["business-travel-guide"]), displayConstraints: ["label_as_editorial_note"] } });
  const r = assemble(registryWith(priceFact(), stranger), { catalog: APPROVED_EDITORIAL_CATALOG });
  assert.ok(r.completeness!.optionalOmitted.some((u) => u.requirementId === "neighbourhood_context" && u.cause === "no_usable_fact"));
  assert.ok(!r.page!.usedFactIds.includes("fact:fixture:fixture-city:area:2026:v1" as never));
});
