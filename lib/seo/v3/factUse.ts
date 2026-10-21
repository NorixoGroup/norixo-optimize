/**
 * SEO generator V3 — may this fact be used? (pure, deterministic, fail closed)
 *
 * Two uses are distinguished and never conflated:
 *  - "internal": analysis and drafting. A fact still under review may be read, a draft may not.
 *  - "public"  : anything a visitor could see. Requires human validation AND an explicit, scoped
 *                approval, and honours the source's own publication restrictions.
 *
 * The evaluation instant (`asOf`) is always an argument; nothing here reads the clock. Every moment a
 * fact depends on (collection, validation, approval, rule entry into force) must already have
 * happened at `asOf`. Any doubt (unparseable date, unknown value, ambiguous authorisation)
 * resolves to "not usable".
 *
 * Audit-derived facts (`user_audit_aggregate`) are locked out of public use by default, whatever
 * else is true of them: see AUDIT_PUBLIC_USE_LOCK.
 */
import { civilDayEndExclusiveUtcMs, civilDayStartUtcMs, DAY_MS, isValidIanaTimeZone, parseIsoDate, parseIsoDateTime } from "./dates";
import type { FactConfidenceLevel, FactId, LocalFact } from "./localFact";
import type { FactRequirement, MissingFactReason } from "./topicRequirements";
import type { LocalSeoTopicSlug } from "./topics";

export type FactUse = "internal" | "public";

/**
 * Explicit, deliberately DISABLED switch. While `unlocked` is false, no audit-derived fact can be
 * used publicly, even if it is validated, approved, permissively licensed and aggregated. Enabling
 * it is a separate decision for a later phase (and a code change reviewed as such); the readiness
 * checks below remain in force afterwards.
 */
export const AUDIT_PUBLIC_USE_LOCK: Readonly<{ unlocked: boolean }> = Object.freeze({ unlocked: false });

/**
 * Smallest sample an audit-derived measured figure may rest on before being shown. Mirrors the hard
 * floor of the Intelligence V2 public overview (fewer than 5 is never public). PROVISIONAL: it is a
 * safety floor, not a final statistical policy, and says nothing about whether a figure is
 * representative.
 */
export const AUDIT_MIN_SAMPLE_PROVISIONAL = 5;

export type UseIssueCode =
  | "invalid_as_of"
  | "not_yet_collected"
  | "expired"
  | "revoked"
  | "rejected"
  | "superseded"
  | "not_validated"
  | "validation_in_future"
  | "approval_in_future"
  | "public_use_forbidden"
  | "public_use_not_approved"
  | "approval_scope_excludes_topic"
  | "approval_scope_too_broad_for_audit_data"
  | "approval_before_validation"
  | "rule_not_yet_in_force"
  | "rule_no_longer_in_force"
  | "rule_timezone_unknown"
  | "overlaps_revoked_series"
  | "source_terms_not_verified"
  | "source_forbids_public_use"
  | "source_requires_licence_check"
  | "source_forbids_derivative_figures"
  | "source_aggregate_only"
  | "attribution_constraint_missing"
  | "audit_public_use_locked"
  | "audit_consent_reference_missing"
  | "audit_terms_not_verified"
  | "audit_aggregation_not_attested"
  | "audit_sample_below_floor"
  | "audit_provenance_incomplete";

export type UseIssue = Readonly<{ code: UseIssueCode; message: string }>;

export type FactUseAssessment = Readonly<{
  factId: FactId;
  use: FactUse;
  usable: boolean;
  issues: readonly UseIssue[];
}>;

export type FactUseParams = Readonly<{
  asOf: string;
  use: FactUse;
  /** Topic the fact would be used for; null when no topic is involved (approval scope then cannot be checked). */
  topic: LocalSeoTopicSlug | null;
  /** Supplied by the registry, which knows the replacement chain. */
  superseded: boolean;
  /**
   * IANA zone of the rule's jurisdiction, from a validated timezone fact, or null when unknown.
   * Only read for regulatory facts; a rule is never evaluated in a guessed zone (UTC is not a default).
   */
  timeZone: string | null;
  /**
   * True when this fact overlaps a revoked fact of its series (outside its own replacement chain)
   * and no human arbitration covers it yet. Only matters for public use.
   */
  unresolvedRevokedOverlap: boolean;
}>;

/**
 * What an audit-derived fact still lacks before public use could even be considered. These checks
 * are independent of the lock and are never treated as satisfied by a human approval alone.
 * Returns an empty list for facts that are not audit-derived.
 */
export function auditPublicUseReadiness(fact: LocalFact): readonly UseIssue[] {
  if (fact.source.sourceType !== "user_audit_aggregate") return [];
  const issues: UseIssue[] = [];
  const add = (code: UseIssueCode, message: string) => issues.push({ code, message });
  const source = fact.source;

  if (source.termsOfUse.reference === null || source.termsOfUse.reference.trim().length === 0) {
    add("audit_consent_reference_missing", "No reference to the user consent or terms that cover this use.");
  }
  if (source.termsOfUse.status !== "verified_permissive") {
    add("audit_terms_not_verified", "The consent/terms covering publication are not verified as permissive.");
  }
  if (!source.publicationRestrictions.includes("aggregate_only")) {
    add("audit_aggregation_not_attested", "Nothing attests that this figure is an aggregate (aggregate_only is absent).");
  }
  // Every audit metric must carry a checkable sample; none at all is as bad as a small one.
  const sample =
    fact.kind === "quantitative" && fact.value.metric !== "official_statistic" ? fact.value.sampleSize : null;
  if (sample === null || sample < AUDIT_MIN_SAMPLE_PROVISIONAL) {
    add("audit_sample_below_floor", "The sample is missing or below the provisional safety floor.");
  }
  const verifiable =
    source.locator.kind === "internal_reference" &&
    source.evidence.some((anchor) => anchor.kind === "internal_record" || anchor.kind === "content_hash" || anchor.kind === "archive_reference");
  if (!verifiable) add("audit_provenance_incomplete", "Provenance is not verifiable (internal reference and a record, hash or archive are required).");
  return issues;
}

export function assessFactUse(fact: LocalFact, params: FactUseParams): FactUseAssessment {
  const issues: UseIssue[] = [];
  const add = (code: UseIssueCode, message: string) => issues.push({ code, message });

  const asOf = parseIsoDateTime(params.asOf);
  if (asOf === null) {
    add("invalid_as_of", "asOf is not a real date-time with a time zone.");
  } else {
    const collectedAt = parseIsoDateTime(fact.collectedAt);
    const validUntil = parseIsoDateTime(fact.validUntil);
    if (collectedAt === null || validUntil === null) {
      add("expired", "The fact dates cannot be read.");
    } else {
      if (asOf < collectedAt) add("not_yet_collected", "The fact was collected after the evaluation instant.");
      if (asOf >= validUntil) add("expired", "The fact is past its validUntil date.");
    }

    // Validation must already have happened at asOf.
    const validation = fact.validation;
    if (validation.status === "pending_review") {
      const submitted = parseIsoDateTime(validation.submittedAt);
      if (submitted === null || submitted > asOf) add("validation_in_future", "The review was submitted after the evaluation instant.");
    }
    if (validation.status === "human_validated") {
      const validated = parseIsoDateTime(validation.validatedAt);
      if (validated === null || validated > asOf) add("validation_in_future", "The human validation happens after the evaluation instant.");
    }

    // Regulatory rules must be in force at asOf, with their civil dates read in the jurisdiction's
    // own time zone (effectiveFrom: start of that day; effectiveUntil: through the end of that day).
    // Without a known zone nothing is assumed: the rule is refused.
    if (fact.kind === "regulatory") {
      if (params.timeZone === null || !isValidIanaTimeZone(params.timeZone)) {
        add("rule_timezone_unknown", "The jurisdiction's time zone is unknown, so the rule dates cannot be evaluated.");
      } else {
        const from = fact.value.effectiveFrom === null ? null : civilDayStartUtcMs(fact.value.effectiveFrom, params.timeZone);
        const until = fact.value.effectiveUntil === null ? null : civilDayEndExclusiveUtcMs(fact.value.effectiveUntil, params.timeZone);
        if ((fact.value.effectiveFrom !== null && from === null) || (fact.value.effectiveUntil !== null && until === null)) {
          add("rule_not_yet_in_force", "The rule dates cannot be read in the jurisdiction's time zone.");
        } else {
          if (from !== null && asOf < from) add("rule_not_yet_in_force", "The rule is not yet in force.");
          if (until !== null && asOf >= until) add("rule_no_longer_in_force", "The rule is no longer in force.");
        }
      }
    }
  }

  const status = fact.validation.status;
  if (status === "revoked") add("revoked", "The fact has been revoked.");
  if (status === "rejected") add("rejected", "The fact has been rejected.");
  if (params.superseded) add("superseded", "A newer version replaces this fact.");
  if (params.use === "public" && params.unresolvedRevokedOverlap) {
    add("overlaps_revoked_series", "This observation overlaps a revoked fact of its series and no human arbitration covers it.");
  }

  if (params.use === "internal") {
    if (status === "draft") add("not_validated", "A draft fact cannot be used, even internally.");
  } else {
    if (status !== "human_validated") add("not_validated", "Public use requires human validation.");
    assessPublicUse(fact, params.topic, asOf, add);
  }

  return Object.freeze({
    factId: fact.factId,
    use: params.use,
    usable: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

function assessPublicUse(
  fact: LocalFact,
  topic: LocalSeoTopicSlug | null,
  asOf: number | null,
  add: (code: UseIssueCode, message: string) => void,
): void {
  const use = fact.usage.use;
  if (use.publicUse === "forbidden") {
    add("public_use_forbidden", "Public use is forbidden for this fact.");
  } else if (use.publicUse !== "approved") {
    add("public_use_not_approved", "Public use has not been approved.");
  } else {
    const scope = use.approval.scope;
    if (scope !== "any_topic") {
      if (topic === null) add("approval_scope_excludes_topic", "The approval is topic-scoped and no topic was given.");
      else if (!scope.includes(topic)) add("approval_scope_excludes_topic", "The approval does not cover this topic.");
    }
    if (fact.source.sourceType === "user_audit_aggregate" && scope === "any_topic") {
      add("approval_scope_too_broad_for_audit_data", "Audit-derived data needs an explicit topic list, not any_topic.");
    }
    const approvedAt = parseIsoDateTime(use.approval.approvedAt);
    if (approvedAt === null) {
      add("approval_in_future", "The approval date cannot be read.");
    } else {
      if (asOf !== null && approvedAt > asOf) add("approval_in_future", "The approval happens after the evaluation instant.");
      if (fact.validation.status === "human_validated") {
        const validatedAt = parseIsoDateTime(fact.validation.validatedAt);
        if (validatedAt === null || approvedAt < validatedAt) {
          add("approval_before_validation", "The approval must follow the human validation.");
        }
      }
    }
  }

  const source = fact.source;
  if (source.termsOfUse.status !== "verified_permissive") {
    add("source_terms_not_verified", "The source's terms of use are not verified as permissive.");
  }
  const restrictions = source.publicationRestrictions;
  if (restrictions.includes("no_public_use")) add("source_forbids_public_use", "The source forbids public use.");
  if (restrictions.includes("requires_licence_check")) {
    add("source_requires_licence_check", "The source requires a licence check that has not been recorded.");
  }
  if (restrictions.includes("no_derivative_figures") && fact.kind === "quantitative") {
    add("source_forbids_derivative_figures", "The source forbids publishing figures derived from it.");
  }
  if (restrictions.includes("aggregate_only") && fact.kind !== "quantitative") {
    add("source_aggregate_only", "The source may only be published in aggregate form.");
  }
  if (restrictions.includes("attribution_required") && !fact.usage.displayConstraints.includes("attribute_source")) {
    add("attribution_constraint_missing", "Attribution is required but the fact does not carry attribute_source.");
  }

  // Audit-derived facts: locked by default, and never public on an approval alone.
  if (source.sourceType === "user_audit_aggregate") {
    if (!AUDIT_PUBLIC_USE_LOCK.unlocked) {
      add("audit_public_use_locked", "Public use of audit-derived data is locked pending a separate decision.");
    }
    for (const issue of auditPublicUseReadiness(fact)) add(issue.code, issue.message);
  }
}

// --- Topic requirements -----------------------------------------------------------------------

const CONFIDENCE_ORDER: Readonly<Record<FactConfidenceLevel, number>> = {
  very_low: 0,
  low: 1,
  moderate: 2,
  high: 3,
  very_high: 4,
};

/** True when the fact is of the kind, and for the metric/category/rule/attribute, the requirement names. */
export function factMatchesRequirement(fact: LocalFact, requirement: FactRequirement): boolean {
  if (fact.kind !== requirement.kind) return false;
  switch (requirement.kind) {
    case "quantitative":
      return fact.kind === "quantitative" && fact.value.metric === requirement.metric;
    case "qualitative":
      return fact.kind === "qualitative" && fact.value.category === requirement.category;
    case "regulatory":
      return (
        fact.kind === "regulatory" &&
        (requirement.ruleType === "any" ||
          (typeof requirement.ruleType === "string"
            ? fact.value.ruleType === requirement.ruleType
            : requirement.ruleType.includes(fact.value.ruleType)))
      );
    case "geographic":
      return fact.kind === "geographic" && fact.value.attribute === requirement.attribute;
  }
}

/** Reference date for ageing: end of the observed period (that whole day), else the collection instant. */
export function ageReferenceMs(fact: LocalFact): number | null {
  if (fact.observedPeriod !== null) {
    const end = parseIsoDate(fact.observedPeriod.end);
    return end === null ? null : end + DAY_MS;
  }
  return parseIsoDateTime(fact.collectedAt);
}

function sampleSizeOf(fact: LocalFact): number | null {
  if (fact.kind !== "quantitative") return null;
  const value = fact.value;
  return value.metric === "official_statistic" ? null : value.sampleSize;
}

export type ProvisionalCheck = Readonly<{
  check: "confidence" | "age" | "sample";
  /** What the draft threshold would give. Informational only: it never authorises anything. */
  wouldPass: boolean;
}>;

export type RequirementVerdict = Readonly<{
  status: "met" | "not_met" | "needs_human_decision";
  /** Reason mapped onto the S1 missing-fact vocabulary when the status is not_met. */
  reason: MissingFactReason | null;
  /**
   * The precise code behind a refusal (revoked, rejected, superseded, expired, …). The S1 reason
   * vocabulary is coarser; this keeps the distinction.
   */
  primaryIssue: string | null;
  issues: readonly string[];
  provisionalChecks: readonly ProvisionalCheck[];
}>;

function mapUseIssue(code: UseIssueCode): MissingFactReason {
  switch (code) {
    case "expired":
    case "rule_no_longer_in_force":
      return "expired";
    case "not_validated":
    case "validation_in_future":
    case "approval_before_validation":
      return "not_validated";
    case "public_use_forbidden":
    case "public_use_not_approved":
    case "approval_in_future":
    case "approval_scope_excludes_topic":
    case "approval_scope_too_broad_for_audit_data":
    case "source_terms_not_verified":
    case "source_forbids_public_use":
    case "source_requires_licence_check":
    case "source_forbids_derivative_figures":
    case "source_aggregate_only":
    case "attribution_constraint_missing":
    case "audit_public_use_locked":
    case "audit_consent_reference_missing":
    case "audit_terms_not_verified":
    case "audit_aggregation_not_attested":
    case "audit_sample_below_floor":
    case "audit_provenance_incomplete":
    case "overlaps_revoked_series":
      return "public_use_not_approved";
    default:
      // revoked, rejected, superseded, not_yet_collected, rule_not_yet_in_force, invalid_as_of:
      // no usable fact exists; the precise cause is carried in `primaryIssue`.
      return "absent";
  }
}

/**
 * Does this fact satisfy this requirement for this use?
 *
 * Categorical gates (kind, source type, validation, approval, expiry, revocation, replacement) always
 * apply. Numeric thresholds apply only when the requirement's `thresholdBasis` is
 * `aligned_with_v2_public_overview`. A threshold still marked `provisional_pending_human_decision`
 * is never applied: when every other gate passes, the verdict is `needs_human_decision`.
 */
export function evaluateRequirement(
  fact: LocalFact,
  requirement: FactRequirement,
  params: FactUseParams,
): RequirementVerdict {
  const verdict = (
    status: RequirementVerdict["status"],
    reason: MissingFactReason | null,
    issues: readonly string[],
    provisionalChecks: readonly ProvisionalCheck[] = [],
  ): RequirementVerdict =>
    Object.freeze({
      status,
      reason,
      primaryIssue: issues[0] ?? null,
      issues: Object.freeze([...issues]),
      provisionalChecks: Object.freeze([...provisionalChecks]),
    });

  if (!factMatchesRequirement(fact, requirement)) {
    return verdict("not_met", "absent", ["fact_does_not_match_requirement"]);
  }

  const use = assessFactUse(fact, params);
  // An observation that merely awaits the arbitration of a revoked series needs a human, nothing else.
  if (!use.usable && use.issues.every((issue) => issue.code === "overlaps_revoked_series")) {
    return verdict("needs_human_decision", null, ["overlaps_revoked_series"]);
  }
  if (!use.usable) {
    const first = use.issues[0]!;
    return verdict("not_met", mapUseIssue(first.code), use.issues.map((issue) => issue.code));
  }

  if (!requirement.acceptableSourceTypes.includes(fact.source.sourceType)) {
    return verdict("not_met", "source_type_not_accepted", ["source_type_not_accepted"]);
  }
  if (requirement.requiresHumanValidation && fact.validation.status !== "human_validated") {
    return verdict("not_met", "not_validated", ["human_validation_required"]);
  }
  if (requirement.requiresPublicUseApproval && params.use === "public" && fact.usage.use.publicUse !== "approved") {
    return verdict("not_met", "public_use_not_approved", ["public_use_approval_required"]);
  }

  const asOf = parseIsoDateTime(params.asOf)!; // assessFactUse already refused an unreadable asOf
  const reference = ageReferenceMs(fact);
  const ageDays = reference === null ? Number.POSITIVE_INFINITY : Math.floor((asOf - reference) / DAY_MS);
  const sample = sampleSizeOf(fact);

  const checks: ProvisionalCheck[] = [
    { check: "confidence", wouldPass: CONFIDENCE_ORDER[fact.confidence.level] >= CONFIDENCE_ORDER[requirement.minimumConfidence] },
    { check: "age", wouldPass: ageDays <= requirement.maxAgeDays },
    {
      check: "sample",
      wouldPass: requirement.minimumSampleSize === null || (sample !== null && sample >= requirement.minimumSampleSize),
    },
  ];

  if (requirement.thresholdBasis === "provisional_pending_human_decision") {
    return verdict("needs_human_decision", null, ["provisional_threshold_not_confirmed"], checks);
  }

  const failed = checks.find((entry) => !entry.wouldPass);
  if (failed !== undefined) {
    const reason: MissingFactReason =
      failed.check === "confidence" ? "confidence_too_low" : failed.check === "age" ? "expired" : "sample_too_small";
    return verdict("not_met", reason, [`threshold_${failed.check}_not_met`]);
  }
  return verdict("met", null, []);
}

/**
 * [start, end) in epoch ms of what a fact describes (observed period) or of when a rule applies
 * (civil dates read as UTC days: an approximation used only to detect OVERLAPS, never to decide
 * whether a rule is in force). null = no time dimension, or unreadable.
 */
export function describedRange(fact: LocalFact): readonly [number, number] | null {
  if (fact.kind === "regulatory") {
    const from = fact.value.effectiveFrom === null ? Number.NEGATIVE_INFINITY : parseIsoDate(fact.value.effectiveFrom);
    const until = fact.value.effectiveUntil === null ? Number.POSITIVE_INFINITY : parseIsoDate(fact.value.effectiveUntil);
    if (from === null || until === null) return null;
    return [from, until === Number.POSITIVE_INFINITY ? until : until + DAY_MS];
  }
  if (fact.observedPeriod !== null) {
    const start = parseIsoDate(fact.observedPeriod.start);
    const end = parseIsoDate(fact.observedPeriod.end);
    if (start === null || end === null) return null;
    return [start, end + DAY_MS];
  }
  return null;
}
