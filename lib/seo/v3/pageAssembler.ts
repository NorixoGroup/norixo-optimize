/**
 * SEO generator V3 — deterministic page assembler (S4). Isolated: no route, generator, sitemap, robots,
 * canonical or indexing code imports it, and it imports none of them.
 *
 * Inputs: the fact registry (S2), a closed editorial catalogue (S4), an exact city x topic context.
 * Output: either a page that is READY FOR EDITORIAL REVIEW, or a refusal with reasons. Never a publication.
 *
 *   1. S2 decides which facts are usable for the topic in this exact context (`selectFactualClaims`).
 *   2. Each retained fact becomes one factual claim built by the S3 renderer, kept exactly as rendered.
 *   3. Fixed catalogue blocks (transitions, advice, non-numeric hypotheses) are added verbatim, only when the
 *      page has at least one rendered fact: a page is never made of generic blocks alone.
 *   4. The whole page goes through the S3 page validator; every factual claim is re-rendered and compared.
 *   5. One blocking refusal anywhere forbids the ready status (`decideAssembly`).
 *
 * A requirement that has no usable fact leaves its section out and is reported in `completeness`; it is
 * never filled with generic text. The page's own `eligibility` never says "publishable_standalone": that
 * is a human editorial decision. The result carries `publicationAuthorised: false` and
 * `indexingAuthorised: false` as literal types.
 *
 * Language: English only (the only language S3 supports). `language` is an explicit input so that localised
 * rendering can be added later through new renderers and new catalogue blocks, without changing this flow.
 */
import { renderFactualClaim } from "./claimRender";
import { validateGeneratedPage, type ClaimContext, type PageValidationResult } from "./claimValidation";
import { decideAssembly, type AssemblyReason, type AssemblyStatus } from "./assemblyDecision";
import { isEditorialCatalog, sha256Hex, stableStringify, type AssemblyLanguage, type BlockKind, type EditorialBlock, type EditorialCatalog, type ExcludedBlock } from "./editorialCatalog";
import type { EditorialDecision, EditorialDecisionReason } from "./editorialEligibility";
import type { FactRegistry } from "./factRegistry";
import { snapshotUntrustedFact } from "./factValidation";
import { GENERATOR_V3_CONTRACT_VERSION, type GeneratedPage, type PageSection } from "./generatedPage";
import type { FactId, FactPlatform, FactPropertyType, GeographicScope } from "./localFact";
import { evaluateCompleteness, diagnosePage, type Completeness, type EditorialDiagnostic } from "./pageDiagnostics";
import { selectFactualClaims } from "./factualSelection";
import { TOPIC_REQUIREMENTS_VERSION } from "./topicRequirements";
import type { LocalSeoTopicSlug } from "./topics";
import type { TopicFactsOverall } from "./topicFactEvaluation";

export const ASSEMBLER_RULE_VERSION = "seo-v3-assembler/1";

export type AssembleInput = Readonly<{
  registry: FactRegistry;
  catalog: EditorialCatalog;
  /** A city page: the target must be a city. */
  target: GeographicScope;
  platform: FactPlatform;
  propertyType: FactPropertyType;
  topic: LocalSeoTopicSlug;
  asOf: string;
  language: AssemblyLanguage;
}>;

export type AssemblyResult = Readonly<{
  status: AssemblyStatus;
  reasons: readonly AssemblyReason[];
  /** Present only when the status is ready_for_editorial_review. */
  page: GeneratedPage | null;
  language: AssemblyLanguage | null;
  topicOverall: TopicFactsOverall | null;
  completeness: Completeness | null;
  /** Result of the S3 page validation (stable codes and ids of existing facts only). */
  validation: PageValidationResult | null;
  /** Differentiation diagnostic; present only with a page. Not a quality gate. */
  differentiation: EditorialDiagnostic | null;
  /** Catalogue blocks that were supplied but are unusable, with the reasons (their text is never kept). */
  excludedBlocks: readonly ExcludedBlock[];
  /** Editorial review readiness is not an authorisation to publish. */
  publicationAuthorised: false;
  /** Nor an indexing decision. */
  indexingAuthorised: false;
}>;

const refusal = (status: AssemblyStatus, reasons: readonly AssemblyReason[], excludedBlocks: readonly ExcludedBlock[] = []): AssemblyResult =>
  Object.freeze({
    status, reasons: Object.freeze([...reasons]), page: null, language: null, topicOverall: null, completeness: null, validation: null,
    differentiation: null, excludedBlocks, publicationAuthorised: false, indexingAuthorised: false,
  });

/** Where each kind of block goes. Fixed. */
const BLOCK_SECTIONS: Readonly<Record<BlockKind, { sectionId: string; heading: string; order: number }>> = {
  editorial_non_factual: { sectionId: "sec:intro", heading: "Introduction", order: 0 },
  methodological_advice: { sectionId: "sec:method", heading: "How to use this information", order: 2 },
  explicit_hypothesis: { sectionId: "sec:hypotheses", heading: "Open questions", order: 3 },
};

function blockClaim(block: EditorialBlock): Record<string, unknown> {
  const base = { claimId: `claim:blk:${block.blockId.slice("block:".length)}`, sectionId: BLOCK_SECTIONS[block.kind].sectionId, kind: block.kind, text: block.text };
  return block.kind === "explicit_hypothesis" ? { ...base, hypothesisMarker: block.hypothesisMarker, basisFactIds: [], figures: [] } : base;
}

/** Freezes a plain-data value and everything reachable from it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}

/**
 * Assembles one page. Total: whatever the input, the answer is a result, never an exception. An input that is
 * not a well-formed request (null, a Proxy catalogue, a catalogue not built by `createEditorialCatalog`, a
 * throwing accessor, …) gives `invalid_request` with no trace of what was supplied.
 */
export function assembleGeneratedPage(input: AssembleInput): AssemblyResult {
  try {
    if (typeof input !== "object" || input === null) return refusal("invalid_request", ["invalid_request"]);
    // provenance first: nothing of a catalogue is read before it is known to be genuine
    if (!isEditorialCatalog(input.catalog)) return refusal("invalid_request", ["invalid_request"]);
    return assembleChecked(input);
  } catch {
    return refusal("invalid_request", ["invalid_request"]);
  }
}

function assembleChecked(input: AssembleInput): AssemblyResult {
  const excludedBlocks = input.catalog.excluded;
  if (input.language !== "en") return refusal("invalid_request", ["language_not_supported"], excludedBlocks);
  const snapshot = snapshotUntrustedFact({ target: input.target, platform: input.platform, propertyType: input.propertyType, topic: input.topic, asOf: input.asOf, use: "public" });
  if (!snapshot.ok || (snapshot.value.target as { level?: unknown } | null)?.level !== "city") return refusal("invalid_request", ["invalid_request"], excludedBlocks);
  const context = snapshot.value as unknown as ClaimContext;

  const selection = selectFactualClaims(input.registry, context);
  if (selection.report.overall === "invalid_request") return refusal("invalid_request", ["invalid_request"], excludedBlocks);
  const completeness = evaluateCompleteness(selection);
  const notRenderable = selection.uncovered.filter((u) => u.cause === "not_renderable").length;

  // sections: rendered facts first-class; fixed blocks only around them
  const sections: { order: number; section: PageSection }[] = [];
  selection.selected.forEach((item, index) => {
    sections.push({ order: 1 + index / 1000, section: { sectionId: item.claim.sectionId, heading: item.heading, claims: [item.claim, ...item.extraClaims.map((extra) => extra.claim)] as unknown as PageSection["claims"] } });
  });
  const hasFacts = selection.selected.length > 0;
  const blocks = hasFacts ? input.catalog.blocksFor(context.topic, "en", context.asOf) : [];
  for (const kind of Object.keys(BLOCK_SECTIONS) as BlockKind[]) {
    const ofKind = blocks.filter((block) => block.kind === kind);
    if (ofKind.length === 0) continue;
    const spec = BLOCK_SECTIONS[kind];
    sections.push({ order: spec.order, section: { sectionId: spec.sectionId, heading: spec.heading, claims: ofKind.map((block) => blockClaim(block) as unknown as PageSection["claims"][number]) } });
  }
  sections.sort((a, b) => a.order - b.order);

  const usedFactIds = [...new Set(selection.selected.flatMap((item) => [item.claim, ...item.extraClaims.map((extra) => extra.claim)].flatMap((claim) => [...claim.supportingFactIds, ...claim.figures.map((figure) => figure.factId)])))].sort() as FactId[];
  const missingFacts = selection.report.missing;
  const eligibilityReasons: [EditorialDecisionReason, ...EditorialDecisionReason[]] = completeness.requiredUncovered.length > 0 ? ["required_fact_missing"] : ["human_editorial_decision"];
  // S4 never states publishable_standalone: whether a page deserves to exist is a human decision
  const eligibility: EditorialDecision = { eligibility: "needs_data", reasons: eligibilityReasons, decidedBy: { kind: "rule", ruleVersion: ASSEMBLER_RULE_VERSION }, asOf: context.asOf as EditorialDecision["asOf"] };
  const finalSections = sections.map((entry) => entry.section);
  const page: GeneratedPage = {
    citySlug: (context.target as { citySlug: string }).citySlug,
    topic: context.topic,
    pathname: `/airbnb-optimizer/${(context.target as { citySlug: string }).citySlug}/${context.topic}`,
    sections: finalSections,
    usedFactIds,
    missingFacts,
    eligibility,
    generator: { contractVersion: GENERATOR_V3_CONTRACT_VERSION, topicRequirementsVersion: TOPIC_REQUIREMENTS_VERSION },
    traceability: {
      registrySnapshotId: sha256Hex(stableStringify([...input.registry.list()].sort((x, y) => (x.factId < y.factId ? -1 : 1)))),
      inputsFingerprint: sha256Hex(stableStringify({ context, facts: usedFactIds.map((id) => [id, input.registry.get(id)?.version ?? null]), requirements: TOPIC_REQUIREMENTS_VERSION, catalog: input.catalog.catalogId, contract: GENERATOR_V3_CONTRACT_VERSION })),
      inputFacts: usedFactIds.map((id) => ({ factId: id, version: input.registry.get(id)?.version ?? 0 })),
      contentHash: sha256Hex(stableStringify(finalSections)),
      rollbackTarget: "v2_current_renderer",
    },
  };

  // the page that is validated is the page that is returned: a frozen deep copy no caller can alter afterwards
  const frozenPage = deepFreeze(structuredClone(page));
  const validation = validateGeneratedPage(frozenPage, context, input.registry);

  // integrity: the page carries exactly what the renderer and the catalogue produced
  const integrityOk =
    selection.selected.every((item) => {
      const again = renderFactualClaim([{ fact: item.fact, ...(item.statistic === null ? {} : { statistic: item.statistic }) }]);
      const mainOk = again.ok && again.value.text === item.claim.text && stableStringify(again.value.figures) === stableStringify(item.claim.figures);
      // each quartile claim must be exactly what the renderer produces for that statistic of the same fact
      const extrasOk = item.extraClaims.every((extra) => {
        const quartile = renderFactualClaim([{ fact: item.fact, statistic: extra.statistic }]);
        return quartile.ok && quartile.value.text === extra.claim.text && stableStringify(quartile.value.figures) === stableStringify(extra.claim.figures);
      });
      return mainOk && extrasOk;
    }) &&
    blocks.every((block) => finalSections.some((section) => section.claims.some((claim) => claim.text === block.text && sha256Hex(claim.text) === block.textHash)));

  const decision = decideAssembly({
    topicOverall: selection.report.overall,
    requiredUncovered: completeness.requiredUncovered.length,
    notRenderable,
    factualClaimCount: selection.selected.length,
    pageVerdict: validation.verdict,
    integrityOk,
  });
  const ready = decision.status === "ready_for_editorial_review";
  return deepFreeze({
    status: decision.status,
    reasons: decision.reasons,
    page: ready ? frozenPage : null,
    language: "en",
    topicOverall: selection.report.overall,
    completeness,
    validation,
    differentiation: ready ? diagnosePage(frozenPage, input.registry, completeness) : null,
    excludedBlocks,
    publicationAuthorised: false,
    indexingAuthorised: false,
  });
}

export type PageVerification = Readonly<{ ok: boolean; reasons: readonly ("malformed_page" | "content_hash_mismatch" | "eligibility_overstated" | "page_validation_not_accepted" | "block_not_in_catalog")[] }>;

/**
 * Re-checks a page that is about to be used, wherever it comes from (it may have travelled through JSON, a cache
 * or another module): the content hash must be that of its sections, its eligibility must not claim publication,
 * the S3 page validator must still accept it against the registry, and every non-factual claim must still be a block
 * of the (genuine) catalogue, word for word. Total; never throws.
 */
export function verifyAssembledPage(page: unknown, context: ClaimContext, registry: FactRegistry, catalog: EditorialCatalog): PageVerification {
  const reasons: PageVerification["reasons"][number][] = [];
  try {
    const snapshot = snapshotUntrustedFact(page);
    if (!snapshot.ok || !Array.isArray(snapshot.value.sections)) return Object.freeze({ ok: false, reasons: Object.freeze(["malformed_page"] as const) });
    const trace = snapshot.value.traceability as { contentHash?: unknown } | null | undefined;
    if (typeof trace !== "object" || trace === null || trace.contentHash !== sha256Hex(stableStringify(snapshot.value.sections))) reasons.push("content_hash_mismatch");
    const eligibility = snapshot.value.eligibility as { eligibility?: unknown } | null | undefined;
    if (typeof eligibility !== "object" || eligibility === null || eligibility.eligibility === "publishable_standalone") reasons.push("eligibility_overstated");
    if (validateGeneratedPage(snapshot.value, context, registry).verdict !== "accepted") reasons.push("page_validation_not_accepted");
    if (!isEditorialCatalog(catalog)) return Object.freeze({ ok: false, reasons: Object.freeze(["malformed_page"] as const) });
    const approved = catalog.blocksFor(context.topic, "en", context.asOf);
    for (const section of snapshot.value.sections as { claims?: unknown }[]) {
      for (const claim of Array.isArray(section?.claims) ? (section.claims as { kind?: unknown; claimId?: unknown; text?: unknown }[]) : []) {
        if (claim?.kind === "factual") continue;
        if (!approved.some((block) => claim.claimId === `claim:blk:${block.blockId.slice("block:".length)}` && claim.text === block.text)) reasons.push("block_not_in_catalog");
      }
    }
  } catch {
    return Object.freeze({ ok: false, reasons: Object.freeze(["malformed_page"] as const) });
  }
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}
