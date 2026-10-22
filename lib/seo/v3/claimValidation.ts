/**
 * SEO generator V3 — validator of factual claims (S3). Deterministic, read-only, fail closed.
 *
 * It decides, for each claim of a generated page, whether the page may present it as the claim's
 * declared kind says. It does NOT decide anything about facts on its own: whether a cited fact may be
 * used is delegated to the S2 registry and requirement evaluation (`registry.findFacts`,
 * `evaluateRequirement`, `evaluateTopicFacts`, `factsContradict`). A reference to a registered fact is
 * therefore never enough: the fact must be usable for THIS claim in THIS exact context (country, city,
 * geographic granularity, topic, platform, property type, instant, public use).
 *
 * Verdicts:
 *  - accepted               : nothing found.
 *  - rejected               : the claim itself is unjustified (unknown fact, wrong context, number or
 *                             wording without support, withdrawn fact, locked audit data, …).
 *  - needs_data             : supportable in principle, but required data is missing, stale or not ready.
 *  - needs_human_decision   : a human step is pending (validation, approval, arbitration, unconfirmed
 *                             threshold, contradiction between facts).
 * `needs_data` and `needs_human_decision` are never permissions: only "accepted" lets a claim through.
 *
 * Text is screened with the conservative lexical rules of claimText.ts, whose limits are documented
 * there: a claim that passes is not proven true or safe, it merely avoided every listed pattern.
 *
 * Diagnostics contain only stable codes, opaque fact ids of facts that exist in the registry and
 * structural references such as "figures[1]" or "token[2]:currency". They never contain claim text,
 * numbers from the text, unknown ids supplied by the caller, or any registry value.
 *
 * The validator never modifies the registry.
 */
import {
  analyzeClaimText,
  fold,
  foldedIncludes,
  foldedSentences,
  hasUnsupportedScript,
  numericCandidates,
  screenLanguage,
  type NumericToken,
  type RiskClass,
  type TextAnalysis,
} from "./claimText";
import { normalizeForComparison, renderFactualClaim, selectionsFromFigures } from "./claimRender";
import type { FactRegistry } from "./factRegistry";
import { evaluateRequirement, factMatchesRequirement, type UseIssueCode } from "./factUse";
import { snapshotUntrustedFact } from "./factValidation";
import type { FactId, FactPlatform, FactPropertyType, GeographicScope, LocalFact } from "./localFact";
import { evaluateTopicFacts, factsContradict, type TopicFactsReport } from "./topicFactEvaluation";
import { TOPIC_REQUIREMENTS } from "./topicRequirements";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export type ValidationVerdict = "accepted" | "rejected" | "needs_data" | "needs_human_decision";
export type FindingSeverity = Exclude<ValidationVerdict, "accepted">;

/** Everything the page is evaluated against. All dimensions are explicit; none has a default. */
export type ClaimContext = Readonly<{
  target: GeographicScope;
  platform: FactPlatform;
  propertyType: FactPropertyType;
  topic: LocalSeoTopicSlug;
  asOf: string;
  use: "public";
}>;

type BaseReasonCode =
  // input and structure
  | "malformed_input"
  | "malformed_claim"
  | "invalid_context"
  | "page_context_mismatch"
  | "duplicate_claim_id"
  | "used_facts_mismatch"
  | "claims_cite_contradictory_facts"
  // citation of facts
  | "missing_supporting_fact"
  | "supporting_facts_not_allowed"
  | "fact_not_found"
  | "fact_country_mismatch"
  | "fact_granularity_mismatch"
  | "fact_city_mismatch"
  | "fact_district_mismatch"
  | "fact_platform_mismatch"
  | "fact_property_type_mismatch"
  | "fact_topic_mismatch"
  | "fact_not_applicable_to_topic"
  | "fact_contradicted"
  | "fact_source_type_not_accepted"
  | "fact_human_validation_required"
  | "fact_public_use_approval_required"
  | "fact_threshold_age"
  | "fact_threshold_confidence"
  | "fact_threshold_sample"
  | "fact_unusable"
  | "requirement_threshold_unconfirmed"
  | "inherited_constraints_incomplete"
  // numbers
  | "figures_not_allowed"
  | "figure_invalid"
  | "figure_fact_not_cited"
  | "figure_value_unsupported"
  | "figure_value_mismatch"
  | "figure_unit_missing"
  | "figure_currency_mismatch"
  | "figure_not_in_text"
  | "unbacked_number"
  | "unbacked_date"
  | "number_in_non_factual"
  // display obligations carried by facts
  | "display_sample_size_missing"
  | "display_period_missing"
  | "display_confidence_missing"
  | "display_attribution_missing"
  | "display_unavailability_label_missing"
  | "occupancy_wording_for_unavailability"
  | "display_benchmark_language"
  | "display_editorial_label_missing"
  // wording
  | "unsupported_comparison"
  | "unsupported_trend"
  | "unsupported_superlative"
  | "platform_authority_unsupported"
  | "vague_attribution"
  | "overgeneralization"
  | "overstated_conclusion"
  | "guarantee_wording"
  | "certainty_wording"
  | "causal_wording"
  | "observation_wording"
  | "hedged_text_declared_factual"
  | "median_presented_as_average"
  | "average_wording_unsupported"
  | "regulatory_claim_without_regulatory_fact"
  | "preference_claim_without_fact"
  | "demand_claim_without_fact"
  | "hypothesis_marker_missing"
  | "hypothesis_marker_unrecognised"
  | "hypothesis_as_observation"
  | "hypothesis_as_rule"
  | "implicit_fact_in_editorial"
  // S3.2: deterministic rendering, text screening, quantities and recommendations
  | "rendered_text_mismatch"
  | "rendered_selection_invalid"
  | "factual_render_unsupported"
  | "script_not_supported"
  | "language_not_verified"
  | "unquantified_quantity"
  | "unjustified_price_recommendation";

/** Every refusal that comes from the S2 use rules is named `fact_<S2 issue code>` (e.g. fact_expired). */
export type ClaimReasonCode = BaseReasonCode | `fact_${UseIssueCode}`;

export type ClaimFinding = Readonly<{
  code: ClaimReasonCode;
  severity: FindingSeverity;
  /** Ids of facts that exist in the registry and are involved. Never ids supplied by the caller that do not exist. */
  factIds: readonly FactId[];
  /** Structural reference, e.g. "claim", "supportingFactIds[0]", "figures[1]", "token[2]:currency", "sentence[1]". */
  ref: string;
}>;

export type ClaimResult = Readonly<{
  /** Echoed only when it has the expected safe shape. */
  claimId: string | null;
  kind: string | null;
  verdict: ValidationVerdict;
  findings: readonly ClaimFinding[];
}>;

export type PageValidationResult = Readonly<{
  verdict: ValidationVerdict;
  claims: readonly ClaimResult[];
  findings: readonly ClaimFinding[];
  counts: Readonly<Record<ValidationVerdict, number>>;
}>;

const RANK: Readonly<Record<ValidationVerdict, number>> = { accepted: 0, needs_data: 1, needs_human_decision: 2, rejected: 3 };

/** How each S2 use issue weighs on a claim. Exhaustive: a new S2 issue code breaks compilation here. */
const USE_ISSUE_SEVERITY: Readonly<Record<UseIssueCode, FindingSeverity>> = {
  invalid_as_of: "rejected",
  not_yet_collected: "needs_data",
  expired: "needs_data",
  revoked: "rejected",
  rejected: "rejected",
  superseded: "rejected",
  not_validated: "needs_human_decision",
  validation_in_future: "needs_data",
  approval_in_future: "needs_human_decision",
  public_use_forbidden: "rejected",
  public_use_not_approved: "needs_human_decision",
  approval_scope_excludes_topic: "needs_human_decision",
  approval_scope_too_broad_for_audit_data: "rejected",
  approval_before_validation: "rejected",
  rule_not_yet_in_force: "rejected",
  rule_no_longer_in_force: "rejected",
  rule_timezone_unknown: "needs_data",
  overlaps_revoked_series: "needs_human_decision",
  source_terms_not_verified: "needs_human_decision",
  source_forbids_public_use: "rejected",
  source_requires_licence_check: "needs_human_decision",
  source_forbids_derivative_figures: "rejected",
  source_aggregate_only: "rejected",
  attribution_constraint_missing: "rejected",
  audit_public_use_locked: "rejected",
  audit_consent_reference_missing: "rejected",
  audit_terms_not_verified: "rejected",
  audit_aggregation_not_attested: "rejected",
  audit_sample_below_floor: "rejected",
  audit_provenance_incomplete: "rejected",
};

/** Requirement-level refusals (strings produced by evaluateRequirement that are not S2 use issues). */
const REQUIREMENT_ISSUES: Readonly<Record<string, readonly [FindingSeverity, BaseReasonCode]>> = {
  fact_does_not_match_requirement: ["rejected", "fact_not_applicable_to_topic"],
  source_type_not_accepted: ["rejected", "fact_source_type_not_accepted"],
  human_validation_required: ["needs_human_decision", "fact_human_validation_required"],
  public_use_approval_required: ["needs_human_decision", "fact_public_use_approval_required"],
  threshold_age_not_met: ["needs_data", "fact_threshold_age"],
  threshold_confidence_not_met: ["needs_data", "fact_threshold_confidence"],
  threshold_sample_not_met: ["needs_data", "fact_threshold_sample"],
  provisional_threshold_not_confirmed: ["needs_human_decision", "requirement_threshold_unconfirmed"],
};

const HYPOTHESIS_MARKERS: readonly string[] = [
  "may", "might", "could", "possibly", "perhaps", "hypothesis", "hypothesize", "hypothesise", "one possible explanation",
  "it is possible", "peut-etre", "pourrait", "pourraient", "hypothese", "il est possible", "il se peut", "eventuellement", "possiblement",
];

const CLAIM_ID = /^claim:[A-Za-z0-9][A-Za-z0-9:_.-]{0,99}$/;
/** A claim id is echoed only when it cannot itself carry an identifier (UUID, dash-less UUID, long number). */
const IDENTIFIER_LIKE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])|\d{9,}/i;
const FACT_ID = /^fact:[A-Za-z0-9][A-Za-z0-9:_.-]{7,199}$/;
const MAX_TEXT = 1000;
const MAX_CITED = 10;
const MAX_FIGURES = 20;
const MAX_CONSTRAINTS = 10;
const KNOWN_CONSTRAINTS = new Set([
  "show_sample_size", "show_observation_period", "show_confidence", "attribute_source",
  "label_as_unavailability_not_occupancy", "no_benchmark_language", "label_as_editorial_note",
]);

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);

function finding(code: ClaimReasonCode, severity: FindingSeverity, ref: string, factIds: readonly FactId[] = []): ClaimFinding {
  return Object.freeze({ code, severity, factIds: Object.freeze([...factIds]), ref });
}

function sortFindings(findings: readonly ClaimFinding[]): readonly ClaimFinding[] {
  const key = (item: ClaimFinding) => `${3 - RANK[item.severity]}|${item.code}|${item.ref}|${item.factIds.join(",")}`;
  const seen = new Set<string>();
  const unique = findings.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return Object.freeze(unique.sort((a, b) => (key(a) < key(b) ? -1 : 1)));
}

function worst(findings: readonly ClaimFinding[]): ValidationVerdict {
  return findings.reduce<ValidationVerdict>((verdict, item) => (RANK[item.severity] > RANK[verdict] ? item.severity : verdict), "accepted");
}

function result(claimId: string | null, kind: string | null, findings: readonly ClaimFinding[]): ClaimResult {
  const sorted = sortFindings(findings);
  return Object.freeze({ claimId, kind, verdict: worst(sorted), findings: sorted });
}

// ---------------------------------------------------------------------------------------------
// Evaluation environment: one S2 evaluation per page and context
// ---------------------------------------------------------------------------------------------

type Environment = Readonly<{
  registry: FactRegistry;
  context: ClaimContext;
  topicReport: TopicFactsReport;
  inContext: ReadonlySet<FactId>;
  factFindings: Map<FactId, readonly ClaimFinding[]>;
}>;

type EnvironmentResult = { ok: true; env: Environment } | { ok: false; reasons: readonly string[] };

function buildEnvironment(rawContext: unknown, registry: FactRegistry): EnvironmentResult {
  const snapshot = snapshotUntrustedFact(rawContext);
  if (!snapshot.ok) return { ok: false, reasons: ["malformed_context"] };
  const raw = snapshot.value;
  if (raw.use !== "public") return { ok: false, reasons: ["use_must_be_public"] };
  const context = raw as unknown as ClaimContext;
  const topicReport = evaluateTopicFacts(registry, {
    target: context.target,
    platform: context.platform,
    propertyType: context.propertyType,
    topic: context.topic,
    asOf: context.asOf,
    use: "public",
  });
  if (topicReport.overall === "invalid_request") return { ok: false, reasons: topicReport.reasons };
  const inContext = new Set(
    registry.findFacts({ target: context.target, platform: context.platform, propertyType: context.propertyType, topic: context.topic }).map((fact) => fact.factId),
  );
  return { ok: true, env: { registry, context, topicReport, inContext, factFindings: new Map() } };
}

function contextMismatchCodes(fact: LocalFact, context: ClaimContext): ClaimReasonCode[] {
  const codes: ClaimReasonCode[] = [];
  const scope = fact.scope;
  const target = context.target;
  if (scope.countryCode !== target.countryCode) codes.push("fact_country_mismatch");
  else if (scope.level !== target.level) codes.push("fact_granularity_mismatch");
  else if (scope.level !== "country" && target.level !== "country" && scope.citySlug !== target.citySlug) codes.push("fact_city_mismatch");
  else if (scope.level === "district" && target.level === "district" && scope.districtName !== target.districtName) codes.push("fact_district_mismatch");
  if (fact.platform !== context.platform) codes.push("fact_platform_mismatch");
  if (fact.propertyType !== context.propertyType) codes.push("fact_property_type_mismatch");
  if (!fact.relevantTopics.includes(context.topic)) codes.push("fact_topic_mismatch");
  return codes;
}

/**
 * Findings about ONE cited fact in the page's context (cached). The reference "fact" is replaced by the
 * caller's own reference when the findings are attached to a claim.
 */
function assessCitedFact(env: Environment, fact: LocalFact): readonly ClaimFinding[] {
  const cached = env.factFindings.get(fact.factId);
  if (cached !== undefined) return cached;
  const found: ClaimFinding[] = [];
  const ids = [fact.factId];
  const add = (code: ClaimReasonCode, severity: FindingSeverity) => found.push(finding(code, severity, "fact", ids));

  if (!env.inContext.has(fact.factId)) {
    const codes = contextMismatchCodes(fact, env.context);
    for (const code of codes.length > 0 ? codes : (["fact_country_mismatch"] as ClaimReasonCode[])) add(code, "rejected");
  } else {
    const spec = TOPIC_REQUIREMENTS[env.context.topic];
    const requirements = [...spec.required, ...spec.optional].filter((requirement) => factMatchesRequirement(fact, requirement));
    if (requirements.length === 0) {
      add("fact_not_applicable_to_topic", "rejected");
    } else {
      const params = {
        asOf: env.context.asOf,
        use: "public" as const,
        topic: env.context.topic,
        superseded: env.registry.isSuperseded(fact.factId),
        timeZone: fact.kind === "regulatory" ? env.registry.resolveTimeZone(fact.scope, env.context.asOf) : null,
        unresolvedRevokedOverlap: env.registry.unresolvedRevokedOverlaps(fact.factId, env.context.asOf).length > 0,
      };
      const verdicts = requirements.map((requirement) => evaluateRequirement(fact, requirement, params));
      const best = verdicts.find((v) => v.status === "met") ?? verdicts.find((v) => v.status === "needs_human_decision") ?? verdicts[0]!;
      if (best.status !== "met") {
        for (const issue of best.issues) {
          if (Object.hasOwn(USE_ISSUE_SEVERITY, issue)) {
            add(`fact_${issue}` as ClaimReasonCode, USE_ISSUE_SEVERITY[issue as UseIssueCode]);
          } else if (Object.hasOwn(REQUIREMENT_ISSUES, issue)) {
            const [severity, code] = REQUIREMENT_ISSUES[issue]!;
            add(code, severity);
          } else {
            add("fact_unusable", "rejected");
          }
        }
        if (best.issues.length === 0) add("fact_unusable", "rejected");
      }
    }
    // contradictions that S2 detected among the usable facts of this topic
    for (const report of env.topicReport.requirements) {
      if (report.conflictingFactIds.includes(fact.factId)) {
        found.push(finding("fact_contradicted", "needs_human_decision", "fact", report.conflictingFactIds));
      }
    }
  }
  const frozen = Object.freeze(found);
  env.factFindings.set(fact.factId, frozen);
  return frozen;
}

// ---------------------------------------------------------------------------------------------
// Shape of a claim
// ---------------------------------------------------------------------------------------------

type ParsedClaim = Readonly<{
  claimId: string;
  kind: "factual" | "methodological_advice" | "explicit_hypothesis" | "editorial_non_factual";
  text: string;
  supportingFactIds: readonly string[] | null;
  basisFactIds: readonly string[] | null;
  figures: readonly { literal: string; factId: string; valuePath: string }[] | null;
  inheritedDisplayConstraints: readonly string[] | null;
  hypothesisMarker: string | null;
}>;

const KINDS = ["factual", "methodological_advice", "explicit_hypothesis", "editorial_non_factual"] as const;
const BASE_KEYS = ["claimId", "text", "sectionId", "kind"];
const EXTRA_KEYS: Readonly<Record<(typeof KINDS)[number], readonly string[]>> = {
  factual: ["supportingFactIds", "figures", "inheritedDisplayConstraints"],
  explicit_hypothesis: ["hypothesisMarker", "basisFactIds", "figures"],
  // S1 forbids these fields on advice and editorial text; if present they are reported, not ignored.
  methodological_advice: ["supportingFactIds", "figures"],
  editorial_non_factual: ["supportingFactIds", "figures"],
};

function parseClaim(raw: unknown): { ok: true; claim: ParsedClaim } | { ok: false; claimId: string | null } {
  const snapshot = snapshotUntrustedFact(raw);
  if (!snapshot.ok) return { ok: false, claimId: null };
  const rec = snapshot.value;
  const safeId = typeof rec.claimId === "string" && CLAIM_ID.test(rec.claimId) && !IDENTIFIER_LIKE.test(rec.claimId) ? rec.claimId : null;
  const kind = (KINDS as readonly unknown[]).includes(rec.kind) ? (rec.kind as (typeof KINDS)[number]) : null;
  if (kind === null || safeId === null) return { ok: false, claimId: safeId };
  if (typeof rec.text !== "string" || rec.text.trim().length === 0 || rec.text.length > MAX_TEXT) return { ok: false, claimId: safeId };
  if (typeof rec.sectionId !== "string" || rec.sectionId.trim().length === 0 || rec.sectionId.length > 100) return { ok: false, claimId: safeId };
  const allowed = new Set([...BASE_KEYS, ...EXTRA_KEYS[kind]]);
  if (Object.keys(rec).some((key) => !allowed.has(key))) return { ok: false, claimId: safeId };

  const idList = (value: unknown, required: boolean): readonly string[] | null | "bad" => {
    if (value === undefined) return required ? "bad" : null;
    if (!Array.isArray(value) || value.length > MAX_CITED || (required && value.length === 0)) return "bad";
    return value.every((id) => typeof id === "string" && FACT_ID.test(id)) ? (value as string[]) : "bad";
  };
  const supporting = idList(rec.supportingFactIds, kind === "factual");
  const basis = idList(rec.basisFactIds, false);
  if (supporting === "bad" || basis === "bad") return { ok: false, claimId: safeId };

  let figures: ParsedClaim["figures"] = null;
  if (rec.figures !== undefined) {
    if (!Array.isArray(rec.figures) || rec.figures.length > MAX_FIGURES) return { ok: false, claimId: safeId };
    const parsed: { literal: string; factId: string; valuePath: string }[] = [];
    for (const figure of rec.figures) {
      if (!isRec(figure) || Object.keys(figure).some((key) => !["literal", "factId", "valuePath"].includes(key))) return { ok: false, claimId: safeId };
      if (typeof figure.literal !== "string" || figure.literal.length === 0 || figure.literal.length > 40) return { ok: false, claimId: safeId };
      if (typeof figure.factId !== "string" || !FACT_ID.test(figure.factId)) return { ok: false, claimId: safeId };
      if (typeof figure.valuePath !== "string" || figure.valuePath.length === 0 || figure.valuePath.length > 40) return { ok: false, claimId: safeId };
      parsed.push({ literal: figure.literal, factId: figure.factId, valuePath: figure.valuePath });
    }
    figures = parsed;
  }
  let inherited: readonly string[] | null = null;
  if (rec.inheritedDisplayConstraints !== undefined) {
    const list = rec.inheritedDisplayConstraints;
    if (!Array.isArray(list) || list.length > MAX_CONSTRAINTS || !list.every((item) => typeof item === "string" && KNOWN_CONSTRAINTS.has(item))) {
      return { ok: false, claimId: safeId };
    }
    inherited = list as string[];
  }
  let marker: string | null = null;
  if (kind === "explicit_hypothesis") {
    if (typeof rec.hypothesisMarker !== "string" || rec.hypothesisMarker.trim().length === 0 || rec.hypothesisMarker.length > 60) return { ok: false, claimId: safeId };
    marker = rec.hypothesisMarker;
  }
  return {
    ok: true,
    claim: {
      claimId: safeId,
      kind,
      text: rec.text,
      supportingFactIds: supporting,
      basisFactIds: basis,
      figures,
      inheritedDisplayConstraints: inherited,
      hypothesisMarker: marker,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------

/** Words that may follow a count: the number must be written as that count (25 listings), never as another quantity. */
const LISTING_UNITS: ReadonlySet<string> = new Set(["listing", "listings", "annonce", "annonces", "observation", "observations", "property", "properties", "propriete", "proprietes"]);
const NIGHT_UNITS: ReadonlySet<string> = new Set(["night", "nights", "nuit", "nuits"]);

type NumericField = Readonly<{ value: number; role: "amount" | "ratio" | "count" | "statistic"; units?: ReadonlySet<string> }>;

const LIMIT_DAY_UNITS: ReadonlySet<string> = new Set(["day", "days", "jour", "jours"]);

function numericField(fact: LocalFact, path: string): NumericField | null {
  if (fact.kind === "regulatory") {
    // S5.4-L: the only regulatory figure is the structured limit, written with its own unit
    const limit = fact.value.limit;
    if (path !== "limit.value" || limit === undefined || limit === null) return null;
    return { value: limit.value, role: "count", units: limit.unit === "days" ? LIMIT_DAY_UNITS : NIGHT_UNITS };
  }
  if (fact.kind !== "quantitative") return null;
  const value = fact.value;
  if (value.metric === "nightly_price_distribution") {
    if (["median", "p10", "p25", "p75", "p90"].includes(path)) {
      const number = (value as Record<string, unknown>)[path];
      return typeof number === "number" ? { value: number, role: "amount" } : null;
    }
    return path === "sampleSize" ? { value: value.sampleSize, role: "count", units: LISTING_UNITS } : null;
  }
  if (value.metric === "calendar_unavailability_rate") {
    if (path === "ratio") return { value: value.ratio, role: "ratio" };
    if (path === "observedNights") return { value: value.observedNights, role: "count", units: NIGHT_UNITS };
    if (path === "sampleSize") return { value: value.sampleSize, role: "count", units: LISTING_UNITS };
    return null;
  }
  return path === "value" ? { value: value.value, role: "statistic" } : null;
}

function decimalsOfValue(value: number): number {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** Identity, or rounding to the (fewer) decimals written: the only value transformations S3 accepts. */
function sameOrRounded(candidate: number, decimals: number, value: number): boolean {
  if (candidate === value) return true;
  return decimals < decimalsOfValue(value) && Number(value.toFixed(decimals)) === candidate;
}

function literalCandidates(literal: string): number[] {
  const match = /\d[\d\s .,]*/.exec(literal);
  if (match === null) return [];
  return numericCandidates(match[0].trim());
}


function tokenMatchesField(token: NumericToken, field: NumericField, fact: LocalFact): "ok" | "unit_missing" | "currency_mismatch" | "mismatch" {
  const numberOk = (target: number, tolerateDecimals = true) =>
    token.candidates.some((candidate) => (tolerateDecimals ? sameOrRounded(candidate, token.decimals, target) : candidate === target));
  switch (field.role) {
    case "amount": {
      const currency = fact.kind === "quantitative" && fact.value.metric === "nightly_price_distribution" ? fact.value.currency : null;
      if (token.category !== "currency") return "unit_missing";
      if (token.currency !== null && currency !== null && token.currency !== currency) return "currency_mismatch";
      return numberOk(field.value) ? "ok" : "mismatch";
    }
    case "ratio":
      if (token.category === "percent") {
        return token.candidates.some((candidate) => candidate === Number((field.value * 100).toFixed(token.decimals))) ? "ok" : "mismatch";
      }
      return token.category === "quantity" && numberOk(field.value) ? "ok" : "mismatch";
    case "count":
      return (token.category === "quantity" || token.category === "duration") &&
        field.units !== undefined &&
        field.units.has(token.unit) &&
        token.candidates.some((candidate) => candidate === field.value)
        ? "ok"
        : "mismatch";
    case "statistic":
      if (token.category === "percent" || token.category === "currency") return "mismatch";
      return numberOk(field.value) ? "ok" : "mismatch";
  }
}

function periodDates(fact: LocalFact): string[] {
  if (fact.kind === "regulatory") {
    return [fact.value.effectiveFrom, fact.value.effectiveUntil].filter((date): date is NonNullable<typeof date> => date !== null);
  }
  return fact.observedPeriod === null ? [] : [fact.observedPeriod.start, fact.observedPeriod.end];
}

type NumberCheck = Readonly<{ findings: ClaimFinding[]; validFigureKeys: Set<string> }>;

/** Validates figures and checks that every number of the text is backed. Used by factual and hypothesis claims. */
function checkNumbers(claim: ParsedClaim, analysis: TextAnalysis, citedIds: readonly string[], facts: Map<string, LocalFact>): NumberCheck {
  const findings: ClaimFinding[] = [];
  const validFigureKeys = new Set<string>();
  const figures = claim.figures ?? [];
  const tokens = analysis.tokens
    .map((token, index) => ({ token, index }))
    .filter((entry) => !entry.token.structural);
  const covered = new Set<number>();

  figures.forEach((figure, figureIndex) => {
    const ref = `figures[${figureIndex}]`;
    if (!citedIds.includes(figure.factId)) {
      findings.push(finding("figure_fact_not_cited", "rejected", ref));
      return;
    }
    const fact = facts.get(figure.factId);
    if (fact === undefined) return; // the citation itself is already refused (unknown fact)
    const field = numericField(fact, figure.valuePath);
    if (field === null) {
      findings.push(finding("figure_value_unsupported", "rejected", ref, [fact.factId]));
      return;
    }
    const wanted = literalCandidates(figure.literal);
    if (wanted.length === 0) {
      findings.push(finding("figure_invalid", "rejected", ref, [fact.factId]));
      return;
    }
    const sameNumber = tokens.filter(
      ({ token }) => token.category !== "date" && token.candidates.some((candidate) => wanted.includes(candidate)),
    );
    if (sameNumber.length === 0) {
      findings.push(finding("figure_not_in_text", "rejected", ref, [fact.factId]));
      return;
    }
    let matchedAny = false;
    let firstProblem: "unit_missing" | "currency_mismatch" | "mismatch" | null = null;
    // One figure backs ONE written number: the same digits written twice need two figures.
    for (const { token, index } of sameNumber) {
      const outcome = tokenMatchesField(token, field, fact);
      if (outcome === "ok") {
        if (!matchedAny && !covered.has(index)) {
          covered.add(index);
          matchedAny = true;
        } else if (!matchedAny) {
          firstProblem ??= "mismatch";
        }
      } else if (firstProblem === null) {
        firstProblem = outcome;
      }
    }
    if (matchedAny) {
      validFigureKeys.add(`${fact.factId}|${figure.valuePath}`);
    } else {
      const code: ClaimReasonCode =
        firstProblem === "unit_missing" ? "figure_unit_missing" : firstProblem === "currency_mismatch" ? "figure_currency_mismatch" : "figure_value_mismatch";
      findings.push(finding(code, "rejected", ref, [fact.factId]));
    }
  });

  const citedFacts = citedIds.map((id) => facts.get(id)).filter((fact): fact is LocalFact => fact !== undefined);
  const dates = new Set(citedFacts.flatMap(periodDates));
  const years = new Set([...dates].map((date) => Number(date.slice(0, 4))));
  tokens.forEach(({ token, index }) => {
    const ref = `token[${index}]:${token.category}`;
    if (token.category === "date") {
      if (token.isoDate === null || !dates.has(token.isoDate)) findings.push(finding("unbacked_date", "rejected", ref));
      return;
    }
    if (token.category === "year" && token.candidates.length > 0 && years.has(token.candidates[0]!) && !covered.has(index)) return;
    if (!covered.has(index)) findings.push(finding("unbacked_number", "rejected", ref));
  });
  return { findings, validFigureKeys };
}

// ---------------------------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------------------------

function sentencesWith(analysis: TextAnalysis, name: RiskClass, predicate: (s: TextAnalysis["sentences"][number]) => boolean = () => true): number[] {
  return analysis.sentences.filter((sentence) => sentence.hits.has(name) && predicate(sentence)).map((sentence) => sentence.index);
}

/** True when `needle` occurs in `text` as whole words. */
function containsWords(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(text);
}

/** Clauses of a sentence: contrast words start a new proposition. */
function clausesOf(sentence: string): string[] {
  return sentence.split(/\b(?:but|however|although|whereas|yet|mais|cependant|toutefois)\b/).filter((clause) => (clause.match(/[a-z]+/g) ?? []).length >= 3);
}

function hypothesisMarkerFindings(claim: ParsedClaim): ClaimFinding[] {
  const findings: ClaimFinding[] = [];
  const marker = fold(claim.hypothesisMarker ?? "").trim();
  if (!HYPOTHESIS_MARKERS.includes(marker)) return [finding("hypothesis_marker_unrecognised", "rejected", "hypothesisMarker")];
  const sentences = foldedSentences(claim.text);
  if (!sentences.some((sentence) => containsWords(sentence, marker))) findings.push(finding("hypothesis_marker_missing", "rejected", "hypothesisMarker"));
  // every proposition carries its own marker: a "may" in one sentence does not hedge another one
  sentences.forEach((sentence, index) => {
    if (clausesOf(sentence).some((clause) => !HYPOTHESIS_MARKERS.some((candidate) => containsWords(clause, candidate)))) {
      findings.push(finding("hypothesis_marker_missing", "rejected", `sentence[${index}]`));
    }
  });
  return findings;
}

function wordingFindings(
  claim: ParsedClaim,
  analysis: TextAnalysis,
  citedFacts: readonly LocalFact[],
): ClaimFinding[] {
  const findings: ClaimFinding[] = [];
  const flag = (code: ClaimReasonCode, name: RiskClass, predicate?: (s: TextAnalysis["sentences"][number]) => boolean, factIds: readonly FactId[] = []) => {
    for (const index of sentencesWith(analysis, name, predicate)) findings.push(finding(code, "rejected", `sentence[${index}]`, factIds));
  };
  const kind = claim.kind;
  const hasKind = (k: LocalFact["kind"]) => citedFacts.some((fact) => fact.kind === k);
  const sentenceTexts = foldedSentences(claim.text);
  // naming the publisher excuses a vague attribution only in the sentence that names it
  const publisherIn = (index: number) =>
    citedFacts.some((fact) => {
      const needle = fold(fact.source.publisher).trim();
      return needle.length > 0 && (sentenceTexts[index] ?? "").includes(needle);
    });

  // never, whatever the kind (a disclaimer is stripped before matching, so it cannot shield a guarantee)
  flag("guarantee_wording", "guarantee");
  flag("platform_authority_unsupported", "platform_authority");
  flag("causal_wording", "future_effect");
  flag("unquantified_quantity", "quantifier");
  flag("unjustified_price_recommendation", "pricing_advice");

  if (kind === "factual") {
    flag("unsupported_trend", "evolution_word");
    flag("unsupported_trend", "trend_claim");
    flag("unsupported_comparison", "comparison");
    flag("unsupported_comparison", "implicit_comparison");
    flag("unsupported_superlative", "superlative_word");
    flag("unsupported_superlative", "market_superlative");
    flag("overgeneralization", "generalization");
    flag("overstated_conclusion", "certainty");
    flag("causal_wording", "causal");
    flag("vague_attribution", "vague_attribution", (sentence) => !publisherIn(sentence.index));
    for (const sentence of analysis.sentences) {
      if (sentence.hedged) findings.push(finding("hedged_text_declared_factual", "rejected", `sentence[${sentence.index}]`));
    }
    const usesMedian = citedFacts.some((fact) => fact.kind === "quantitative" && fact.value.metric === "nightly_price_distribution");
    flag(usesMedian ? "median_presented_as_average" : "average_wording_unsupported", "average");
    if (!hasKind("regulatory")) flag("regulatory_claim_without_regulatory_fact", "regulatory");
    if (!citedFacts.some((fact) => fact.kind === "qualitative" && fact.value.category === "guest_expectation")) {
      flag("preference_claim_without_fact", "preference");
    }
    if (!citedFacts.some((fact) => (fact.kind === "qualitative" && fact.value.category === "demand_driver") || (fact.kind === "quantitative" && fact.value.metric === "official_statistic"))) {
      flag("demand_claim_without_fact", "demand");
    }
    return findings;
  }

  // advice, editorial text and hypotheses: local or demonstrated claims need facts, which these kinds cannot cite
  flag("certainty_wording", "certainty");
  if (kind !== "explicit_hypothesis") {
    flag("average_wording_unsupported", "average");
    flag("unsupported_trend", "trend_claim");
    flag("unsupported_superlative", "market_superlative");
    flag("unsupported_comparison", "implicit_comparison");
    flag("regulatory_claim_without_regulatory_fact", "regulatory");
    flag("preference_claim_without_fact", "preference");
    flag("demand_claim_without_fact", "demand");
    flag("vague_attribution", "vague_attribution");
    flag("observation_wording", "observation");
    flag("causal_wording", "causal", (sentence) => !sentence.hedged);
    if (kind === "editorial_non_factual") {
      flag("overgeneralization", "generalization");
      flag("implicit_fact_in_editorial", "implicit_fact");
    }
  } else {
    flag("hypothesis_as_rule", "regulatory");
    flag("hypothesis_as_observation", "observation");
    flag("vague_attribution", "vague_attribution");
    flag("overgeneralization", "generalization", (sentence) => sentence.hits.has("certainty"));
  }
  return findings;
}

function displayFindings(claim: ParsedClaim, citedFacts: readonly LocalFact[], validFigureKeys: ReadonlySet<string>): ClaimFinding[] {
  const findings: ClaimFinding[] = [];
  const analysis = analyzeClaimText(claim.text);
  const sentenceHas = (name: RiskClass) => analysis.sentences.filter((s) => s.hits.has(name));
  for (const fact of citedFacts) {
    const ids = [fact.factId];
    for (const constraint of fact.usage.displayConstraints) {
      switch (constraint) {
        case "show_sample_size":
          if (!validFigureKeys.has(`${fact.factId}|sampleSize`)) findings.push(finding("display_sample_size_missing", "rejected", "claim", ids));
          break;
        case "show_observation_period": {
          const period = fact.observedPeriod;
          const folded = fold(claim.text);
          const start = period === null ? -1 : folded.indexOf(period.start);
          // the period is shown in the right order: start first, end after it
          if (period === null || start < 0 || (period.start !== period.end && folded.indexOf(period.end, start) <= start)) {
            findings.push(finding("display_period_missing", "rejected", "claim", ids));
          }
          break;
        }
        case "show_confidence":
          // the level written is the level of the fact ("confidence: high"), not merely the word "confidence"
          if (!new RegExp(`confidence\\s*:\\s*${fact.confidence.level.replace(/_/g, " ")}(?![a-z])`).test(fold(claim.text))) {
            findings.push(finding("display_confidence_missing", "rejected", "claim", ids));
          }
          break;
        case "attribute_source":
          if (!foldedIncludes(claim.text, fact.source.publisher)) findings.push(finding("display_attribution_missing", "rejected", "claim", ids));
          break;
        case "label_as_unavailability_not_occupancy":
          if (!/unavailab|indisponib/.test(fold(claim.text))) findings.push(finding("display_unavailability_label_missing", "rejected", "claim", ids));
          // no negation shield: "not occupancy" still speaks of occupancy
          for (const sentence of sentenceHas("occupancy")) {
            findings.push(finding("occupancy_wording_for_unavailability", "rejected", `sentence[${sentence.index}]`, ids));
          }
          break;
        case "no_benchmark_language":
          for (const sentence of sentenceHas("benchmark")) findings.push(finding("display_benchmark_language", "rejected", `sentence[${sentence.index}]`, ids));
          break;
        case "label_as_editorial_note":
          if (!/editorial (?:note|observation)|note editoriale|observation editoriale|our editors|notre redaction/.test(fold(claim.text))) {
            findings.push(finding("display_editorial_label_missing", "rejected", "claim", ids));
          }
          break;
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// One claim
// ---------------------------------------------------------------------------------------------

type ClaimWork = Readonly<{ result: ClaimResult; citedFactIds: readonly FactId[] }>;

function validateParsed(claim: ParsedClaim, env: Environment): ClaimWork {
  const findings: ClaimFinding[] = [];
  const analysis = analyzeClaimText(claim.text);
  const kind = claim.kind;

  // text that cannot be analysed is never validated automatically
  if (hasUnsupportedScript(claim.text)) {
    findings.push(finding("script_not_supported", "needs_human_decision", "claim"));
  } else {
    const language = screenLanguage(claim.text);
    if (language === "undetermined" || (kind === "factual" && language !== "en")) findings.push(finding("language_not_verified", "needs_human_decision", "claim"));
  }

  const citedList: readonly string[] =
    kind === "factual" ? claim.supportingFactIds ?? [] : kind === "explicit_hypothesis" ? claim.basisFactIds ?? [] : [];
  const citedRefField = kind === "factual" ? "supportingFactIds" : "basisFactIds";

  if (kind === "methodological_advice" || kind === "editorial_non_factual") {
    if (claim.figures !== null && claim.figures.length > 0) findings.push(finding("figures_not_allowed", "rejected", "figures"));
    if (claim.supportingFactIds !== null && claim.supportingFactIds.length > 0) findings.push(finding("supporting_facts_not_allowed", "rejected", "supportingFactIds"));
    analysis.tokens.forEach((token, index) => {
      if (!token.structural) findings.push(finding("number_in_non_factual", "rejected", `token[${index}]:${token.category}`));
    });
    findings.push(...wordingFindings(claim, analysis, []));
    return { result: result(claim.claimId, kind, findings), citedFactIds: [] };
  }

  // factual and hypothesis claims: resolve and assess the cited facts
  const facts = new Map<string, LocalFact>();
  const cited: LocalFact[] = [];
  if (kind === "factual" && citedList.length === 0) findings.push(finding("missing_supporting_fact", "rejected", "supportingFactIds"));
  citedList.forEach((id, index) => {
    const fact = env.registry.get(id as FactId);
    if (fact === undefined) {
      findings.push(finding("fact_not_found", "rejected", `${citedRefField}[${index}]`)); // the caller's id is never echoed
      return;
    }
    facts.set(id, fact);
    if (!cited.includes(fact)) cited.push(fact);
    for (const item of assessCitedFact(env, fact)) findings.push(finding(item.code, item.severity, `${citedRefField}[${index}]`, item.factIds));
  });

  // a factual text is the deterministic rendering of its facts, never free prose
  if (kind === "factual" && citedList.length > 0 && cited.length === new Set(citedList).size) {
    const selected = selectionsFromFigures(cited, claim.figures ?? []);
    const rendered = selected.ok ? renderFactualClaim(selected.selections) : selected;
    if (!rendered.ok) {
      findings.push(
        rendered.reason === "invalid_selection"
          ? finding("rendered_selection_invalid", "rejected", "figures")
          : finding("factual_render_unsupported", "needs_human_decision", "claim"),
      );
    } else if (normalizeForComparison(claim.text) !== normalizeForComparison(rendered.value.text)) {
      findings.push(finding("rendered_text_mismatch", "rejected", "claim"));
    }
  }

  // figures may only be given for cited facts; a figure naming a fact the claim does not cite is refused
  const figureFacts = new Map(facts);
  const numbers = checkNumbers(claim, analysis, citedList, figureFacts);
  findings.push(...numbers.findings);

  // obligations carried by the facts (for a hypothesis, only facts actually used through a figure)
  const obligated =
    kind === "factual" ? cited : cited.filter((fact) => (claim.figures ?? []).some((figure) => figure.factId === fact.factId));
  findings.push(...displayFindings(claim, obligated, numbers.validFigureKeys));
  if (kind === "factual") {
    const required = new Set(cited.flatMap((fact) => fact.usage.displayConstraints));
    const declared = new Set(claim.inheritedDisplayConstraints ?? []);
    if ([...required].some((constraint) => !declared.has(constraint))) {
      findings.push(finding("inherited_constraints_incomplete", "rejected", "inheritedDisplayConstraints", cited.map((fact) => fact.factId)));
    }
  }

  if (kind === "explicit_hypothesis") {
    findings.push(...hypothesisMarkerFindings(claim));
  }

  findings.push(...wordingFindings(claim, analysis, cited));
  return { result: result(claim.claimId, kind, findings), citedFactIds: cited.map((fact) => fact.factId) };
}

const MALFORMED = (claimId: string | null): ClaimResult => result(claimId, null, [finding("malformed_claim", "rejected", "claim")]);

/** Validates one claim in an explicit context. Never throws on malformed input; never modifies the registry. */
export function validateClaim(rawClaim: unknown, rawContext: unknown, registry: FactRegistry): ClaimResult {
  const parsed = parseClaim(rawClaim);
  if (!parsed.ok) return MALFORMED(parsed.claimId);
  const environment = buildEnvironment(rawContext, registry);
  if (!environment.ok) return result(parsed.claim.claimId, parsed.claim.kind, [finding("invalid_context", "rejected", "context")]);
  return validateParsed(parsed.claim, environment.env).result;
}

// ---------------------------------------------------------------------------------------------
// One page
// ---------------------------------------------------------------------------------------------

const EMPTY_COUNTS = (): Record<ValidationVerdict, number> => ({ accepted: 0, rejected: 0, needs_data: 0, needs_human_decision: 0 });

function pageResult(claims: readonly ClaimResult[], pageFindings: readonly ClaimFinding[]): PageValidationResult {
  const counts = EMPTY_COUNTS();
  for (const claim of claims) counts[claim.verdict] += 1;
  const sorted = sortFindings(pageFindings);
  const verdict = [...sorted.map((item) => item.severity), ...claims.map((claim) => claim.verdict)].reduce<ValidationVerdict>(
    (current, next) => (RANK[next] > RANK[current] ? next : current),
    "accepted",
  );
  return Object.freeze({ verdict, claims: Object.freeze([...claims]), findings: sorted, counts: Object.freeze(counts) });
}

/**
 * Validates every claim of a GeneratedPage in one explicit context, then the page as a whole
 * (context agreement, unique claim ids, the `usedFactIds` invariant, contradictions between the facts
 * the claims cite). An empty page is accepted: it asserts nothing.
 */
export function validateGeneratedPage(rawPage: unknown, rawContext: unknown, registry: FactRegistry): PageValidationResult {
  const snapshot = snapshotUntrustedFact(rawPage);
  if (!snapshot.ok || !Array.isArray(snapshot.value.sections)) {
    return pageResult([], [finding("malformed_input", "rejected", "page")]);
  }
  const page = snapshot.value;
  const environment = buildEnvironment(rawContext, registry);
  if (!environment.ok) return pageResult([], [finding("invalid_context", "rejected", "context")]);
  const env = environment.env;
  const pageFindings: ClaimFinding[] = [];

  if (!(LOCAL_SEO_TOPIC_SLUGS as readonly string[]).includes(String(page.topic)) || page.topic !== env.context.topic) {
    pageFindings.push(finding("page_context_mismatch", "rejected", "topic"));
  }
  const target = env.context.target;
  if (target.level !== "country" && page.citySlug !== target.citySlug) pageFindings.push(finding("page_context_mismatch", "rejected", "citySlug"));

  const claims: { work: ClaimWork | null; result: ClaimResult }[] = [];
  const seenIds = new Set<string>();
  const rawSections = page.sections as unknown[];
  for (const section of rawSections) {
    if (!isRec(section) || !Array.isArray(section.claims)) {
      pageFindings.push(finding("malformed_input", "rejected", "sections"));
      continue;
    }
    for (const rawClaim of section.claims) {
      const parsed = parseClaim(rawClaim);
      if (!parsed.ok) {
        claims.push({ work: null, result: MALFORMED(parsed.claimId) });
        continue;
      }
      if (seenIds.has(parsed.claim.claimId)) pageFindings.push(finding("duplicate_claim_id", "rejected", "claims"));
      seenIds.add(parsed.claim.claimId);
      const work = validateParsed(parsed.claim, env);
      claims.push({ work, result: work.result });
    }
  }

  // usedFactIds must be exactly the set of facts the claims cite
  const cited = new Set<FactId>();
  for (const entry of claims) entry.work?.citedFactIds.forEach((id) => cited.add(id));
  const declared = Array.isArray(page.usedFactIds) ? (page.usedFactIds as unknown[]) : null;
  const declaredSet = declared === null ? null : new Set(declared.filter((id): id is string => typeof id === "string"));
  const citedAsClaimed = new Set<string>();
  for (const raw of rawSections) {
    if (!isRec(raw) || !Array.isArray(raw.claims)) continue;
    for (const claim of raw.claims) {
      if (!isRec(claim)) continue;
      for (const key of ["supportingFactIds", "basisFactIds"]) {
        const list = claim[key];
        if (Array.isArray(list)) list.forEach((id) => typeof id === "string" && citedAsClaimed.add(id));
      }
      if (Array.isArray(claim.figures)) claim.figures.forEach((figure) => isRec(figure) && typeof figure.factId === "string" && citedAsClaimed.add(figure.factId));
    }
  }
  if (declaredSet === null || declared!.length !== declaredSet.size || declaredSet.size !== citedAsClaimed.size || [...citedAsClaimed].some((id) => !declaredSet.has(id))) {
    pageFindings.push(finding("used_facts_mismatch", "rejected", "usedFactIds"));
  }

  // two cited facts that contradict each other cannot both stand on the same page
  const citedFacts = [...cited].map((id) => registry.get(id)!).filter(Boolean);
  const contradictory = new Set<FactId>();
  for (let i = 0; i < citedFacts.length; i += 1) {
    for (let j = i + 1; j < citedFacts.length; j += 1) {
      if (factsContradict(citedFacts[i]!, citedFacts[j]!)) {
        contradictory.add(citedFacts[i]!.factId);
        contradictory.add(citedFacts[j]!.factId);
      }
    }
  }
  const finalResults = claims.map((entry) => {
    if (contradictory.size === 0 || entry.work === null) return entry.result;
    const involved = entry.work.citedFactIds.filter((id) => contradictory.has(id));
    if (involved.length === 0) return entry.result;
    return result(entry.result.claimId, entry.result.kind, [...entry.result.findings, finding("claims_cite_contradictory_facts", "needs_human_decision", "claim", involved)]);
  });
  if (contradictory.size > 0) pageFindings.push(finding("claims_cite_contradictory_facts", "needs_human_decision", "page", [...contradictory].sort()));

  return pageResult(finalResults, pageFindings);
}
