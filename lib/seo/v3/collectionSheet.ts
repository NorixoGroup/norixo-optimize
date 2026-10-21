/**
 * SEO generator V3 — collection sheets (S5.3-B). Pure and offline: work orders in, structured sheets out.
 *
 * A sheet tells a person exactly what fact to look for, where it must apply, what a source must be, which proof the
 * importer will demand and which human steps remain. It creates no fact, no decision and no source:
 *   - no source is built in: a candidate source is one that a person registered AND approved in the source registry
 *     (S5.3-A) AND declared, explicitly, to cover this exact scope. Nothing assumes a source covers another city;
 *   - a sheet is a to-do for a person, never a validation: every "human step" is listed, none is performed;
 *   - nothing here authenticates anyone or makes the decision log tamper-proof (`governance` says so in every plan).
 *
 * Mutualisation happens at the level of RESEARCH (one batch per source and country), never at the level of FACTS: each
 * sheet is one local fact with its own proof. Requirements that differ between topics are never merged: the sheet is
 * split per distinct requirement definition.
 */
import { parseIsoDateTime } from "./dates";
import { sha256Hex, stableStringify } from "./editorialCatalog";
import { QUOTE_MAX_CHARS, QUOTE_MIN_CHARS } from "./evidenceCheck";
import type { FactRegistry } from "./factRegistry";
import type { FactSourceType } from "./factSource";
import type { WorkOrder, WorkOrderReason } from "./coverageClassifier";
import type { FactPropertyType, GeographicScope } from "./localFact";
import { isHumanActor, type SourceRegistry } from "./sourceRegistry";
import { TOPIC_REQUIREMENTS, TOPIC_REQUIREMENTS_VERSION, type FactRequirement } from "./topicRequirements";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export const COLLECTION_SHEET_VERSION = "seo-v3-collection-sheet/1";

/** Source types for which the importer demands a verified quote (mirrors factStore.ts). */
const QUOTE_REQUIRED: readonly FactSourceType[] = ["official_authority", "official_tourism_body", "published_research", "public_web_page"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SheetStatus = "ready_to_collect" | "incomplete" | "blocked_by_governance";

export type SheetIssue =
  | "order_scope_invalid"
  | "order_platform_invalid"
  | "order_kind_invalid"
  | "order_reason_invalid"
  | "order_has_no_pages"
  | "page_outside_scope"
  | "page_topic_unknown"
  | "requirement_unknown"
  | "topic_without_requirement"
  | "requirement_variant_split"
  | "existing_fact_not_found"
  | "existing_fact_unverified"
  | "renewal_without_existing_fact"
  | "accepted_source_types_empty";

export type HumanStep =
  | "select_and_register_source"
  | "audit_public_use_governance"
  | "confirm_provisional_thresholds"
  | "human_validation"
  | "public_use_approval";

export type ProofField = Readonly<{ field: string; rule: string }>;

export type ExistingFact = Readonly<{ factId: string; version: number; validUntil: string; validation: string; superseded: boolean }>;

export type CandidateSource = Readonly<{
  sourceId: string;
  sourceType: FactSourceType;
  reviewValidUntil: string;
  /** The coverage of a source is a human declaration; nothing here has checked it against the source itself. */
  coverage: "declared_by_a_person";
}>;

export type CollectionSheet = Readonly<{
  sheetId: string;
  workOrderId: string;
  kind: "fact" | "timezone";
  scope: GeographicScope;
  platform: "airbnb" | null;
  propertyType: FactPropertyType;
  requirementId: string;
  requirementsVersion: string;
  /** Hash of the exact requirement definition this sheet answers (sheets of different definitions are never merged). */
  requirementHash: string;
  /** "voluntary": a person asked for this OPTIONAL fact; its absence never blocks a page. Orders without an origin count as required. */
  origin: "required" | "voluntary";
  mode: "new" | "refresh";
  reason: WorkOrderReason;
  acceptedSourceTypes: readonly FactSourceType[];
  validity: Readonly<{
    maxAgeDays: number | null;
    thresholdBasis: string | null;
    minimumSampleSize: number | null;
    minimumConfidence: string | null;
    /** A fact observed before this instant is already too old for the requirement. */
    observationMustEndAfter: string | null;
    /** The new fact's validUntil must lie after this instant. */
    validUntilMustExceed: string;
  }>;
  pages: readonly Readonly<{ citySlug: string; topic: LocalSeoTopicSlug }>[];
  /** Topics a public-use approval must list so that every page above can use the fact. */
  approvalTopics: readonly LocalSeoTopicSlug[];
  existingFact: ExistingFact | null;
  /** Prefilled where the answer is known; null where a person must supply it. Not an importable record. */
  recordTemplate: Readonly<Record<string, unknown>>;
  suggestedFactId: string;
  proofFields: Readonly<Record<string, readonly ProofField[]>>;
  candidateSources: readonly CandidateSource[];
  humanSteps: readonly HumanStep[];
  refreshDueAt: string | null;
  status: SheetStatus;
  issues: readonly SheetIssue[];
}>;

export type SourceCoverageClaim = Readonly<{
  sourceId: string;
  /** Exact scopes only; a country never stands for its cities. */
  scopes: readonly GeographicScope[];
  /** null = every requirement of those scopes the source is registered for. */
  requirementIds: readonly string[] | null;
  declaredBy: string;
  declaredAt: string;
  basis: string;
}>;

export type CollectionPlanInput = Readonly<{
  orders: readonly WorkOrder[];
  /** Reference instant; the module never reads the clock. */
  asOf: string;
  sourceRegistry?: SourceRegistry;
  sourceCoverage?: readonly SourceCoverageClaim[];
  /** Registry built from the previous import, to describe the facts to refresh. */
  registry?: FactRegistry;
  /** Requirement table to read; defaults to TOPIC_REQUIREMENTS. Tests inject variants to prove definitions are never merged. */
  requirements?: typeof TOPIC_REQUIREMENTS;
  /** Hash of the previous S5.3-A import report, when there is one. */
  importBaseline?: Readonly<{ reportHash: string }> | null;
}>;

export type ResearchUnit = Readonly<{ countryCode: string; requirementId: string; kind: "fact" | "timezone"; cityCount: number; sheetIds: readonly string[] }>;
export type ResearchBatch = Readonly<{ sourceId: string | null; units: readonly ResearchUnit[] }>;

export type CollectionPlan = Readonly<{
  meta: Readonly<{
    sheetVersion: string;
    requirementsVersion: string;
    asOf: string;
    sourceRegistryHash: string | null;
    importBaseline: Readonly<{ status: "absent" } | { status: "provided"; reportHash: string }>;
    /** Stated in every plan: these are properties of the system, not of one run. */
    governance: Readonly<{ actorsAuthenticated: false; decisionLogTamperProof: false; sourceCoverageVerified: false }>;
    warnings: readonly string[];
  }>;
  sheets: readonly CollectionSheet[];
  /** Research grouped by source (null = no known candidate source) and country; facts stay one per sheet. */
  batches: readonly ResearchBatch[];
  rejectedOrders: readonly Readonly<{ workOrderId: string | null; issues: readonly SheetIssue[] | readonly string[] }>[];
  coverageIssues: readonly string[];
  summary: Readonly<{ sheets: number; byStatus: Readonly<Record<SheetStatus, number>>; rejectedOrders: number; pages: number }>;
  /** No fact, no decision and no source is created by a plan. */
  createsFacts: false;
  createsDecisions: false;
  publicationAuthorised: false;
}>;

// --- helpers ------------------------------------------------------------------------------------------------

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const isoAfter = (ms: number): string => new Date(ms).toISOString();

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}

const TIMEZONE_REQUIREMENT = { requirementId: "timezone", kind: "geographic", attribute: "timezone" } as const;

function scopeProblem(scope: unknown): boolean {
  const s = scope as Record<string, unknown> | null;
  if (typeof s !== "object" || s === null) return true;
  if (typeof s.countryCode !== "string" || !/^[A-Z]{2}$/.test(s.countryCode)) return true;
  if (s.level === "country") return false;
  return !((s.level === "city" || s.level === "district") && typeof s.citySlug === "string" && SLUG.test(s.citySlug));
}

function valueTemplate(requirement: FactRequirement | typeof TIMEZONE_REQUIREMENT): Record<string, unknown> {
  switch (requirement.kind) {
    case "quantitative":
      return { metric: requirement.metric, "...": "fields of the metric (see lib/seo/v3/localFact.ts); every figure must come from the source" };
    case "qualitative":
      return { category: requirement.category, statement: null, language: "en", basis: null };
    case "regulatory":
      return { ruleType: typeof requirement.ruleType === "string" && requirement.ruleType !== "any" ? requirement.ruleType : null, ...(Array.isArray(requirement.ruleType) ? { acceptedRuleTypes: [...requirement.ruleType] } : {}), rule: null, effectiveFrom: null, effectiveUntil: null, officialReference: null };
    case "geographic":
      return { attribute: requirement.attribute, value: null };
  }
}

function proofFor(sourceType: FactSourceType): readonly ProofField[] {
  const common: ProofField[] = [
    { field: "source.sourceId", rule: "must be a source registered and approved in the source registry" },
    { field: "source.termsOfUse", rule: "must equal the registry's terms status" },
    { field: "source.publicationRestrictions", rule: "must repeat every restriction the registry requires" },
    { field: "source.consultedAt", rule: "when a person actually read the source" },
    { field: "source.evidence", rule: "at least one anchor; every cited artifact hash must appear as a content_hash anchor" },
  ];
  if (QUOTE_REQUIRED.includes(sourceType)) {
    return [
      ...common,
      { field: "source.locator", rule: "a URL must use https and an allowed host of the registered source" },
      { field: "citations[].artifactSha256", rule: "SHA-256 of the archived artifact, kept outside the repository" },
      { field: "citations[].quote", rule: `verbatim, ${QUOTE_MIN_CHARS}-${QUOTE_MAX_CHARS} characters, found exactly in the artifact (Unicode NFC only)` },
      { field: "citations[].locator", rule: "page, section or article, or null" },
      { field: "citations[].applicability.geographic", rule: "why the quote applies to THIS place, not only its country" },
      { field: "citations[].applicability.temporal", rule: "the period during which the quote holds" },
      { field: "citations[].applicability.semantic", rule: "why the wording supports the stated fact" },
    ];
  }
  if (sourceType === "licensed_dataset") {
    return [...common, { field: "source.evidence", rule: "content_hash of the licensed file; figures need the registry's derivative-figures right" }, { field: "observedPeriod", rule: "the period the data describes" }];
  }
  if (sourceType === "editorial_note") {
    return [...common, { field: "source.collectionMethod", rule: "documented editorial method, repeatable" }, { field: "value.basis", rule: "editorial_observation" }];
  }
  return common;
}

function existingFactOf(registry: FactRegistry | undefined, factId: string | null): ExistingFact | null | "not_found" {
  if (factId === null) return null;
  if (registry === undefined) return null;
  const fact = registry.get(factId as never);
  if (fact === undefined) return "not_found";
  return {
    factId: fact.factId, version: fact.version, validUntil: fact.validUntil, validation: fact.validation.status, superseded: registry.isSuperseded(fact.factId),
  };
}

// --- plan ---------------------------------------------------------------------------------------------------------

export function buildCollectionPlan(input: CollectionPlanInput): CollectionPlan {
  const asOfMs = parseIsoDateTime(input.asOf);
  const warnings: string[] = [];
  const importBaseline = input.importBaseline === undefined || input.importBaseline === null ? ({ status: "absent" } as const) : ({ status: "provided", reportHash: input.importBaseline.reportHash } as const);
  if (importBaseline.status === "absent") warnings.push("import_baseline_absent");
  if (input.sourceRegistry === undefined) warnings.push("source_registry_absent");
  const rejected: { workOrderId: string | null; issues: string[] }[] = [];
  const coverageIssues: string[] = [];

  // --- orders: normalise, dedupe, never merge conflicting ones --------------------------------------------------
  const byId = new Map<string, WorkOrder[]>();
  for (const order of Array.isArray(input.orders) ? input.orders : []) {
    if (typeof order !== "object" || order === null || typeof order.id !== "string" || order.id === "") {
      rejected.push({ workOrderId: null, issues: ["order_malformed"] });
      continue;
    }
    byId.set(order.id, [...(byId.get(order.id) ?? []), order]);
  }
  const orders: WorkOrder[] = [];
  for (const [id, group] of byId) {
    const identity = (o: WorkOrder) => stableStringify({ ...o, coversPages: undefined });
    if (new Set(group.map(identity)).size > 1) {
      rejected.push({ workOrderId: id, issues: ["duplicate_order_id_conflict"] });
      continue;
    }
    const pages = new Map<string, WorkOrder["coversPages"][number]>();
    for (const o of group) for (const p of Array.isArray(o.coversPages) ? o.coversPages : []) pages.set(`${p?.citySlug}/${p?.topic}`, p);
    orders.push({ ...group[0]!, coversPages: [...pages.values()] });
  }

  // --- source coverage declarations ------------------------------------------------------------------------------
  const claims: SourceCoverageClaim[] = [];
  for (const claim of input.sourceCoverage ?? []) {
    const ok = claim !== null && typeof claim === "object" && typeof claim.sourceId === "string" && Array.isArray(claim.scopes) && claim.scopes.every((s) => !scopeProblem(s))
      && isHumanActor(claim.declaredBy) && parseIsoDateTime(claim.declaredAt) !== null && typeof claim.basis === "string" && claim.basis.trim() !== ""
      && (claim.requirementIds === null || Array.isArray(claim.requirementIds));
    if (!ok) coverageIssues.push(`coverage_claim_invalid:${typeof claim?.sourceId === "string" ? claim.sourceId : "<unknown>"}`);
    else claims.push(claim);
  }

  const sheets: CollectionSheet[] = [];
  for (const order of orders) {
    const issues = new Set<SheetIssue>();
    const kindOk = order.kind === "fact" || order.kind === "timezone";
    if (!kindOk) issues.add("order_kind_invalid");
    if (scopeProblem(order.scope)) issues.add("order_scope_invalid");
    if (kindOk && (order.kind === "timezone" ? order.platform !== null : order.platform !== "airbnb")) issues.add("order_platform_invalid");
    if (order.reason !== "absent" && order.reason !== "expired" && order.reason !== "renewal_due") issues.add("order_reason_invalid");
    const pages = (Array.isArray(order.coversPages) ? order.coversPages : []).filter((p) => p !== null && typeof p === "object");
    if (pages.length === 0) issues.add("order_has_no_pages");
    const scope = order.scope as GeographicScope;
    for (const page of pages) {
      if (!(LOCAL_SEO_TOPIC_SLUGS as readonly unknown[]).includes(page.topic)) issues.add("page_topic_unknown");
      if (!scopeProblem(scope) && scope.level !== "country" && (scope as { citySlug: string }).citySlug !== page.citySlug) issues.add("page_outside_scope");
    }
    if (issues.has("order_kind_invalid") || issues.has("order_scope_invalid") || issues.has("order_reason_invalid") || issues.has("order_has_no_pages")) {
      rejected.push({ workOrderId: order.id, issues: [...issues].sort() });
      continue;
    }

    // requirement variants: topics whose definition differs are never merged into one sheet
    type Variant = { requirement: FactRequirement | typeof TIMEZONE_REQUIREMENT; hash: string; pages: typeof pages; topics: Set<LocalSeoTopicSlug> };
    const variants = new Map<string, Variant>();
    if (order.kind === "timezone") {
      variants.set(sha256Hex(stableStringify(TIMEZONE_REQUIREMENT)), { requirement: TIMEZONE_REQUIREMENT, hash: sha256Hex(stableStringify(TIMEZONE_REQUIREMENT)), pages, topics: new Set(pages.map((p) => p.topic)) });
    } else {
      for (const page of pages) {
        const spec = ((input.requirements ?? TOPIC_REQUIREMENTS) as Readonly<Record<string, (typeof TOPIC_REQUIREMENTS)[LocalSeoTopicSlug] | undefined>>)[page.topic as string];
        const requirement = spec === undefined ? undefined : [...spec.required, ...spec.optional].find((r) => r.requirementId === order.requirementId);
        if (requirement === undefined) {
          issues.add(spec === undefined ? "page_topic_unknown" : "topic_without_requirement");
          continue;
        }
        const hash = sha256Hex(stableStringify(requirement));
        const variant = variants.get(hash) ?? { requirement, hash, pages: [], topics: new Set<LocalSeoTopicSlug>() };
        (variant.pages as typeof pages).push(page);
        variant.topics.add(page.topic);
        variants.set(hash, variant);
      }
      if (variants.size === 0) issues.add("requirement_unknown");
      if (variants.size > 1) issues.add("requirement_variant_split");
    }
    if (variants.size === 0) {
      rejected.push({ workOrderId: order.id, issues: [...issues].sort() });
      continue;
    }

    const existing = existingFactOf(input.registry, order.closestFactId);
    // without a registry the predecessor cannot be described: keep its id, leave the version to a person, say so
    const unverifiedPredecessor = input.registry === undefined && order.closestFactId !== null;
    if (unverifiedPredecessor) issues.add("existing_fact_unverified");
    if (existing === "not_found") issues.add("existing_fact_not_found");
    if (order.reason === "renewal_due" && (order.closestFactId === null || existing === "not_found")) issues.add("renewal_without_existing_fact");

    for (const variant of [...variants.values()].sort((a, b) => compare(a.hash, b.hash))) {
      const requirement = variant.requirement;
      const full = requirement === TIMEZONE_REQUIREMENT ? null : (requirement as FactRequirement);
      const sheetIssues = new Set(issues);
      // only the source types the order allows (the audit lock was applied by S5.2)
      const accepted = [...order.acceptedSourceTypes].sort(compare) as FactSourceType[];
      if (accepted.length === 0) sheetIssues.add("accepted_source_types_empty");
      const auditExcluded = full !== null && full.acceptableSourceTypes.includes("user_audit_aggregate") && !accepted.includes("user_audit_aggregate");

      const candidates: CandidateSource[] = [];
      if (input.sourceRegistry !== undefined && asOfMs !== null) {
        for (const claim of claims) {
          const entry = input.sourceRegistry.entries.get(claim.sourceId);
          if (entry === undefined || entry.status !== "approved" || !accepted.includes(entry.sourceType)) continue;
          const until = parseIsoDateTime(entry.reviewValidUntil);
          const reviewed = parseIsoDateTime(entry.reviewedAt);
          if (until === null || reviewed === null || asOfMs >= until || reviewed > asOfMs) continue;
          const covers = claim.scopes.some((s) => stableStringify(s) === stableStringify(scope));
          if (!covers || (claim.requirementIds !== null && !claim.requirementIds.includes(order.requirementId))) continue;
          candidates.push({ sourceId: entry.sourceId, sourceType: entry.sourceType, reviewValidUntil: entry.reviewValidUntil, coverage: "declared_by_a_person" });
        }
      }

      const steps = new Set<HumanStep>(["human_validation", "public_use_approval"]);
      if (candidates.length === 0) steps.add("select_and_register_source");
      if (auditExcluded) steps.add("audit_public_use_governance");
      if (full !== null && full.thresholdBasis === "provisional_pending_human_decision") steps.add("confirm_provisional_thresholds");

      const maxAge = full === null ? null : full.maxAgeDays;
      const known = existing !== null && existing !== "not_found" ? existing : null;
      const refresh = order.reason === "renewal_due" || known !== null || unverifiedPredecessor;
      const version = known !== null ? known.version + 1 : unverifiedPredecessor ? null : 1;
      const supersedes = known !== null ? known.factId : unverifiedPredecessor ? order.closestFactId : null;
      const topics = [...variant.topics].sort(compare) as LocalSeoTopicSlug[];
      const countryLower = scope.countryCode.toLowerCase();
      const place = scope.level === "country" ? countryLower : `${countryLower}:${(scope as { citySlug: string }).citySlug}`;
      const status: SheetStatus = sheetIssues.has("accepted_source_types_empty") ? "blocked_by_governance" : [...sheetIssues].some((i) => i !== "requirement_variant_split") ? "incomplete" : "ready_to_collect";

      sheets.push({
        sheetId: sha256Hex(stableStringify({ workOrderId: order.id, requirementHash: variant.hash, sheetVersion: COLLECTION_SHEET_VERSION })),
        workOrderId: order.id, kind: order.kind, scope, platform: order.platform, propertyType: order.propertyType,
        requirementId: order.requirementId, requirementsVersion: order.requirementsVersion ?? TOPIC_REQUIREMENTS_VERSION, requirementHash: variant.hash, origin: order.origin === "voluntary" ? "voluntary" : "required",
        mode: refresh ? "refresh" : "new", reason: order.reason, acceptedSourceTypes: accepted,
        validity: {
          maxAgeDays: maxAge,
          thresholdBasis: full === null ? null : full.thresholdBasis,
          minimumSampleSize: full === null ? null : full.minimumSampleSize,
          minimumConfidence: full === null ? null : full.minimumConfidence,
          observationMustEndAfter: maxAge === null || asOfMs === null ? null : isoAfter(asOfMs - maxAge * DAY_MS),
          validUntilMustExceed: input.asOf,
        },
        pages: [...variant.pages].map((p) => ({ citySlug: p.citySlug, topic: p.topic })).sort((a, b) => compare(a.citySlug, b.citySlug) || compare(a.topic, b.topic)),
        approvalTopics: topics,
        existingFact: existing === null || existing === "not_found" ? null : existing,
        recordTemplate: {
          schemaVersion: "seo-v3-fact-record/1", factId: null, kind: requirement.kind, scope, platform: order.platform, propertyType: order.propertyType, unit: null,
          source: null, collectedAt: null, observedPeriod: null, validUntil: null, confidence: null, relevantTopics: topics,
          version, supersedes, value: valueTemplate(requirement), displayConstraints: null, citations: [], workOrderId: order.id,
        },
        suggestedFactId: `fact:${place}:${order.requirementId.replace(/[^A-Za-z0-9]+/g, "-")}:v${version ?? "next"}`,
        proofFields: Object.fromEntries(accepted.map((type) => [type, proofFor(type)])),
        candidateSources: candidates.sort((a, b) => compare(a.sourceId, b.sourceId)),
        humanSteps: [...steps].sort(compare) as HumanStep[],
        refreshDueAt: order.refreshDueAt,
        status, issues: [...sheetIssues].sort(),
      });
    }
  }
  sheets.sort((a, b) => compare(a.scope.countryCode, b.scope.countryCode) || compare(stableStringify(a.scope), stableStringify(b.scope)) || compare(a.requirementId, b.requirementId) || compare(a.kind, b.kind) || compare(a.sheetId, b.sheetId));

  // --- research batches: per source (or none) and country; one fact per sheet is preserved -----------------------
  const batchKeys = new Map<string, Map<string, { countryCode: string; requirementId: string; kind: "fact" | "timezone"; sheetIds: string[] }>>();
  for (const sheet of sheets) {
    const sources: (string | null)[] = sheet.candidateSources.length === 0 ? [null] : sheet.candidateSources.map((c) => c.sourceId);
    for (const sourceId of sources) {
      const key = sourceId ?? "";
      const units = batchKeys.get(key) ?? new Map();
      const unitKey = `${sheet.scope.countryCode}|${sheet.requirementId}|${sheet.kind}`;
      const unit = units.get(unitKey) ?? { countryCode: sheet.scope.countryCode, requirementId: sheet.requirementId, kind: sheet.kind, sheetIds: [] };
      unit.sheetIds.push(sheet.sheetId);
      units.set(unitKey, unit);
      batchKeys.set(key, units);
    }
  }
  const batches: ResearchBatch[] = [...batchKeys.entries()]
    .map(([key, units]) => ({
      sourceId: key === "" ? null : key,
      units: [...units.values()].map((u) => ({ ...u, cityCount: u.sheetIds.length, sheetIds: [...u.sheetIds].sort() })).sort((a, b) => compare(a.countryCode, b.countryCode) || compare(a.requirementId, b.requirementId) || compare(a.kind, b.kind)),
    }))
    .sort((a, b) => compare(a.sourceId ?? "", b.sourceId ?? ""));

  const byStatus: Record<SheetStatus, number> = { ready_to_collect: 0, incomplete: 0, blocked_by_governance: 0 };
  for (const sheet of sheets) byStatus[sheet.status] += 1;
  return deepFreeze({
    meta: {
      sheetVersion: COLLECTION_SHEET_VERSION, requirementsVersion: TOPIC_REQUIREMENTS_VERSION, asOf: input.asOf,
      sourceRegistryHash: input.sourceRegistry === undefined ? null : input.sourceRegistry.registryHash, importBaseline,
      governance: { actorsAuthenticated: false, decisionLogTamperProof: false, sourceCoverageVerified: false },
      warnings: [...warnings, ...(asOfMs === null ? ["as_of_invalid"] : [])].sort(),
    },
    sheets, batches,
    rejectedOrders: rejected.map((r) => ({ workOrderId: r.workOrderId, issues: [...r.issues].sort() })).sort((a, b) => compare(a.workOrderId ?? "", b.workOrderId ?? "")),
    coverageIssues: [...coverageIssues].sort(),
    summary: { sheets: sheets.length, byStatus, rejectedOrders: rejected.length, pages: sheets.reduce((n, s) => n + s.pages.length, 0) },
    createsFacts: false, createsDecisions: false, publicationAuthorised: false,
  });
}

/** Canonical text of a plan: identical inputs give identical bytes. */
export function serializeCollectionPlan(plan: CollectionPlan): string {
  return stableStringify(plan);
}
