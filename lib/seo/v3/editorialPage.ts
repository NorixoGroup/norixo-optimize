/**
 * SEO generator V3 — editorial page structure, depth gate and cross-page comparison (S5.4-B). Pure and offline:
 * no clock, no network, no model, no file system.
 *
 * It sits ABOVE the S4 assembler and changes none of the S2/S3/S4/S5 contracts. The S4 page (already validated by S3)
 * is the only source of claims. This module only
 *   1. places those claims into the ordered slots of a per-topic blueprint (introduction, topic analysis, local facts,
 *      interpretation, conditional recommendations, limits, sources, conclusion);
 *   2. derives "limits" and "sources" mechanically from the facts (data, never prose);
 *   3. refuses a page that is technically valid but too thin or not distinct enough.
 *
 * Nothing here writes a sentence. A claim is either a rendered validated fact or a catalogue block that a person
 * approved; headings of block and derived slots are fixed structural labels. A block is placed in a slot by its id
 * (`block:<topic>:<slotId>:<n>`), so the S4 block contract is untouched. A recommendation is conditional because its
 * slot lists the requirements whose facts must be on the page (`whenCovered`): it never appears without them.
 *
 * S5.4-D hardening: nothing is "production" by default. A page is in FIXTURE mode unless the caller proves, with a verified
 * strict import report, that the registry it was built from is the registry that import produced; the proof is checked
 * (report intact, strict, snapshot id equal, every used fact accepted with its evidence) and a name or a label can never
 * change the mode. Approvals are three different things: a declaration (a record exists), a listed identity (a human role
 * from the caller's allow-list) and a verifiable proof (a verifier supplied by the caller returned true). This repository
 * has no verifier, so no block, plan or policy reaches "proof_verified" and no page reaches "ready" on its own. A slot with
 * two candidate blocks is refused, never resolved by choosing one.
 *
 * Thresholds in `depth` are PROVISIONAL (pending a human decision), per topic, and are compared as plain counts. They are
 * not a universal word or similarity limit. Whatever the verdict, `publicationAuthorised`, `indexingAuthorised` and
 * `publishable` are false: the best status is "ready_for_human_editorial_review".
 */
import { fold } from "./claimText";
import type { EditorialCatalog, BlockKind } from "./editorialCatalog";
import { isEditorialCatalog, sha256Hex, stableStringify } from "./editorialCatalog";
import { registrySnapshotIdOf, verifyImportReport } from "./factStore";
import { isHumanActor } from "./sourceRegistry";
import type { FactRegistry } from "./factRegistry";
import { factMatchesRequirement } from "./factUse";
import type { GeneratedClaim } from "./generatedClaim";
import type { GeneratedPage } from "./generatedPage";
import type { LocalFact } from "./localFact";
import { assembleGeneratedPage, type AssembleInput, type AssemblyResult } from "./pageAssembler";
import { comparePages } from "./pageDiagnostics";
import { isPageScope, LOCAL_SCOPE_MIN_DISTINCT_FACTS, type PageScope } from "./pageScope";
import { TOPIC_REQUIREMENTS } from "./topicRequirements";
import type { LocalSeoTopicSlug } from "./topics";

type AssemblyStatus = AssemblyResult["status"];

export const EDITORIAL_PAGE_VERSION = "seo-v3-editorial-page/1";

export type SectionRole =
  | "introduction"
  | "topic_analysis"
  | "local_facts"
  | "interpretation"
  | "practical_recommendations"
  | "data_limits"
  | "sources"
  | "conclusion";

type SlotBase = Readonly<{
  slotId: string;
  role: SectionRole;
  required: boolean;
  /** The useful question this slot answers, for reviewers. Never rendered. */
  question: string;
}>;

export type FactSlot = SlotBase & Readonly<{ source: Readonly<{ kind: "facts"; requirementId: string }> }>;
export type BlockSlot = SlotBase & Readonly<{ heading: string; source: Readonly<{ kind: "blocks"; blockKind: BlockKind; whenCovered: readonly string[] }> }>;
export type DerivedSlot = SlotBase & Readonly<{ heading: string; source: Readonly<{ kind: "derived"; of: "limits" | "sources" }> }>;
export type BlueprintSlot = FactSlot | BlockSlot | DerivedSlot;

export type DepthRules = Readonly<{
  /** Provisional counts for this topic, to be decided by a person. Facts, not claims: one price fact states several claims. */
  minDistinctFacts: number;
  minDistinctFactCategories: number;
  /** A qualitative, regulatory or geographic fact must be present: numbers alone do not make a local page. */
  requiresContextFact: boolean;
  /** Minimum number of qualitative, regulatory or geographic facts. Defaults to 1 when requiresContextFact is true, else 0. */
  minContextFacts?: number;
  /** Slots whose facts must differ between two topics of the same city. */
  distinctiveSlotIds: readonly string[];
  thresholdBasis: "provisional_pending_human_decision";
}>;

export type PlanStatus = "draft" | "pending_human_approval" | "approved";

/** A declaration of approval of a plan; it counts only with the matching hash AND a verifier that confirms it. */
export type PlanApprovalClaim = Readonly<{ approvedBy: string; approvedAt: string; planHash: string }>;

export type PageBlueprint = Readonly<{
  topic: LocalSeoTopicSlug;
  searchIntent: string;
  /** Absent = legacy behaviour. "local" adds a minimum of distinct facts; "global" is refused on a city page (see globalPage.ts). */
  scope?: PageScope;
  reviewStatus: PlanStatus;
  /** Only meaningful when reviewStatus is "approved". */
  approval?: PlanApprovalClaim | null;
  slots: readonly BlueprintSlot[];
  depth: DepthRules;
}>;

/** Hash of everything that defines a plan: an edit after an approval changes it. */
export function planHashOf(blueprint: PageBlueprint): string {
  // scope joins the hash only when declared, so the hash of a plan without a scope is unchanged
  return sha256Hex(stableStringify({ topic: blueprint.topic, searchIntent: blueprint.searchIntent, slots: blueprint.slots, depth: blueprint.depth, ...(blueprint.scope === undefined ? {} : { scope: blueprint.scope }) }));
}

// --- approvals: declared, listed identity, verifiable proof ----------------------------------------------------

export type ApprovalLevel = "none" | "declared" | "identity_listed" | "proof_verified";

export type ApprovalSubject = Readonly<{
  kind: "block" | "plan" | "repetition_policy";
  id: string;
  /** Hash of the exact thing approved (block text, plan, policy). */
  subjectHash: string;
  approvedBy: string;
  approvedAt: string;
}>;

/** Supplied by the caller; must return exactly `true`. No verifier exists in this repository. */
export type ApprovalVerifier = (subject: ApprovalSubject) => boolean;

export type ApprovalConfig = Readonly<{ allowedActors: readonly string[]; verifier?: ApprovalVerifier }>;

/** Level of one approval claim. `approvedBy` is never taken as proof of identity. */
export function approvalLevelOf(subject: ApprovalSubject | null, config: ApprovalConfig | undefined): ApprovalLevel {
  if (subject === null || typeof subject.approvedBy !== "string" || subject.approvedBy.trim() === "" || typeof subject.approvedAt !== "string" || subject.approvedAt === "") return "none";
  if (config === undefined || !isHumanActor(subject.approvedBy) || !config.allowedActors.includes(subject.approvedBy)) return "declared";
  let proven = false;
  try {
    proven = config.verifier?.(subject) === true;
  } catch {
    proven = false;
  }
  return proven ? "proof_verified" : "identity_listed";
}

// --- provenance of the facts (what separates production from a fixture) -----------------------------------------

/** The strict import report the registry was built from. Without it the page is in fixture mode. */
export type ProductionProvenance = Readonly<{ importReport: unknown }>;

/** Why the claimed provenance does not hold (empty = it holds). A forged report with a recomputed hash still passes: no authentication. */
export function provenanceProblems(registry: FactRegistry, provenance: ProductionProvenance, usedFactIds: readonly string[]): readonly string[] {
  const report = provenance.importReport;
  if (!verifyImportReport(report)) return ["report_not_intact"];
  const problems: string[] = [];
  if (report.strict !== true) problems.push("import_not_strict");
  if (report.baselineStatus !== "provided" && report.baselineStatus !== "absent_first_import") problems.push("baseline_not_acceptable");
  if (report.fileIssues.length > 0 || report.decisionIssues.length > 0) problems.push("import_has_issues");
  if (report.registrySnapshotId !== registrySnapshotIdOf(registry)) problems.push("registry_snapshot_mismatch");
  const accepted = new Map(report.accepted.map((fact) => [fact.factId as string, fact]));
  for (const id of usedFactIds) {
    const entry = accepted.get(id);
    if (entry === undefined) problems.push(`fact_not_in_report:${id}`);
    else if (entry.evidence === "unverified") problems.push(`fact_evidence_unverified:${id}`);
  }
  return problems;
}

export type Blueprints = Readonly<Partial<Record<LocalSeoTopicSlug, PageBlueprint>>>;

const factSlot = (slotId: string, requirementId: string, required: boolean, question: string): BlueprintSlot => ({
  slotId, role: "local_facts", required, question, source: { kind: "facts", requirementId },
});
const blockSlot = (slotId: string, role: SectionRole, heading: string, blockKind: BlockKind, required: boolean, whenCovered: readonly string[], question: string): BlueprintSlot => ({
  slotId, role, heading, required, question, source: { kind: "blocks", blockKind, whenCovered },
});
const derivedSlot = (slotId: string, role: "data_limits" | "sources", heading: string, of: "limits" | "sources", question: string): BlueprintSlot => ({
  slotId, role, heading, required: true, question, source: { kind: "derived", of },
});

/**
 * DRAFT blueprints for the two topics used to demonstrate the engine. They describe structure only; they are not approved
 * by anyone and no other topic has one (such a page is refused with `no_blueprint`).
 */
export const DRAFT_BLUEPRINTS: Blueprints = Object.freeze({
  "pricing-guide": {
    topic: "pricing-guide",
    searchIntent: "decide_a_nightly_rate_with_local_evidence",
    reviewStatus: "draft",
    slots: [
      blockSlot("introduction", "introduction", "Introduction", "editorial_non_factual", true, [], "What is this page for?"),
      factSlot("prices", "nightly_price_distribution", true, "What nightly prices were observed here?"),
      factSlot("demand", "demand_driver", false, "What local demand context applies?"),
      blockSlot("method", "topic_analysis", "How to read the prices", "methodological_advice", false, ["nightly_price_distribution"], "How should these prices be read?"),
      blockSlot("recommend", "practical_recommendations", "What to check next", "methodological_advice", false, ["demand_driver"], "What should a host check given the local context?"),
      blockSlot("hypothesis", "interpretation", "Open questions", "explicit_hypothesis", false, ["demand_driver", "nightly_price_distribution"], "What might explain the observed prices?"),
      derivedSlot("limits", "data_limits", "Limits of the data", "limits", "How reliable and how recent are the facts?"),
      derivedSlot("sources", "sources", "Sources", "sources", "Where do the facts come from?"),
      blockSlot("conclusion", "conclusion", "In short", "editorial_non_factual", true, [], "What is the takeaway?"),
    ],
    depth: { minDistinctFacts: 2, minDistinctFactCategories: 2, requiresContextFact: true, distinctiveSlotIds: ["demand"], thresholdBasis: "provisional_pending_human_decision" },
  },
  "market-analysis": {
    topic: "market-analysis",
    searchIntent: "understand_the_local_market_before_listing",
    reviewStatus: "draft",
    slots: [
      blockSlot("introduction", "introduction", "Introduction", "editorial_non_factual", true, [], "What is this page for?"),
      factSlot("prices", "nightly_price_distribution", true, "What nightly prices were observed here?"),
      factSlot("calendar", "calendar_unavailability_rate", false, "How much of the calendar is unavailable?"),
      blockSlot("method", "topic_analysis", "How to read the market data", "methodological_advice", false, ["calendar_unavailability_rate"], "How should unavailability be read?"),
      blockSlot("hypothesis", "interpretation", "Open questions", "explicit_hypothesis", false, ["calendar_unavailability_rate"], "What might explain the calendar?"),
      derivedSlot("limits", "data_limits", "Limits of the data", "limits", "How reliable and how recent are the facts?"),
      derivedSlot("sources", "sources", "Sources", "sources", "Where do the facts come from?"),
      blockSlot("conclusion", "conclusion", "In short", "editorial_non_factual", true, [], "What is the takeaway?"),
    ],
    depth: { minDistinctFacts: 2, minDistinctFactCategories: 2, requiresContextFact: false, distinctiveSlotIds: ["calendar"], thresholdBasis: "provisional_pending_human_decision" },
  },
} satisfies Blueprints);

/**
 * DRAFT enriched plan for pricing-guide (S5.4-F): the S5.4-E plan plus an optional "area" slot. It needs the requirement
 * `neighbourhood_context` in the topic's optional requirements, which the real table does NOT have for pricing-guide: with
 * the real table the slot is reported in `metrics.slotsWithoutRequirement` and the stricter depth rules refuse the page. Adding
 * the requirement is a change of the S5 table that needs its own authorisation. Draft, not approved by anyone.
 */
export const DRAFT_PRICING_GUIDE_ENRICHED: PageBlueprint = Object.freeze({
  ...DRAFT_BLUEPRINTS["pricing-guide"]!,
  searchIntent: "decide_a_nightly_rate_with_local_evidence",
  reviewStatus: "draft",
  slots: Object.freeze([
    ...DRAFT_BLUEPRINTS["pricing-guide"]!.slots.slice(0, 2),
    factSlot("demand", "demand_driver", false, "What local demand context applies?"),
    factSlot("area", "neighbourhood_context", false, "Which parts of the area do stays concentrate in?"),
    ...DRAFT_BLUEPRINTS["pricing-guide"]!.slots.slice(3),
  ]),
  depth: { minDistinctFacts: 3, minDistinctFactCategories: 3, requiresContextFact: true, minContextFacts: 2, distinctiveSlotIds: ["demand", "area"], thresholdBasis: "provisional_pending_human_decision" },
} as PageBlueprint);

// --- output ------------------------------------------------------------------------------------------------

export type LimitRow = Readonly<{
  factId: string;
  factVersion: number;
  confidence: string;
  sampleSize: number | null;
  observedPeriod: Readonly<{ start: string; end: string }> | null;
  collectedAt: string;
  validUntil: string;
}>;
export type SourceRow = Readonly<{
  factId: string;
  publisher: string;
  sourceType: string;
  title: string | null;
  publishedAt: string | null;
  consultedAt: string;
}>;

export type EditorialSection = Readonly<{
  slotId: string;
  role: SectionRole;
  heading: string;
  origin: "validated_facts" | "approved_blocks" | "derived_from_facts";
  question: string;
  claims: readonly GeneratedClaim[];
  limits?: readonly LimitRow[];
  sources?: readonly SourceRow[];
}>;

export type DepthFailure = "too_few_distinct_facts" | "too_few_fact_categories" | "context_fact_missing" | "too_few_context_facts" | "fact_not_relevant_to_topic" | "duplicate_fact_statement";

export type DepthMetrics = Readonly<{
  factualClaims: number;
  /** Distinct facts placed; the depth rule counts these, so that several claims of one fact do not inflate it. */
  distinctFacts: number;
  blockClaims: number;
  distinctFactCategories: readonly string[];
  contextFacts: number;
  /** Characters of factual claims over characters of all claims (0..1, 4 decimals). Descriptive. */
  factualCharShare: number | null;
  answeredSlots: readonly string[];
  unansweredSlots: readonly string[];
  /** Fact slots whose requirement the topic does not have: they can never be answered (a plan/table mismatch, not a missing fact). */
  slotsWithoutRequirement: readonly string[];
  /** Slots with more than one candidate block: refused, never resolved by picking one. */
  ambiguousSlots: readonly string[];
  /** Claims of the S4 page that no slot placed (they are not on the editorial page). */
  unplacedClaimIds: readonly string[];
}>;

export type EditorialStatus = "fixture_demo_only" | "pending_human_approval" | "ready_for_human_editorial_review" | "refused";
export type EditorialMode = "fixture" | "production";

export type EditorialPage = Readonly<{
  version: typeof EDITORIAL_PAGE_VERSION;
  /**
   * fixture_demo_only: structure fine, but the data is not proven to be production data (the default).
   * pending_human_approval: proven data, but a block, the plan or the draft status lacks a verifiable approval.
   * ready_for_human_editorial_review: everything proven; a person still decides, nothing is publishable.
   */
  status: EditorialStatus;
  reasons: readonly string[];
  mode: EditorialMode;
  blueprintStatus: PlanStatus | null;
  approvals: Readonly<{ plan: ApprovalLevel; blocks: Readonly<Record<string, ApprovalLevel>> }>;
  /** Facts that were actually placed on the page (the base page may hold more). */
  placedFactIds: readonly string[];
  citySlug: string | null;
  topic: LocalSeoTopicSlug | null;
  searchIntent: string | null;
  sections: readonly EditorialSection[];
  /** The validated S4 page this one was built from; its contentHash binds the two. */
  base: GeneratedPage | null;
  baseStatus: AssemblyStatus | null;
  metrics: DepthMetrics | null;
  /** Facts used in the distinctive slots, for the comparison with other topics of the same city. */
  distinctiveFactIds: readonly string[];
  /** True unless production provenance was proven. Names and labels never change it. */
  fixtureOnly: boolean;
  /** Always false: a person decides, and nothing here is approved. */
  publishable: false;
  publicationAuthorised: false;
  indexingAuthorised: false;
}>;

export type EditorialInput = AssembleInput &
  Readonly<{
    blueprints?: Blueprints;
    /** Absent = fixture mode. */
    provenance?: ProductionProvenance;
    approvals?: ApprovalConfig;
  }>;

const deepFreeze = <T,>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
};

const categoryOf = (fact: LocalFact): string => {
  const value = fact.value as Record<string, unknown>;
  const detail = fact.kind === "quantitative" ? value.metric : fact.kind === "qualitative" ? value.category : fact.kind === "regulatory" ? value.ruleType : value.attribute;
  return `${fact.kind}:${String(detail)}`;
};

const refusal = (reasons: readonly string[], extra: Partial<EditorialPage> = {}): EditorialPage =>
  deepFreeze({
    version: EDITORIAL_PAGE_VERSION, status: "refused", reasons: [...new Set(reasons)].sort(), mode: "fixture", blueprintStatus: null, approvals: { plan: "none", blocks: {} }, placedFactIds: [], citySlug: null, topic: null, searchIntent: null, sections: [], base: null,
    baseStatus: null, metrics: null, distinctiveFactIds: [], fixtureOnly: false, publishable: false, publicationAuthorised: false, indexingAuthorised: false, ...extra,
  });

/** Tripwire only (defence in depth): a "test only" label inside a production-claimed page is refused. It never grants anything. */
const isFixtureText = (text: unknown): boolean => typeof text === "string" && /test only/i.test(text);

/** Builds the editorial page of one city and topic. Total: the answer is always an EditorialPage. */
export function assembleEditorialPage(input: EditorialInput): EditorialPage {
  try {
    if (typeof input !== "object" || input === null || !isEditorialCatalog(input.catalog)) return refusal(["invalid_request"]);
    const base = assembleGeneratedPage(input);
    if (base.status !== "ready_for_editorial_review" || base.page === null) return refusal(["assembly_not_ready", ...base.reasons.map((r) => `assembly:${r}`)], { baseStatus: base.status });
    const page = base.page;
    const blueprint = (input.blueprints ?? DRAFT_BLUEPRINTS)[page.topic];
    if (blueprint === undefined) return refusal(["no_blueprint"], { citySlug: page.citySlug, topic: page.topic, base: page, baseStatus: base.status });
    return place(input, input.catalog, page, base.status, blueprint);
  } catch {
    return refusal(["invalid_request"]);
  }
}

function place(input: EditorialInput, catalog: EditorialCatalog, page: GeneratedPage, baseStatus: AssemblyStatus, blueprint: PageBlueprint): EditorialPage {
  const registry = input.registry;
  const spec = TOPIC_REQUIREMENTS[page.topic];
  const requirements = [...spec.required, ...spec.optional];
  const claims = page.sections.flatMap((section) => section.claims);
  const factualClaims = claims.filter((claim) => claim.kind === "factual");
  const placed = new Set<string>();

  // which requirement each factual claim answers (S2's own matching rule, not a text guess)
  const claimFact = new Map<string, LocalFact>();
  const covered = new Map<string, GeneratedClaim>();
  for (const claim of factualClaims) {
    const fact = registry.get(claim.supportingFactIds![0]!);
    if (fact === undefined) continue;
    claimFact.set(claim.claimId, fact);
    for (const requirement of requirements) if (factMatchesRequirement(fact, requirement) && !covered.has(requirement.requirementId)) covered.set(requirement.requirementId, claim);
  }

  const slotsWithoutRequirement = blueprint.slots
    .filter((slot) => slot.source.kind === "facts" && !requirements.some((r) => r.requirementId === (slot as FactSlot).source.requirementId))
    .map((slot) => slot.slotId);
  const sections: EditorialSection[] = [];
  const answered: string[] = [];
  const unanswered: string[] = [];
  const ambiguous: string[] = [];
  const reasons: string[] = [];
  const distinctive = new Set<string>();
  const usedFacts = new Map<string, LocalFact>();

  for (const slot of blueprint.slots) {
    if (slot.source.kind === "facts") {
      const claim = covered.get(slot.source.requirementId);
      if (claim === undefined) {
        unanswered.push(slot.slotId);
        if (slot.required) reasons.push("required_slot_unanswered");
        continue;
      }
      const heading = page.sections.find((section) => section.claims.some((c) => c.claimId === claim.claimId))!.heading;
      const fact = claimFact.get(claim.claimId)!;
      // every claim the validated S4 page states about this fact (median and quartiles of a price) goes into the slot
      const ofFact = factualClaims.filter((c) => c.supportingFactIds![0] === fact.factId);
      for (const c of ofFact) placed.add(c.claimId);
      usedFacts.set(fact.factId, fact);
      if (blueprint.depth.distinctiveSlotIds.includes(slot.slotId)) distinctive.add(fact.factId);
      sections.push({ slotId: slot.slotId, role: slot.role, heading, origin: "validated_facts", question: slot.question, claims: ofFact });
      answered.push(slot.slotId);
    } else if (slot.source.kind === "blocks") {
      const blockSlotNow = slot as BlockSlot;
      const { blockKind, whenCovered } = blockSlotNow.source;
      const conditionsMet = whenCovered.every((id) => covered.has(id));
      const prefix = `claim:blk:${page.topic}:${slot.slotId}:`;
      const matching = conditionsMet ? claims.filter((claim) => claim.kind === blockKind && claim.claimId.startsWith(prefix)) : [];
      if (matching.length === 0) {
        unanswered.push(slot.slotId);
        // an unmet condition is not a defect; a missing approved block for a required slot is
        if (slot.required) reasons.push("required_slot_unanswered");
        continue;
      }
      if (matching.length > 1) {
        // two candidates for one slot: nothing is chosen on the caller's behalf
        ambiguous.push(slot.slotId);
        unanswered.push(slot.slotId);
        reasons.push("ambiguous_slot_variants");
        continue;
      }
      for (const claim of matching) placed.add(claim.claimId);
      sections.push({ slotId: slot.slotId, role: slot.role, heading: blockSlotNow.heading, origin: "approved_blocks", question: slot.question, claims: matching });
      answered.push(slot.slotId);
    }
  }
  // derived slots come last in the blueprint but are computed from the facts actually placed
  const used = [...usedFacts.values()].sort((a, b) => (a.factId < b.factId ? -1 : 1));
  const derivedAt = (slot: BlueprintSlot): number => blueprint.slots.indexOf(slot);
  for (const slot of blueprint.slots) {
    if (slot.source.kind !== "derived") continue;
    const derived = slot as DerivedSlot;
    const section: EditorialSection =
      derived.source.of === "limits"
        ? {
            slotId: slot.slotId, role: slot.role, heading: derived.heading, origin: "derived_from_facts", question: slot.question, claims: [],
            limits: used.map((fact) => ({
              factId: fact.factId, factVersion: fact.version, confidence: fact.confidence.level,
              sampleSize: typeof (fact.value as Record<string, unknown>).sampleSize === "number" ? ((fact.value as Record<string, unknown>).sampleSize as number) : null,
              observedPeriod: fact.observedPeriod === null ? null : { start: fact.observedPeriod.start, end: fact.observedPeriod.end },
              collectedAt: fact.collectedAt, validUntil: fact.validUntil,
            })),
          }
        : {
            slotId: slot.slotId, role: slot.role, heading: derived.heading, origin: "derived_from_facts", question: slot.question, claims: [],
            sources: used.map((fact) => ({ factId: fact.factId, publisher: fact.source.publisher, sourceType: fact.source.sourceType, title: fact.source.title, publishedAt: fact.source.publishedAt, consultedAt: fact.source.consultedAt })),
          };
    if (used.length === 0) { unanswered.push(slot.slotId); reasons.push("required_slot_unanswered"); continue; }
    sections.push(section);
    answered.push(slot.slotId);
  }
  // blueprint order is the page order
  const order = (section: EditorialSection) => derivedAt(blueprint.slots.find((s) => s.slotId === section.slotId)!);
  sections.sort((a, b) => order(a) - order(b));

  // --- depth ----------------------------------------------------------------------------------------------------
  const placedFacts = used.length;
  const categories = [...new Set(used.map(categoryOf))].sort();
  const contextFacts = used.filter((fact) => fact.kind !== "quantitative").length;
  const textClaims = sections.flatMap((section) => section.claims);
  const totalChars = textClaims.reduce((sum, claim) => sum + claim.text.length, 0);
  const factChars = textClaims.filter((claim) => claim.kind === "factual").reduce((sum, claim) => sum + claim.text.length, 0);
  const depth = blueprint.depth;
  if (placedFacts < depth.minDistinctFacts) reasons.push("too_few_distinct_facts");
  if (categories.length < depth.minDistinctFactCategories) reasons.push("too_few_fact_categories");
  const neededContext = depth.minContextFacts ?? (depth.requiresContextFact ? 1 : 0);
  if (neededContext > 0 && contextFacts === 0) reasons.push("context_fact_missing");
  else if (contextFacts < neededContext) reasons.push("too_few_context_facts");
  // a fact is placed only for a topic it is declared relevant to, and two placed notes never say the same thing
  if (used.some((fact) => !(fact.relevantTopics as readonly string[]).includes(page.topic))) reasons.push("fact_not_relevant_to_topic");
  if (blueprint.scope !== undefined) {
    if (!isPageScope(blueprint.scope)) reasons.push("invalid_scope");
    else if (blueprint.scope === "global") reasons.push("global_blueprint_on_city_page");
    else if (placedFacts < LOCAL_SCOPE_MIN_DISTINCT_FACTS) reasons.push("local_scope_below_minimum_facts");
  }
  const statements = used.filter((fact) => fact.kind === "qualitative").map((fact) => String((fact.value as { statement?: unknown }).statement ?? "").trim().toLowerCase());
  if (new Set(statements).size !== statements.length) reasons.push("duplicate_fact_statement");

  const metrics: DepthMetrics = {
    factualClaims: sections.flatMap((section) => (section.origin === "validated_facts" ? section.claims : [])).length,
    distinctFacts: placedFacts,
    blockClaims: textClaims.filter((claim) => claim.kind !== "factual").length,
    distinctFactCategories: categories,
    contextFacts,
    factualCharShare: totalChars === 0 ? null : Math.round((factChars / totalChars) * 10000) / 10000,
    answeredSlots: answered,
    unansweredSlots: unanswered,
    slotsWithoutRequirement,
    ambiguousSlots: ambiguous,
    unplacedClaimIds: claims.filter((claim) => !placed.has(claim.claimId)).map((claim) => claim.claimId).sort(),
  };
  // --- mode, plan status and approvals ---------------------------------------------------------------------------
  const placedBlockIds = catalog.blocks.filter((block) => placed.has(`claim:blk:${block.blockId.slice("block:".length)}`));
  const config = input.approvals;
  const blockLevels: Record<string, ApprovalLevel> = {};
  for (const block of placedBlockIds) {
    blockLevels[block.blockId] = approvalLevelOf({ kind: "block", id: block.blockId, subjectHash: block.textHash, approvedBy: block.approvedBy, approvedAt: block.approvedAt }, config);
  }
  const planHash = planHashOf(blueprint);
  let planLevel: ApprovalLevel = "none";
  if (blueprint.reviewStatus === "approved") {
    const claim = blueprint.approval ?? null;
    if (claim === null) reasons.push("plan_approval_missing");
    else if (claim.planHash !== planHash) reasons.push("plan_hash_mismatch");
    else planLevel = approvalLevelOf({ kind: "plan", id: blueprint.topic, subjectHash: planHash, approvedBy: claim.approvedBy, approvedAt: claim.approvedAt }, config);
  }
  const production = input.provenance !== undefined;
  const pending: string[] = [];
  if (production) {
    for (const problem of provenanceProblems(registry, input.provenance!, used.map((fact) => fact.factId))) reasons.push(`provenance:${problem}`);
    if (used.some((fact) => isFixtureText(fact.source.publisher)) || placedBlockIds.some((block) => isFixtureText(block.approvedBy))) reasons.push("fixture_marker_in_production");
    if (blueprint.reviewStatus === "draft") reasons.push("blueprint_draft");
    else if (planLevel !== "proof_verified") pending.push("plan_approval_not_verified");
    for (const [blockId, level] of Object.entries(blockLevels)) if (level !== "proof_verified") pending.push(`block_approval_not_verified:${blockId}`);
  }
  const refused = reasons.length > 0;
  const status: EditorialStatus = refused ? "refused" : !production ? "fixture_demo_only" : pending.length > 0 ? "pending_human_approval" : "ready_for_human_editorial_review";
  const allReasons = refused ? reasons : !production ? ["fixture_mode"] : pending;
  return deepFreeze({
    version: EDITORIAL_PAGE_VERSION,
    status,
    reasons: [...new Set(allReasons)].sort(),
    mode: production && !refused ? "production" : "fixture",
    blueprintStatus: blueprint.reviewStatus,
    approvals: { plan: planLevel, blocks: Object.fromEntries(Object.entries(blockLevels).sort(([x], [y]) => (x < y ? -1 : 1))) },
    placedFactIds: used.map((fact) => fact.factId),
    citySlug: page.citySlug, topic: page.topic, searchIntent: blueprint.searchIntent, sections, base: page, baseStatus,
    metrics, distinctiveFactIds: [...distinctive].sort(), fixtureOnly: !(production && !refused), publishable: false, publicationAuthorised: false, indexingAuthorised: false,
  } as EditorialPage);
}

// --- comparison --------------------------------------------------------------------------------------------

export type ComparisonCode =
  /** Same city, two topics, same facts on the page: one page twice. */
  | "identical_fact_set"
  /** Same city, two topics, no fact of the distinctive slots that the other page lacks. */
  | "topic_not_distinct"
  /** Same topic, two cities, identical once city and numbers are masked: only names and amounts differ. */
  | "numeric_only_difference";

export type EditorialPair = Readonly<{
  a: string;
  b: string;
  relation: "same_city_other_topic" | "same_topic_other_city" | "other";
  codes: readonly ComparisonCode[];
  /** Fact ids on both pages (shared evidence is allowed; it only matters when nothing else differs). */
  sharedFactIds: readonly string[];
  templateSimilarity: number;
}>;

export type EditorialComparison = Readonly<{
  pairs: readonly EditorialPair[];
  /** Keys with at least one finding. Both members of a flagged pair are listed. */
  flagged: readonly Readonly<{ key: string; codes: readonly ComparisonCode[] }>[];
}>;

/** Pairwise comparison of pages that were structurally accepted (any status but refused), on the facts actually placed. Order-independent and deterministic; refused pages are ignored. */
export function compareEditorialPages(items: readonly { key: string; page: EditorialPage }[]): EditorialComparison {
  const usable = items.filter((item) => item.page.status !== "refused" && item.page.base !== null).sort((a, b) => (a.key < b.key ? -1 : 1));
  const repetition = comparePages(usable.map((item) => ({ key: item.key, page: item.page.base! })));
  const similarity = new Map(repetition.pairs.map((pair) => [`${pair.a}\u0000${pair.b}`, pair.templateSimilarity]));
  const pairs: EditorialPair[] = [];
  const flags = new Map<string, Set<ComparisonCode>>();
  const flag = (key: string, code: ComparisonCode) => (flags.get(key) ?? flags.set(key, new Set()).get(key)!).add(code);
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const a = usable[i]!;
      const b = usable[j]!;
      const pa = a.page;
      const pb = b.page;
      const relation = pa.citySlug === pb.citySlug && pa.topic !== pb.topic ? "same_city_other_topic" : pa.topic === pb.topic && pa.citySlug !== pb.citySlug ? "same_topic_other_city" : "other";
      const factsA = new Set<string>(pa.placedFactIds);
      const factsB = new Set<string>(pb.placedFactIds);
      const shared = [...factsA].filter((id) => factsB.has(id)).sort();
      const template = similarity.get(`${a.key}\u0000${b.key}`) ?? 0;
      const codes: ComparisonCode[] = [];
      if (relation === "same_city_other_topic") {
        if (factsA.size === factsB.size && shared.length === factsA.size) codes.push("identical_fact_set");
        const ownA = pa.distinctiveFactIds.filter((id) => !factsB.has(id));
        const ownB = pb.distinctiveFactIds.filter((id) => !factsA.has(id));
        if (ownA.length === 0 || ownB.length === 0) codes.push("topic_not_distinct");
      }
      if (relation === "same_topic_other_city" && template === 1) codes.push("numeric_only_difference");
      for (const code of codes) { flag(a.key, code); flag(b.key, code); }
      pairs.push({ a: a.key, b: b.key, relation, codes, sharedFactIds: shared, templateSimilarity: template });
    }
  }
  return deepFreeze({
    pairs,
    flagged: [...flags.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([key, set]) => ({ key, codes: [...set].sort() as ComparisonCode[] })),
  });
}

// --- repetition between pages (descriptive) ---------------------------------------------------------------------

type PlacedClaim = Readonly<{ claimId: string; text: string; template: string; chars: number }>;

/** Text with the page's city, the place phrase of a fact, country codes and numbers masked: what is left is structure and wording. */
function templateOf(text: string, citySlug: string | null): string {
  let masked = text.replace(/\bIn [^(]{1,200}?, [A-Z]{2} \(/g, "In @ (").replace(/\b[A-Z]{2}\b/g, " @ ");
  if (citySlug !== null && citySlug !== "") masked = masked.split(new RegExp(citySlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join(" @ ");
  return (fold(masked).match(/[a-z0-9@]+/g) ?? []).map((word) => (/\d/.test(word) ? "#" : word)).join(" ");
}

function placedClaims(page: EditorialPage): PlacedClaim[] {
  return page.sections.flatMap((section) => section.claims).map((claim) => ({ claimId: claim.claimId, text: fold(claim.text).trim(), template: templateOf(claim.text, page.citySlug), chars: claim.text.length }));
}

export type RepetitionPageMeasure = Readonly<{
  key: string;
  topic: LocalSeoTopicSlug | null;
  family: string | null;
  placedClaims: number;
  /** Share of the page's claim characters whose masked wording also appears on another page of the set (0..1, 4 decimals). */
  sharedTemplateShare: number | null;
  /** 1 minus the shared share: wording found on no other page of the set. */
  specificShare: number | null;
  specificClaimIds: readonly string[];
  /** Placed facts that appear on no other page of the set. */
  factIdsOnlyHere: readonly string[];
}>;

export type RepetitionPairMeasure = Readonly<{
  a: string;
  b: string;
  /** Exactly the same sentence (compared without case). */
  identicalSentences: number;
  /** The same claim id on both pages (a block used twice). */
  commonClaimIds: number;
  /** The same wording once city, country code and numbers are masked. */
  identicalTemplateClaims: number;
  /** Placed facts present on one page and not on the other. */
  factDifferences: number;
}>;

/** Per family. PROVISIONAL proposals: nobody validated them and nothing applies them unless a verified policy says so. */
export const PROVISIONAL_REPETITION_THRESHOLDS = Object.freeze({
  basis: "provisional_pending_human_decision" as const,
  maxSharedTemplateShare: Object.freeze({ data_dependent: 0.6, local_qualitative: 0.6, universal: 0.85 }) as Readonly<Record<string, number>>,
});

export type RepetitionReport = Readonly<{
  pages: readonly RepetitionPageMeasure[];
  pairs: readonly RepetitionPairMeasure[];
  /** Pages above the provisional threshold of their family. Descriptive: nothing is refused by this list. */
  aboveProvisional: readonly Readonly<{ key: string; family: string; sharedTemplateShare: number; threshold: number }>[];
  thresholdsApplied: false;
  note: string;
}>;

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Descriptive repetition of the claims actually PLACED on structurally accepted pages (refused pages are ignored). Compare
 * pages of one topic together: the caller chooses the group. Deterministic and order-independent.
 */
export function measureRepetition(items: readonly { key: string; page: EditorialPage }[]): RepetitionReport {
  const usable = items.filter((item) => item.page.status !== "refused" && item.page.base !== null).sort((a, b) => (a.key < b.key ? -1 : 1));
  const claims = new Map(usable.map((item) => [item.key, placedClaims(item.page)]));
  const pages: RepetitionPageMeasure[] = [];
  const above: { key: string; family: string; sharedTemplateShare: number; threshold: number }[] = [];
  for (const item of usable) {
    const mine = claims.get(item.key)!;
    const others = usable.filter((o) => o.key !== item.key);
    const otherTemplates = new Set(others.flatMap((o) => claims.get(o.key)!.map((c) => c.template)));
    const otherFacts = new Set(others.flatMap((o) => o.page.placedFactIds));
    const total = mine.reduce((sum, c) => sum + c.chars, 0);
    const shared = mine.filter((c) => otherTemplates.has(c.template)).reduce((sum, c) => sum + c.chars, 0);
    const family = item.page.topic === null ? null : TOPIC_REQUIREMENTS[item.page.topic].family;
    const sharedShare = total === 0 || others.length === 0 ? null : round4(shared / total);
    pages.push({
      key: item.key, topic: item.page.topic, family, placedClaims: mine.length, sharedTemplateShare: sharedShare, specificShare: sharedShare === null ? null : round4(1 - sharedShare),
      specificClaimIds: mine.filter((c) => !otherTemplates.has(c.template)).map((c) => c.claimId).sort(), factIdsOnlyHere: item.page.placedFactIds.filter((id) => !otherFacts.has(id)).sort(),
    });
    const threshold = family === null ? undefined : PROVISIONAL_REPETITION_THRESHOLDS.maxSharedTemplateShare[family];
    if (sharedShare !== null && family !== null && threshold !== undefined && sharedShare > threshold) above.push({ key: item.key, family, sharedTemplateShare: sharedShare, threshold });
  }
  const pairs: RepetitionPairMeasure[] = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const a = usable[i]!;
      const b = usable[j]!;
      const ca = claims.get(a.key)!;
      const cb = claims.get(b.key)!;
      const textsB = new Set(cb.map((c) => c.text));
      const idsB = new Set(cb.map((c) => c.claimId));
      const tplB = new Set(cb.map((c) => c.template));
      const factsA = new Set(a.page.placedFactIds);
      const factsB = new Set(b.page.placedFactIds);
      pairs.push({
        a: a.key, b: b.key,
        identicalSentences: new Set(ca.filter((c) => textsB.has(c.text)).map((c) => c.text)).size,
        commonClaimIds: new Set(ca.filter((c) => idsB.has(c.claimId)).map((c) => c.claimId)).size,
        identicalTemplateClaims: new Set(ca.filter((c) => tplB.has(c.template)).map((c) => c.template)).size,
        factDifferences: [...factsA].filter((id) => !factsB.has(id)).length + [...factsB].filter((id) => !factsA.has(id)).length,
      });
    }
  }
  return deepFreeze({
    pages, pairs, aboveProvisional: above, thresholdsApplied: false,
    note: "Descriptive only: measured on the claims placed on each page. The thresholds are provisional proposals per family; no policy is applied by this report.",
  } as RepetitionReport);
}

export type RepetitionPolicy =
  | Readonly<{ mode: "report_only" }>
  | Readonly<{ mode: "enforce"; maxSharedTemplateShare: Readonly<Record<string, number>>; approvedBy: string; approvedAt: string }>;

export type RepetitionVerdict = Readonly<{ effectiveMode: "report_only" | "enforce"; notes: readonly string[]; flagged: readonly string[]; refused: readonly string[] }>;

/**
 * Applies a repetition policy. Only an explicit policy whose approval reaches "proof_verified" can refuse a page; anything
 * else is downgraded to a report and says why. There is no default policy: none has been validated.
 */
export function applyRepetitionPolicy(report: RepetitionReport, policy: RepetitionPolicy, config?: ApprovalConfig): RepetitionVerdict {
  const flagged = report.aboveProvisional.map((entry) => entry.key).sort();
  if (policy.mode !== "enforce") return { effectiveMode: "report_only", notes: ["report_only"], flagged, refused: [] };
  const level = approvalLevelOf(
    { kind: "repetition_policy", id: "repetition", subjectHash: sha256Hex(stableStringify(policy.maxSharedTemplateShare)), approvedBy: policy.approvedBy, approvedAt: policy.approvedAt },
    config,
  );
  if (level !== "proof_verified") return { effectiveMode: "report_only", notes: ["policy_not_approved", `approval_level:${level}`], flagged, refused: [] };
  const refused = report.pages
    .filter((page) => page.family !== null && page.sharedTemplateShare !== null && policy.maxSharedTemplateShare[page.family] !== undefined && page.sharedTemplateShare > policy.maxSharedTemplateShare[page.family]!)
    .map((page) => page.key)
    .sort();
  return { effectiveMode: "enforce", notes: ["policy_enforced"], flagged, refused };
}
