/**
 * SEO generator V3 — are the facts for a place and a topic sufficient? (pure, deterministic)
 *
 * This reports on FACTS. It does not decide editorial eligibility (that is a later step) and it says
 * nothing about indexing. It never turns uncertainty into permission: an unconfirmed provisional
 * threshold, an open editorial decision, a topic that needs a human choice, or CONTRADICTORY facts
 * all yield `needs_human_decision`, never `all_required_met`.
 *
 * The scope of a request is explicit and exact (geography, platform, property type): nothing is
 * assumed equivalent. Contradictions are reported with the ids of the facts involved and never with
 * their values.
 */
import { parseIsoDateTime } from "./dates";
import type { FactRegistry } from "./factRegistry";
import {
  ageReferenceMs,
  describedRange,
  evaluateRequirement,
  factMatchesRequirement,
  type FactUse,
  type ProvisionalCheck,
  type RequirementVerdict,
} from "./factUse";
import type { FactId, FactPlatform, FactPropertyType, GeographicScope, LocalFact } from "./localFact";
import { TOPIC_REQUIREMENTS, type FactRequirement, type MissingFact, type MissingFactReason } from "./topicRequirements";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export type TopicFactsOverall =
  | "all_required_met"
  | "blocked"
  | "needs_human_decision"
  | "invalid_request";

export type RequirementReport = Readonly<{
  requirementId: string;
  required: boolean;
  status: RequirementVerdict["status"];
  /** The fact retained for this requirement; null when none qualifies or when facts contradict. */
  chosenFactId: FactId | null;
  reason: MissingFactReason | null;
  /** Precise cause of a refusal (revoked, rejected, superseded, expired, …), finer than `reason`. */
  primaryIssue: string | null;
  issues: readonly string[];
  provisionalChecks: readonly ProvisionalCheck[];
  /** Ids (sorted) of usable facts that contradict each other; empty when there is no contradiction. */
  conflictingFactIds: readonly FactId[];
  /** Revoked facts of the series that the retained fact overlaps and no arbitration covers yet. */
  revokedOverlapFactIds: readonly FactId[];
}>;

export type TopicFactsReport = Readonly<{
  /** The requested place; null when the request itself was invalid (raw input is never echoed back). */
  target: GeographicScope | null;
  platform: FactPlatform;
  propertyType: FactPropertyType;
  /** A known topic slug, or "<unknown>" for an invalid request. */
  topic: string;
  use: FactUse;
  asOf: string;
  overall: TopicFactsOverall;
  requirements: readonly RequirementReport[];
  /** Unmet REQUIRED requirements, in the S1 vocabulary. Optional gaps are only listed in `requirements`. */
  missing: readonly MissingFact[];
  openDecision: string | null;
  /** Why the overall state is not all_required_met. Empty when it is. */
  reasons: readonly string[];
}>;

export type TopicFactsParams = Readonly<{
  /** Exact geography of the page: country, city or district. */
  target: GeographicScope;
  /** `null` = a platform-neutral page; a platform fact never answers it, and vice versa. */
  platform: FactPlatform;
  propertyType: FactPropertyType;
  topic: string;
  asOf: string;
  /** Required and explicit: there is no default use. */
  use: FactUse;
}>;

const PLATFORMS = ["airbnb", "booking", "expedia", "agoda", "vrbo"];
const PROPERTY_TYPES = ["studio", "apartment", "villa", "riad", "room", "hotel"];

const STATUS_RANK: Readonly<Record<RequirementVerdict["status"], number>> = {
  met: 0,
  needs_human_decision: 1,
  not_met: 2,
};

function isKnownTopic(topic: string): topic is LocalSeoTopicSlug {
  return (LOCAL_SEO_TOPIC_SLUGS as readonly string[]).includes(topic);
}

function targetProblem(params: TopicFactsParams): string | null {
  const target = params.target as unknown as Record<string, unknown> | null;
  if (typeof target !== "object" || target === null) return "invalid_target";
  if (typeof target.countryCode !== "string" || !/^[A-Z]{2}$/.test(target.countryCode)) return "invalid_target";
  if (target.level === "city" || target.level === "district") {
    if (typeof target.citySlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.citySlug)) return "invalid_target";
    if (target.level === "district" && (typeof target.districtName !== "string" || target.districtName.trim() === "")) return "invalid_target";
  } else if (target.level !== "country") {
    return "invalid_target";
  }
  if (params.platform !== null && !PLATFORMS.includes(params.platform as string)) return "invalid_platform";
  if (params.propertyType !== null && !PROPERTY_TYPES.includes(params.propertyType as string)) return "invalid_property_type";
  return null;
}

// --- Contradictions ---------------------------------------------------------------------------

const normalizeName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const normalizeUnit = (unit: string | null) => (unit ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const PERCENTILES = ["p10", "p25", "p75", "p90"] as const;

/**
 * Do two facts about the same thing state incompatible values? Sample size alone never counts:
 * a different sample is not a different answer. A percentile only counts when both facts give it.
 */
function valuesDiffer(a: LocalFact, b: LocalFact): boolean {
  if (a.kind === "quantitative" && b.kind === "quantitative") {
    const x = a.value;
    const y = b.value;
    if (x.metric !== y.metric) return false;
    if (x.metric === "nightly_price_distribution" && y.metric === "nightly_price_distribution") {
      if (x.currency !== y.currency || normalizeUnit(a.unit ?? x.currency) !== normalizeUnit(b.unit ?? y.currency)) return true;
      if (x.median !== y.median) return true;
      return PERCENTILES.some((key) => x[key] !== undefined && y[key] !== undefined && x[key] !== y[key]);
    }
    if (x.metric === "calendar_unavailability_rate" && y.metric === "calendar_unavailability_rate") {
      return x.ratio !== y.ratio;
    }
    if (x.metric === "official_statistic" && y.metric === "official_statistic") {
      if (normalizeName(x.name) !== normalizeName(y.name)) return false; // not the same quantity
      return x.value !== y.value || normalizeUnit(a.unit) !== normalizeUnit(b.unit);
    }
    return false;
  }
  if (a.kind === "regulatory" && b.kind === "regulatory") {
    if (a.value.ruleType !== b.value.ruleType) return false;
    const la = a.value.limit ?? null;
    const lb = b.value.limit ?? null;
    // S5.4-L/M: two structured limits are compared field by field and their free text is ignored (it is not rendered);
    // otherwise the earlier comparison of the rule text applies
    if (la !== null && lb !== null) {
      return la.direction !== lb.direction || la.value !== lb.value || la.unit !== lb.unit || la.per !== lb.per || la.condition !== lb.condition;
    }
    return a.value.rule.trim() !== b.value.rule.trim();
  }
  if (a.kind === "geographic" && b.kind === "geographic") {
    return a.value.attribute === b.value.attribute && a.value.value !== b.value.value;
  }
  // Two qualitative statements about the same category complement each other; they cannot be
  // shown to contradict without reading them, so they are not flagged here.
  return false;
}

/**
 * Two facts truly contradict when they describe the same thing (same segment is guaranteed by the
 * exact lookup) over OVERLAPPING time and state different values. Observations of disjoint periods
 * are not contradictions: they are successive measurements.
 */
export function factsContradict(a: LocalFact, b: LocalFact): boolean {
  if (a.factId === b.factId || a.kind !== b.kind || !valuesDiffer(a, b)) return false;
  const ra = describedRange(a);
  const rb = describedRange(b);
  if (ra === null || rb === null) return true;
  return ra[0] < rb[1] && rb[0] < ra[1];
}

// --- One requirement --------------------------------------------------------------------------

function evaluateOne(
  registry: FactRegistry,
  requirement: FactRequirement,
  required: boolean,
  candidates: readonly LocalFact[],
  params: { asOf: string; use: FactUse; topic: LocalSeoTopicSlug },
): RequirementReport {
  const matching = candidates.filter((fact) => factMatchesRequirement(fact, requirement));
  if (matching.length === 0) {
    return Object.freeze({
      requirementId: requirement.requirementId,
      required,
      status: "not_met",
      chosenFactId: null,
      reason: "absent",
      primaryIssue: "no_matching_fact",
      issues: Object.freeze(["no_matching_fact"]),
      provisionalChecks: Object.freeze([]),
      conflictingFactIds: Object.freeze([]),
      revokedOverlapFactIds: Object.freeze([]),
    });
  }

  const scored = matching.map((fact) => ({
    fact,
    verdict: evaluateRequirement(fact, requirement, {
      ...params,
      superseded: registry.isSuperseded(fact.factId),
      timeZone: fact.kind === "regulatory" ? registry.resolveTimeZone(fact.scope, params.asOf) : null,
      unresolvedRevokedOverlap: registry.unresolvedRevokedOverlaps(fact.factId, params.asOf).length > 0,
    }),
  }));

  // Contradictions among facts that could otherwise be used: never resolved silently.
  const usable = scored.filter((entry) => entry.verdict.status !== "not_met");
  const involved = new Set<FactId>();
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      if (factsContradict(usable[i]!.fact, usable[j]!.fact)) {
        involved.add(usable[i]!.fact.factId);
        involved.add(usable[j]!.fact.factId);
      }
    }
  }
  if (involved.size > 0) {
    return Object.freeze({
      requirementId: requirement.requirementId,
      required,
      status: "needs_human_decision",
      chosenFactId: null,
      reason: null,
      primaryIssue: "conflicting_facts",
      issues: Object.freeze(["conflicting_facts"]),
      provisionalChecks: Object.freeze([]),
      conflictingFactIds: Object.freeze([...involved].sort()),
      revokedOverlapFactIds: Object.freeze([]),
    });
  }

  // Best first: better status, then the head of a version chain before the versions it replaced
  // (so a refusal is explained by the fact that currently stands), then the most recent reference
  // date, then id (a total order).
  scored.sort((a, b) => {
    const rank = STATUS_RANK[a.verdict.status] - STATUS_RANK[b.verdict.status];
    if (rank !== 0) return rank;
    const replaced = Number(registry.isSuperseded(a.fact.factId)) - Number(registry.isSuperseded(b.fact.factId));
    if (replaced !== 0) return replaced;
    const aRef = ageReferenceMs(a.fact) ?? 0;
    const bRef = ageReferenceMs(b.fact) ?? 0;
    if (aRef !== bRef) return bRef - aRef;
    return a.fact.factId < b.fact.factId ? -1 : 1;
  });
  const best = scored[0]!;
  return Object.freeze({
    requirementId: requirement.requirementId,
    required,
    status: best.verdict.status,
    chosenFactId: best.fact.factId,
    reason: best.verdict.reason,
    primaryIssue: best.verdict.primaryIssue,
    issues: best.verdict.issues,
    provisionalChecks: best.verdict.provisionalChecks,
    conflictingFactIds: Object.freeze([]),
    revokedOverlapFactIds: registry.unresolvedRevokedOverlaps(best.fact.factId, params.asOf),
  });
}

// --- The topic --------------------------------------------------------------------------------

export function evaluateTopicFacts(registry: FactRegistry, params: TopicFactsParams): TopicFactsReport {
  const base = {
    target: params.target,
    platform: params.platform,
    propertyType: params.propertyType,
    topic: params.topic,
    use: params.use,
    asOf: params.asOf,
  };
  // An invalid request is reported by reason only: none of the offending input is echoed back.
  const invalid = (reason: string): TopicFactsReport =>
    Object.freeze({
      target: null,
      platform: null,
      propertyType: null,
      topic: "<unknown>",
      use: params.use === "public" ? "public" : "internal",
      asOf: "<invalid>",
      overall: "invalid_request",
      requirements: Object.freeze([]),
      missing: Object.freeze([]),
      openDecision: null,
      reasons: Object.freeze([reason]),
    });

  if (!isKnownTopic(params.topic)) return invalid("unknown_topic");
  if (parseIsoDateTime(params.asOf) === null) return invalid("invalid_as_of");
  if (params.use !== "internal" && params.use !== "public") return invalid("invalid_use");
  const problem = targetProblem(params);
  if (problem !== null) return invalid(problem);

  const topic = params.topic;
  const spec = TOPIC_REQUIREMENTS[topic];
  const candidates = registry.findFacts({
    target: params.target,
    platform: params.platform,
    propertyType: params.propertyType,
    topic,
  });
  const context = { asOf: params.asOf, use: params.use, topic };

  const reports: RequirementReport[] = [
    ...spec.required.map((requirement) => evaluateOne(registry, requirement, true, candidates, context)),
    ...spec.optional.map((requirement) => evaluateOne(registry, requirement, false, candidates, context)),
  ];

  const requiredReports = reports.filter((report) => report.required);
  const missing: MissingFact[] = requiredReports
    .filter((report) => report.status === "not_met")
    .map((report) => {
      const requirement = spec.required.find((entry) => entry.requirementId === report.requirementId)!;
      return Object.freeze({
        requirementId: report.requirementId,
        kind: requirement.kind,
        topic,
        reason: report.reason ?? "absent",
        closestFactId: report.chosenFactId,
      });
    });

  const reasons: string[] = [];
  for (const report of requiredReports) {
    if (report.status === "not_met") {
      reasons.push(`required_requirement_not_met:${report.requirementId}:${report.primaryIssue ?? "unknown"}`);
    }
  }

  let overall: TopicFactsOverall;
  if (missing.length > 0) {
    overall = "blocked";
  } else {
    for (const report of requiredReports) {
      if (report.status !== "needs_human_decision") continue;
      reasons.push(
        report.conflictingFactIds.length > 0
          ? `conflicting_facts:${report.requirementId}`
          : report.primaryIssue === "overlaps_revoked_series"
            ? `revoked_series_overlap:${report.requirementId}`
            : `provisional_threshold_not_confirmed:${report.requirementId}`,
      );
    }
    if (spec.standalonePolicy === "requires_human_editorial_decision") {
      reasons.push("topic_requires_human_editorial_decision");
    }
    if (spec.openDecision !== null) reasons.push("open_editorial_decision");
    overall = reasons.length > 0 ? "needs_human_decision" : "all_required_met";
  }

  return Object.freeze({
    ...base,
    overall,
    requirements: Object.freeze(reports),
    missing: Object.freeze(missing),
    openDecision: spec.openDecision,
    reasons: Object.freeze(reasons),
  });
}
