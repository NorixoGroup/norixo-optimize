/**
 * SEO generator V3 — coverage classifier (S5.2). Pure, offline, deterministic.
 *
 * For every city x topic page it answers one question: what stands between this page and an editorial review,
 * and what should happen next? It reuses the S2 registry, `evaluateTopicFacts`, the assembler and `comparePages`;
 * it adds no business rule of its own and loosens none of theirs.
 *
 *   - A page is described by one primary class plus an ordered list of blockers (the first one decides the class).
 *   - Nothing here authorises publication or indexing: both flags are the literal `false` on every entry.
 *   - The registry is only read. The clock is never read: `asOf` is a required input.
 *   - A national fact never answers a city page (exact-scope rule of the registry, unchanged). Platform is "airbnb".
 *   - The experimental profile only RELABELS a page whose sole obstacle is an unconfirmed draft threshold that its
 *     own fact already passes. It never makes a page ready, never counts as ready, and never touches a contract.
 *   - An experimental page is NOT assembled: the assembler (unchanged) applies the strict requirements and would refuse a
 *     provisional threshold, so `rawAssemblyStatus` stays "not_assembled" and no page is built or compared. The label
 *     validates the classification pipeline only; it is never evidence that the page could be rendered.
 *   - A grouping into a hub is only a proposed action under `needs_human_decision`; it is never carried out.
 */
import { AUDIT_PUBLIC_USE_LOCK, ageReferenceMs } from "./factUse";
import { DAY_MS, parseIsoDateTime } from "./dates";
import { APPROVED_EDITORIAL_CATALOG, sha256Hex, stableStringify, type EditorialCatalog } from "./editorialCatalog";
import type { FactRegistry } from "./factRegistry";
import type { FactSourceType } from "./factSource";
import type { GeneratedPage } from "./generatedPage";
import type { AssemblyStatus } from "./assemblyDecision";
import type { FactId, FactPropertyType, GeographicScope } from "./localFact";
import { ASSEMBLER_RULE_VERSION, assembleGeneratedPage } from "./pageAssembler";
import { comparePages } from "./pageDiagnostics";
import { COUNTRY_ISO, resolveCountryIso, validateCountryIsoTable, type CountryIsoTable } from "./geoScope";
import { evaluateTopicFacts, type RequirementReport, type TopicFactsOverall, type TopicFactsReport } from "./topicFactEvaluation";
import { TOPIC_REQUIREMENTS, TOPIC_REQUIREMENTS_VERSION, type FactRequirement } from "./topicRequirements";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export const CLASSIFIER_VERSION = "seo-v3-coverage/1";
/** The pages live under /airbnb-optimizer/: their facts are Airbnb facts. Never null (a neutral fact does not answer them). */
export const PAGE_PLATFORM = "airbnb" as const;
/** Provisional objective of differentiation: distinct facts per page. A diagnostic, not a gate. */
export const DIFFERENTIATION_TARGET_DISTINCT_FACTS = 2;
export const DEFAULT_REFRESH_LOOKAHEAD_DAYS = 30;

export type ThresholdProfile = "draft-provisional" | "experimental-pipeline-validation";

export type CoverageClassName =
  | "candidate_for_editorial_review"
  | "experimental_candidate"
  | "needs_data"
  | "needs_review_queue"
  | "needs_resourcing"
  | "needs_human_decision"
  | "invalid";

/** Canonical order of the blockers: the first one present decides the class. */
export const BLOCKER_ORDER = [
  "invalid_request",
  "country_iso_unknown",
  "timezone_unvalidated",
  "facts_absent",
  "facts_expired",
  "facts_below_threshold",
  "facts_pending_validation",
  "source_type_not_accepted",
  "public_use_not_approved",
  "approval_scope_excludes_topic",
  "audit_governance_lock",
  "conflicting_facts",
  "revoked_series_overlap",
  "threshold_unconfirmed",
  "topic_requires_editorial_decision",
  "local_editorial_decision",
  "open_editorial_decision",
  "assembly_not_ready",
  "duplicate_across_topics",
  "hub_proposal",
] as const;
export type BlockerCode = (typeof BLOCKER_ORDER)[number];

/** Diagnostics that never change the class. A fact shared by several topics of a city is a risk to look at, not a refusal. */
export type WarningCode = "competing_qualitative_notes" | "below_distinct_fact_target" | "shared_fact_across_topics";

const CLASS_OF_BLOCKER: Readonly<Record<BlockerCode, Exclude<CoverageClassName, "candidate_for_editorial_review" | "experimental_candidate">>> = {
  invalid_request: "invalid",
  country_iso_unknown: "needs_human_decision",
  timezone_unvalidated: "needs_data",
  facts_absent: "needs_data",
  facts_expired: "needs_data",
  facts_below_threshold: "needs_data",
  facts_pending_validation: "needs_review_queue",
  source_type_not_accepted: "needs_resourcing",
  public_use_not_approved: "needs_review_queue",
  approval_scope_excludes_topic: "needs_review_queue",
  audit_governance_lock: "needs_human_decision",
  conflicting_facts: "needs_human_decision",
  revoked_series_overlap: "needs_human_decision",
  threshold_unconfirmed: "needs_human_decision",
  topic_requires_editorial_decision: "needs_human_decision",
  local_editorial_decision: "needs_human_decision",
  open_editorial_decision: "needs_human_decision",
  assembly_not_ready: "needs_human_decision",
  duplicate_across_topics: "needs_human_decision",
  hub_proposal: "needs_human_decision",
};

export type WorkOrderReason = "absent" | "expired" | "renewal_due";

/**
 * "required": the order fixes a blocker of a required requirement.
 * "voluntary": a person explicitly asked to collect an OPTIONAL requirement (or an optional fact is due for renewal).
 * A voluntary order never blocks a page, whether it is fulfilled or not.
 */
export type WorkOrderOrigin = "required" | "voluntary";

export type WorkOrder = Readonly<{
  /** Hash of the full key: scope, platform, property type, requirement, kind and requirements version. */
  id: string;
  kind: "fact" | "timezone";
  scope: GeographicScope;
  /** "airbnb" for page facts; null for a time zone, which the registry only resolves from a platform-neutral fact. */
  platform: typeof PAGE_PLATFORM | null;
  propertyType: FactPropertyType;
  requirementId: string;
  requirementsVersion: string;
  reason: WorkOrderReason;
  origin: WorkOrderOrigin;
  /** Source types that may be asked for. `user_audit_aggregate` is left out while the audit lock is closed. */
  acceptedSourceTypes: readonly FactSourceType[];
  /** Head of the series to supersede (a refresh is a new version, never a new fact), or null. */
  closestFactId: FactId | null;
  refreshDueAt: string | null;
  coversPages: readonly Readonly<{ citySlug: string; topic: LocalSeoTopicSlug }>[];
}>;

export type ProposedAction =
  | Readonly<{ kind: "collect"; workOrderId: string }>
  | Readonly<{ kind: "review_fact"; factId: string }>
  | Readonly<{ kind: "resource"; requirementId: string }>
  | Readonly<{ kind: "decide"; decisionId: string }>
  | Readonly<{ kind: "propose_hub_section_only"; reason: "topic_has_no_local_value" }>;

export type CoverageEntry = Readonly<{
  citySlug: string;
  topic: LocalSeoTopicSlug;
  countryCode: string | null;
  coverageClass: CoverageClassName;
  /** True only for `experimental_candidate`: the page is labelled, never ready. */
  experimentalOnly: boolean;
  blockers: readonly BlockerCode[];
  warnings: readonly WarningCode[];
  actions: readonly ProposedAction[];
  /** The assembler's own status, or "not_assembled" when the topic facts already blocked the page. */
  rawAssemblyStatus: AssemblyStatus | "not_assembled";
  topicFactsOverall: TopicFactsOverall | null;
  reasons: readonly string[];
  distinctFactCount: number;
  publicationAuthorised: false;
  indexingAuthorised: false;
}>;

export type CoverageReport = Readonly<{
  meta: Readonly<{
    classifierVersion: string;
    requirementsVersion: string;
    assemblerRuleVersion: string;
    registrySnapshotId: string;
    asOf: string;
    thresholdProfile: ThresholdProfile;
    catalogId: string;
    platform: typeof PAGE_PLATFORM;
    propertyType: FactPropertyType;
    refreshLookaheadDays: number;
    ignoredDuplicateCitySlugs: readonly string[];
    countryIsoTableProblems: readonly string[];
  }>;
  entries: readonly CoverageEntry[];
  workOrders: readonly WorkOrder[];
  voluntaryCollection: VoluntaryReport;
  decisionsRequired: readonly Readonly<{ id: string; blocksPages: number }>[];
  factReuse: readonly Readonly<{ factId: string; pages: number }>[];
  summary: Readonly<Record<CoverageClassName, number>>;
  stats: Readonly<{ pagesEvaluated: number; assembliesRun: number; readyCount: number; experimentalCount: number }>;
}>;

/** An explicit request to collect one OPTIONAL requirement for one exact page. Nothing is requested by default. */
export type VoluntaryRequest = Readonly<{ citySlug: string; topic: LocalSeoTopicSlug; requirementId: string }>;

export type VoluntaryIgnoredReason =
  | "request_malformed"
  | "city_not_in_run"
  | "topic_not_in_run"
  | "requirement_not_optional_for_topic"
  | "already_covered"
  | "no_collectible_source_type";

export type VoluntaryReport = Readonly<{
  requested: number;
  ordered: readonly VoluntaryRequest[];
  ignored: readonly Readonly<{ citySlug: string | null; topic: string | null; requirementId: string | null; reason: VoluntaryIgnoredReason }>[];
}>;

export type ClassifyInput = Readonly<{
  cities: readonly Readonly<{ slug: string; country: string }>[];
  /** Defaults to the 25 V3 topics. */
  topics?: readonly LocalSeoTopicSlug[];
  registry: FactRegistry;
  /** Required and explicit: the classifier never reads the clock. */
  asOf: string;
  thresholdProfile: ThresholdProfile;
  /** Required: there is no silent default for the property type of the facts a page needs. */
  propertyType: FactPropertyType;
  countryIsoTable?: CountryIsoTable;
  catalog?: EditorialCatalog;
  refreshLookaheadDays?: number;
  /** Optional requirements a person explicitly wants collected. Never inferred, never applied to a required requirement. */
  voluntaryCollection?: readonly VoluntaryRequest[];
}>;

// --- helpers ------------------------------------------------------------------------------------------------

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isKnownTopic = (topic: unknown): topic is LocalSeoTopicSlug => (LOCAL_SEO_TOPIC_SLUGS as readonly unknown[]).includes(topic);

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}

type Draft = {
  citySlug: string;
  topic: LocalSeoTopicSlug;
  countryCode: string | null;
  blockers: Set<BlockerCode>;
  warnings: Set<WarningCode>;
  actions: ProposedAction[];
  rawAssemblyStatus: AssemblyStatus | "not_assembled";
  overall: TopicFactsOverall | null;
  reasons: string[];
  facts: Set<string>;
  page: GeneratedPage | null;
  experimentalEligible: boolean;
};

const REASON_SEVERITY: Readonly<Record<WorkOrderReason, number>> = { renewal_due: 1, expired: 2, absent: 3 };

type OrderDraft = { -readonly [K in keyof Omit<WorkOrder, "coversPages">]: WorkOrder[K] } & { covers: Map<string, { citySlug: string; topic: LocalSeoTopicSlug }> };

/** Blockers behind one unmet requirement. An unknown time zone no longer hides what else is wrong with the same fact. */
function notMetBlockers(report: RequirementReport): readonly BlockerCode[] {
  const zoneUnknown = report.issues.includes("rule_timezone_unknown");
  if (!zoneUnknown) return [notMetBlocker(report.reason ?? "absent", report.issues)];
  const found: BlockerCode[] = ["timezone_unvalidated"];
  const others = report.issues.filter((issue) => issue !== "rule_timezone_unknown");
  if (others.includes("expired") || others.includes("rule_no_longer_in_force")) found.push("facts_expired");
  else if (others.includes("not_validated")) found.push("facts_pending_validation");
  else if (others.includes("public_use_not_approved") || others.includes("approval_scope_excludes_topic")) found.push(notMetBlocker("public_use_not_approved", others));
  return found;
}

function notMetBlocker(reason: NonNullable<RequirementReport["reason"]>, issues: readonly string[]): BlockerCode {
  switch (reason) {
    case "expired":
      return "facts_expired";
    case "confidence_too_low":
    case "sample_too_small":
      return "facts_below_threshold";
    case "not_validated":
      return "facts_pending_validation";
    case "source_type_not_accepted":
      return "source_type_not_accepted";
    case "public_use_not_approved":
      if (issues.includes("approval_scope_excludes_topic")) return "approval_scope_excludes_topic";
      if (issues.some((issue) => issue.startsWith("audit_"))) return "audit_governance_lock";
      return "public_use_not_approved";
    default:
      return "facts_absent";
  }
}

const DECISION_OF_BLOCKER: Partial<Record<BlockerCode, string>> = {
  country_iso_unknown: "country_iso_table",
  audit_governance_lock: "audit_public_use_governance",
  conflicting_facts: "fact_arbitration",
  revoked_series_overlap: "fact_arbitration",
  threshold_unconfirmed: "thresholds_confirmation",
  topic_requires_editorial_decision: "universal_topic_hub_policy",
  local_editorial_decision: "local_topic_editorial_review",
  assembly_not_ready: "assembly_review",
  duplicate_across_topics: "cross_topic_duplication_policy",
};

function pushAction(draft: Draft, action: ProposedAction): void {
  const key = stableStringify(action);
  if (!draft.actions.some((existing) => stableStringify(existing) === key)) draft.actions.push(action);
}

function acceptedSources(requirement: FactRequirement): readonly FactSourceType[] {
  return requirement.acceptableSourceTypes.filter((type) => type !== "user_audit_aggregate" || AUDIT_PUBLIC_USE_LOCK.unlocked);
}

// --- classification -----------------------------------------------------------------------------------------

export function classifyCoverage(input: ClassifyInput): CoverageReport {
  const { registry, asOf, thresholdProfile, propertyType } = input;
  const table = input.countryIsoTable ?? COUNTRY_ISO;
  const catalog = input.catalog ?? APPROVED_EDITORIAL_CATALOG;
  const lookaheadDays = input.refreshLookaheadDays ?? DEFAULT_REFRESH_LOOKAHEAD_DAYS;
  const asOfMs = parseIsoDateTime(asOf);
  const topics = [...new Set(input.topics ?? LOCAL_SEO_TOPIC_SLUGS)].sort(compare);

  // one registry fingerprint per run, same formula as the assembler's traceability
  const registrySnapshotId = sha256Hex(stableStringify([...registry.list()].sort((x, y) => compare(x.factId, y.factId))));

  const seen = new Set<string>();
  const ignored: string[] = [];
  const cities = (Array.isArray(input.cities) ? [...input.cities] : [])
    .filter((city) => typeof city === "object" && city !== null && typeof city.slug === "string" && typeof city.country === "string")
    .sort((a, b) => compare(a.slug, b.slug) || compare(a.country, b.country)).filter((city) => {
    if (seen.has(city.slug)) {
      ignored.push(city.slug);
      return false;
    }
    seen.add(city.slug);
    return true;
  });

  const drafts: Draft[] = [];
  const orders = new Map<string, OrderDraft>();
  const decisions = new Map<string, Set<string>>();
  const addDecision = (id: string, page: string) => {
    if (!decisions.has(id)) decisions.set(id, new Set());
    decisions.get(id)!.add(page);
  };
  const addOrder = (scope: GeographicScope, requirementId: string, kind: WorkOrder["kind"], reason: WorkOrderReason, sources: readonly FactSourceType[],
    closest: FactId | null, refreshDueAt: string | null, page: { citySlug: string; topic: LocalSeoTopicSlug }, origin: WorkOrderOrigin = "required"): string => {
    // the registry resolves a time zone only from a fact with platform null and property type null
    const orderPlatform = kind === "timezone" ? null : PAGE_PLATFORM;
    const orderPropertyType = kind === "timezone" ? null : propertyType;
    const id = sha256Hex(stableStringify({ scope, platform: orderPlatform, propertyType: orderPropertyType, requirementId, kind, requirementsVersion: TOPIC_REQUIREMENTS_VERSION }));
    let order = orders.get(id);
    if (order !== undefined) {
      // merge: most urgent reason wins (with its closest fact), earliest due date, union of acceptable sources
      if (REASON_SEVERITY[reason] > REASON_SEVERITY[order.reason]) {
        order.reason = reason;
        order.closestFactId = closest ?? order.closestFactId;
      } else {
        order.closestFactId = order.closestFactId ?? closest;
      }
      if (refreshDueAt !== null && (order.refreshDueAt === null || refreshDueAt < order.refreshDueAt)) order.refreshDueAt = refreshDueAt;
      order.acceptedSourceTypes = [...new Set([...order.acceptedSourceTypes, ...sources])].sort(compare) as FactSourceType[];
      if (origin === "required") order.origin = "required"; // a required need is never downgraded by a voluntary one
    }
    if (order === undefined) {
      order = { id, kind, scope, platform: orderPlatform, propertyType: orderPropertyType, requirementId, requirementsVersion: TOPIC_REQUIREMENTS_VERSION, reason, origin, acceptedSourceTypes: [...sources].sort(compare) as FactSourceType[], closestFactId: closest, refreshDueAt, covers: new Map() };
      orders.set(id, order);
    }
    order.covers.set(`${page.citySlug}/${page.topic}`, page);
    return id;
  };

  // --- explicit voluntary requests (optional requirements only), validated and deduplicated -------------------------
  const requestKey = (r: VoluntaryRequest) => `${r.citySlug}\u0000${r.topic}\u0000${r.requirementId}`;
  const requests = new Map<string, VoluntaryRequest>();
  const voluntaryIgnored: { citySlug: string | null; topic: string | null; requirementId: string | null; reason: VoluntaryIgnoredReason }[] = [];
  let requested = 0;
  for (const raw of Array.isArray(input.voluntaryCollection) ? input.voluntaryCollection : []) {
    requested += 1;
    const r = raw as Partial<VoluntaryRequest> | null;
    if (typeof r !== "object" || r === null || typeof r.citySlug !== "string" || !SLUG.test(r.citySlug) || !isKnownTopic(r.topic) || typeof r.requirementId !== "string" || r.requirementId === "") {
      voluntaryIgnored.push({ citySlug: typeof r?.citySlug === "string" ? r.citySlug : null, topic: typeof r?.topic === "string" ? r.topic : null, requirementId: typeof r?.requirementId === "string" ? r.requirementId : null, reason: "request_malformed" });
      continue;
    }
    requests.set(requestKey(r as VoluntaryRequest), { citySlug: r.citySlug, topic: r.topic, requirementId: r.requirementId });
  }
  const voluntaryOrdered = new Map<string, VoluntaryRequest>();
  const voluntaryHandled = new Set<string>();

  let assembliesRun = 0;
  for (const city of cities) {
    const countryCode = resolveCountryIso(city.country, table);
    for (const topic of topics) {
      const draft: Draft = {
        citySlug: city.slug, topic, countryCode, blockers: new Set(), warnings: new Set(), actions: [], rawAssemblyStatus: "not_assembled",
        overall: null, reasons: [], facts: new Set(), page: null, experimentalEligible: false,
      };
      drafts.push(draft);
      const pageRef = { citySlug: city.slug, topic };
      try {
        if (!isKnownTopic(topic) || asOfMs === null || !SLUG.test(city.slug)) {
          draft.blockers.add("invalid_request");
          draft.overall = "invalid_request";
          continue;
        }
        if (countryCode === null) {
          draft.blockers.add("country_iso_unknown");
          addDecision("country_iso_table", `${city.slug}/${topic}`);
          pushAction(draft, { kind: "decide", decisionId: "country_iso_table" });
          continue;
        }
        const scope: GeographicScope = { level: "city", countryCode, citySlug: city.slug };
        const report: TopicFactsReport = evaluateTopicFacts(registry, { target: scope, platform: PAGE_PLATFORM, propertyType, topic, asOf, use: "public" });
        draft.overall = report.overall;
        draft.reasons = [...report.reasons];
        if (report.overall === "invalid_request") {
          draft.blockers.add("invalid_request");
          continue;
        }
        const spec = TOPIC_REQUIREMENTS[topic];

        for (const requirementReport of report.requirements) {
          if (requirementReport.chosenFactId !== null && requirementReport.status !== "not_met") draft.facts.add(requirementReport.chosenFactId);
        }

        // blocked requirements: one blocker each, one order only when a new or renewed fact can fix it
        for (const missing of report.missing) {
          const requirementReport = report.requirements.find((r) => r.requirementId === missing.requirementId)!;
          const requirement = spec.required.find((r) => r.requirementId === missing.requirementId)!;
          for (const blocker of notMetBlockers(requirementReport)) {
            draft.blockers.add(blocker);
            if (blocker === "timezone_unvalidated") {
              const id = addOrder(scope, "timezone", "timezone", "absent", requirement.acceptableSourceTypes, null, null, pageRef);
              pushAction(draft, { kind: "collect", workOrderId: id });
            } else if (blocker === "facts_absent" || blocker === "facts_expired") {
              const sources = acceptedSources(requirement);
              if (sources.length < requirement.acceptableSourceTypes.length) {
                addDecision("audit_public_use_governance", `${city.slug}/${topic}`);
                pushAction(draft, { kind: "decide", decisionId: "audit_public_use_governance" });
              }
              if (sources.length > 0) {
                const chain = missing.closestFactId === null ? null : registry.getVersionChain(missing.closestFactId);
                const head = chain === null ? missing.closestFactId : chain[chain.length - 1]!.factId;
                const id = addOrder(scope, requirement.requirementId, "fact", blocker === "facts_expired" ? "expired" : "absent", sources, head, null, pageRef);
                pushAction(draft, { kind: "collect", workOrderId: id });
              }
            } else if (blocker === "facts_pending_validation" || blocker === "public_use_not_approved" || blocker === "approval_scope_excludes_topic") {
              if (missing.closestFactId !== null) pushAction(draft, { kind: "review_fact", factId: missing.closestFactId });
            } else if (blocker === "source_type_not_accepted") {
              pushAction(draft, { kind: "resource", requirementId: requirement.requirementId });
            } else if (blocker === "audit_governance_lock") {
              addDecision("audit_public_use_governance", `${city.slug}/${topic}`);
            }
          }
        }

        // explicit voluntary requests for this exact page: optional requirements only, never a blocker
        for (const request of requests.values()) {
          if (request.citySlug !== city.slug || request.topic !== topic) continue;
          const key = requestKey(request);
          voluntaryHandled.add(key);
          const requirement = spec.optional.find((r) => r.requirementId === request.requirementId);
          if (requirement === undefined) {
            voluntaryIgnored.push({ ...request, reason: "requirement_not_optional_for_topic" });
            continue;
          }
          const optionalReport = report.requirements.find((r) => !r.required && r.requirementId === request.requirementId);
          if (optionalReport === undefined || optionalReport.status !== "not_met") {
            voluntaryIgnored.push({ ...request, reason: "already_covered" });
            continue;
          }
          const sources = acceptedSources(requirement);
          if (sources.length === 0) {
            voluntaryIgnored.push({ ...request, reason: "no_collectible_source_type" });
            continue;
          }
          const unmet = notMetBlockers(optionalReport);
          let ordered = false;
          if (unmet.includes("timezone_unvalidated")) {
            pushAction(draft, { kind: "collect", workOrderId: addOrder(scope, "timezone", "timezone", "absent", requirement.acceptableSourceTypes, null, null, pageRef, "voluntary") });
            ordered = true;
          }
          if (unmet.includes("facts_absent") || unmet.includes("facts_expired")) {
            const chain = optionalReport.chosenFactId === null ? null : registry.getVersionChain(optionalReport.chosenFactId);
            const head = chain === null ? optionalReport.chosenFactId : chain[chain.length - 1]!.factId;
            pushAction(draft, { kind: "collect", workOrderId: addOrder(scope, requirement.requirementId, "fact", unmet.includes("facts_expired") ? "expired" : "absent", sources, head, null, pageRef, "voluntary") });
            ordered = true;
          }
          if (ordered) voluntaryOrdered.set(key, request);
          else voluntaryIgnored.push({ ...request, reason: "already_covered" });
        }

        // requirements that need a person
        for (const r of report.requirements.filter((x) => x.required && x.status === "needs_human_decision")) {
          if (r.conflictingFactIds.length > 0) draft.blockers.add("conflicting_facts");
          else if (r.primaryIssue === "overlaps_revoked_series") draft.blockers.add("revoked_series_overlap");
          else draft.blockers.add("threshold_unconfirmed");
        }
        if (report.reasons.includes("topic_requires_human_editorial_decision")) {
          if (spec.family === "universal") {
            draft.blockers.add("topic_requires_editorial_decision");
            draft.blockers.add("hub_proposal");
            pushAction(draft, { kind: "propose_hub_section_only", reason: "topic_has_no_local_value" });
          } else {
            // a local topic keeps its local identity: a person decides about the page, no universal hub is proposed
            draft.blockers.add("local_editorial_decision");
          }
        }
        if (report.reasons.includes("open_editorial_decision")) {
          draft.blockers.add("open_editorial_decision");
          addDecision(`open_decision:${topic}`, `${city.slug}/${topic}`);
        }

        // experimental relabelling: the ONLY obstacle is an unconfirmed draft threshold that the fact already passes
        draft.experimentalEligible =
          thresholdProfile === "experimental-pipeline-validation" &&
          report.overall === "needs_human_decision" &&
          report.reasons.length > 0 &&
          report.reasons.every((reason) => reason.startsWith("provisional_threshold_not_confirmed:")) &&
          report.requirements.filter((r) => r.required && r.status === "needs_human_decision").every((r) => r.provisionalChecks.length > 0 && r.provisionalChecks.every((c) => c.wouldPass));

        // competing validated qualitative notes: the registry resolves them silently (newest wins), so report them
        for (const requirement of spec.required) {
          if (requirement.kind !== "qualitative") continue;
          const notes = registry
            .findFacts({ target: scope, platform: PAGE_PLATFORM, propertyType, topic })
            .filter((fact) => fact.kind === "qualitative" && fact.value.category === requirement.category && fact.validation.status === "human_validated" && !registry.isSuperseded(fact.factId));
          if (new Set(notes.map((fact) => fact.factId)).size > 1) draft.warnings.add("competing_qualitative_notes");
        }

        // renewals: a fact in use that will stop qualifying within the lookahead
        for (const r of report.requirements) {
          if (r.chosenFactId === null || r.status === "not_met") continue;
          const requirement = [...spec.required, ...spec.optional].find((x) => x.requirementId === r.requirementId)!;
          const fact = registry.get(r.chosenFactId);
          if (fact === undefined) continue;
          const ageRef = ageReferenceMs(fact);
          const validUntil = parseIsoDateTime(fact.validUntil);
          const candidates = [validUntil, ageRef === null ? null : ageRef + requirement.maxAgeDays * DAY_MS].filter((x): x is number => x !== null);
          if (candidates.length === 0) continue;
          const due = Math.min(...candidates);
          if (due > asOfMs && due - asOfMs <= lookaheadDays * DAY_MS) {
            const chain = registry.getVersionChain(r.chosenFactId);
            const head = chain === null ? r.chosenFactId : chain[chain.length - 1]!.factId;
            const sources = acceptedSources(requirement);
            if (sources.length > 0) {
              const id = addOrder(scope, requirement.requirementId, "fact", "renewal_due", sources, head, new Date(due).toISOString(), pageRef);
              if (r.required) pushAction(draft, { kind: "collect", workOrderId: id });
            }
          }
        }

        // assembly only when the topic facts are all met: blocked or undecided pages cannot be ready
        if (report.overall === "all_required_met") {
          assembliesRun += 1;
          const assembled = assembleGeneratedPage({ registry, catalog, target: scope, platform: PAGE_PLATFORM, propertyType, topic, asOf, language: "en" });
          draft.rawAssemblyStatus = assembled.status;
          if (assembled.status === "ready_for_editorial_review") draft.page = assembled.page;
          else {
            draft.blockers.add("assembly_not_ready");
            draft.reasons.push(...assembled.reasons.map((reason) => `assembly:${reason}`));
          }
        }
      } catch {
        // total function: a registry or contract that throws makes this page invalid, never the whole run
        draft.blockers.add("invalid_request");
        draft.overall = "invalid_request";
      }
    }
  }

  // --- per-city pass: facts shared by several topics, and near-identical rendered pages ----------------------
  const reuse = new Map<string, number>();
  const byCity = new Map<string, Draft[]>();
  for (const draft of drafts) {
    if (!byCity.has(draft.citySlug)) byCity.set(draft.citySlug, []);
    byCity.get(draft.citySlug)!.push(draft);
  }
  for (const group of byCity.values()) {
    const topicsByFact = new Map<string, Draft[]>();
    for (const draft of group) for (const factId of draft.facts) topicsByFact.set(factId, [...(topicsByFact.get(factId) ?? []), draft]);
    for (const [factId, users] of topicsByFact) {
      if (users.length < 2) continue;
      reuse.set(factId, (reuse.get(factId) ?? 0) + users.length);
      for (const draft of users) draft.warnings.add("shared_fact_across_topics");
    }
    const rendered = group.filter((draft) => draft.page !== null).map((draft) => ({ key: draft.topic, page: draft.page! }));
    if (rendered.length > 1) {
      for (const pair of comparePages(rendered).pairs) {
        if (!pair.templateIdentical) continue;
        for (const draft of group) if (draft.topic === pair.a || draft.topic === pair.b) draft.blockers.add("duplicate_across_topics");
      }
    }
  }

  // --- final entries ----------------------------------------------------------------------------------------------
  const summary: Record<CoverageClassName, number> = {
    candidate_for_editorial_review: 0, experimental_candidate: 0, needs_data: 0, needs_review_queue: 0, needs_resourcing: 0, needs_human_decision: 0, invalid: 0,
  };
  const entries: CoverageEntry[] = drafts.map((draft) => {
    const blockers = BLOCKER_ORDER.filter((code) => draft.blockers.has(code));
    if (draft.facts.size > 0 && draft.facts.size < DIFFERENTIATION_TARGET_DISTINCT_FACTS) draft.warnings.add("below_distinct_fact_target");
    const experimental = draft.experimentalEligible && blockers.every((code) => code === "threshold_unconfirmed");
    const coverageClass: CoverageClassName = experimental
      ? "experimental_candidate"
      : blockers.length === 0
        ? "candidate_for_editorial_review"
        : CLASS_OF_BLOCKER[blockers[0]!];
    summary[coverageClass] += 1;
    const actions = [...draft.actions];
    for (const code of blockers) {
      const decisionId = DECISION_OF_BLOCKER[code];
      if (decisionId !== undefined) {
        addDecision(decisionId, `${draft.citySlug}/${draft.topic}`);
        if (code !== "country_iso_unknown" && !actions.some((a) => a.kind === "decide" && a.decisionId === decisionId)) actions.push({ kind: "decide", decisionId });
      }
    }
    return {
      citySlug: draft.citySlug, topic: draft.topic, countryCode: draft.countryCode, coverageClass, experimentalOnly: coverageClass === "experimental_candidate",
      blockers, warnings: [...draft.warnings].sort(compare) as WarningCode[], actions, rawAssemblyStatus: draft.rawAssemblyStatus, topicFactsOverall: draft.overall,
      reasons: draft.reasons, distinctFactCount: draft.facts.size, publicationAuthorised: false, indexingAuthorised: false,
    };
  });
  entries.sort((a, b) => compare(a.citySlug, b.citySlug) || compare(a.topic, b.topic));

  const workOrders: WorkOrder[] = [...orders.values()]
    .map(({ covers, ...order }) => ({ ...order, coversPages: [...covers.values()].sort((a, b) => compare(a.citySlug, b.citySlug) || compare(a.topic, b.topic)) }))
    .sort((a, b) => compare(a.id, b.id));

  return deepFreeze({
    meta: {
      classifierVersion: CLASSIFIER_VERSION, requirementsVersion: TOPIC_REQUIREMENTS_VERSION, assemblerRuleVersion: ASSEMBLER_RULE_VERSION, registrySnapshotId, asOf,
      thresholdProfile, catalogId: catalog.catalogId, platform: PAGE_PLATFORM, propertyType, refreshLookaheadDays: lookaheadDays,
      ignoredDuplicateCitySlugs: [...new Set(ignored)].sort(compare), countryIsoTableProblems: [...validateCountryIsoTable(table)],
    },
    entries,
    workOrders,
    voluntaryCollection: {
      requested,
      ordered: [...voluntaryOrdered.values()].sort((a, b) => compare(requestKey(a), requestKey(b))),
      ignored: [
        ...voluntaryIgnored,
        ...[...requests.entries()].filter(([key]) => !voluntaryHandled.has(key)).map(([, r]) => ({ ...r, reason: (cities.some((c) => c.slug === r.citySlug) ? "topic_not_in_run" : "city_not_in_run") as VoluntaryIgnoredReason })),
      ].sort((a, b) => compare(`${a.citySlug}/${a.topic}/${a.requirementId}/${a.reason}`, `${b.citySlug}/${b.topic}/${b.requirementId}/${b.reason}`)),
    },
    decisionsRequired: [...decisions.entries()].map(([id, pages]) => ({ id, blocksPages: pages.size })).sort((a, b) => compare(a.id, b.id)),
    factReuse: [...reuse.entries()].map(([factId, pages]) => ({ factId, pages })).sort((a, b) => compare(a.factId, b.factId)),
    summary,
    stats: { pagesEvaluated: entries.length, assembliesRun, readyCount: summary.candidate_for_editorial_review, experimentalCount: summary.experimental_candidate },
  });
}

/** Canonical text of a report: identical inputs give identical bytes. */
export function serializeCoverageReport(report: CoverageReport): string {
  return stableStringify(report);
}
