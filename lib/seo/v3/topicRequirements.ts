/**
 * SEO generator V3 — editorial requirements of the 25 topics (contract + draft table).
 *
 * Thresholds are NOT uniform on purpose: a photo page needs no price, a revenue page needs several
 * measured figures. Every threshold records where it comes from (`thresholdBasis`). Values marked
 * `provisional_pending_human_decision` are drafts to be confirmed before S2 enforces them; they are
 * not editorial policy yet.
 *
 * This file is data only. Nothing here reads facts, decides eligibility or renders content.
 */
import type { EditorialEligibility } from "./editorialEligibility";
import type { FactSourceType } from "./factSource";
import type {
  FactConfidenceLevel,
  FactId,
  FactKind,
  GeographicAttribute,
  QualitativeCategory,
  QuantitativeMetric,
  RegulatoryRuleType,
} from "./localFact";
import type { LocalSeoTopicSlug, TopicFamily } from "./topics";

export const TOPIC_REQUIREMENTS_VERSION = "seo-v3-topic-requirements/draft-2";

/** Where a numeric threshold comes from. */
export type ThresholdBasis =
  /** Mirrors the Intelligence V2 public market overview governance (5 / 20 samples, 90 days). */
  | "aligned_with_v2_public_overview"
  /** A reasoned draft that no one has confirmed yet. */
  | "provisional_pending_human_decision";

type FactRequirementCommon = Readonly<{
  /** Stable key used in missing-fact reports. */
  requirementId: string;
  acceptableSourceTypes: readonly FactSourceType[];
  minimumConfidence: FactConfidenceLevel;
  /**
   * Maximum age in days, counted from the end of the observed period (or from `collectedAt` when the
   * fact has no period). Beyond it the fact counts as expired.
   */
  maxAgeDays: number;
  /** Minimum sample for measured figures; null when sampling does not apply. */
  minimumSampleSize: number | null;
  requiresHumanValidation: boolean;
  /** True when the fact may only be shown after an explicit public-use approval. */
  requiresPublicUseApproval: boolean;
  thresholdBasis: ThresholdBasis;
}>;

export type FactRequirement = FactRequirementCommon &
  (
    | Readonly<{ kind: "quantitative"; metric: QuantitativeMetric }>
    | Readonly<{ kind: "qualitative"; category: QualitativeCategory }>
    | Readonly<{ kind: "regulatory"; ruleType: RegulatoryRuleType | "any" | readonly RegulatoryRuleType[] }>
    | Readonly<{ kind: "geographic"; attribute: GeographicAttribute }>
  );

/** Statements a topic must never contain unless a supporting fact makes them true. */
export type ForbiddenClaimCode =
  | "average_price_without_source"
  | "occupancy_rate_from_unavailability"
  | "revenue_estimate_without_source"
  | "demand_level_without_source"
  | "seasonal_peak_without_source"
  | "ranking_formula"
  | "local_conversion_rate"
  | "local_review_average"
  | "regulatory_rule_without_official_source";

/**
 *  - requires_all_required_facts       : the page may be standalone once every required fact passes.
 *  - requires_human_editorial_decision : the topic carries no local value by itself; a person must
 *                                        decide (for instance because the page has bespoke content).
 */
export type StandalonePolicy = "requires_all_required_facts" | "requires_human_editorial_decision";

export type TopicRequirements = Readonly<{
  topic: LocalSeoTopicSlug;
  family: TopicFamily;
  required: readonly FactRequirement[];
  optional: readonly FactRequirement[];
  standalonePolicy: StandalonePolicy;
  /** Decision when a required fact is absent, expired, unvalidated or too weak. */
  eligibilityWhenRequiredMissing: Exclude<EditorialEligibility, "publishable_standalone">;
  /** Optional sections whose facts are missing are left out; they are never filled with generic text. */
  onMissingOptional: "omit_section";
  /** What justifies a standalone page for this topic. */
  standaloneValue: string;
  forbiddenClaims: readonly ForbiddenClaimCode[];
  /** A product question that this table cannot settle, or null. */
  openDecision: string | null;
}>;

// --- Requirement builders (pure data) ---------------------------------------------------------

const priceDistribution: FactRequirement = {
  requirementId: "nightly_price_distribution",
  kind: "quantitative",
  metric: "nightly_price_distribution",
  acceptableSourceTypes: ["licensed_dataset", "user_audit_aggregate"],
  minimumConfidence: "moderate",
  maxAgeDays: 90,
  minimumSampleSize: 20,
  requiresHumanValidation: true,
  requiresPublicUseApproval: true,
  thresholdBasis: "aligned_with_v2_public_overview",
};

const calendarUnavailability: FactRequirement = {
  requirementId: "calendar_unavailability_rate",
  kind: "quantitative",
  metric: "calendar_unavailability_rate",
  acceptableSourceTypes: ["licensed_dataset", "user_audit_aggregate"],
  minimumConfidence: "moderate",
  maxAgeDays: 90,
  minimumSampleSize: 20,
  requiresHumanValidation: true,
  requiresPublicUseApproval: true,
  thresholdBasis: "provisional_pending_human_decision",
};

const officialStatistic: FactRequirement = {
  requirementId: "official_statistic",
  kind: "quantitative",
  metric: "official_statistic",
  acceptableSourceTypes: ["official_authority", "official_tourism_body", "published_research"],
  minimumConfidence: "high",
  maxAgeDays: 540,
  minimumSampleSize: null,
  requiresHumanValidation: true,
  requiresPublicUseApproval: false,
  thresholdBasis: "provisional_pending_human_decision",
};

function qualitative(requirementId: string, category: QualitativeCategory, maxAgeDays = 730): FactRequirement {
  return {
    requirementId,
    kind: "qualitative",
    category,
    acceptableSourceTypes: ["editorial_note", "official_tourism_body", "published_research"],
    minimumConfidence: "moderate",
    maxAgeDays,
    minimumSampleSize: null,
    requiresHumanValidation: true,
    requiresPublicUseApproval: false,
    thresholdBasis: "provisional_pending_human_decision",
  };
}

const demandDriver = qualitative("demand_driver", "demand_driver", 365);

const anyOfficialRule: FactRequirement = {
  requirementId: "official_rule",
  kind: "regulatory",
  ruleType: "any",
  acceptableSourceTypes: ["official_authority"],
  minimumConfidence: "high",
  maxAgeDays: 180,
  minimumSampleSize: null,
  requiresHumanValidation: true,
  requiresPublicUseApproval: false,
  thresholdBasis: "provisional_pending_human_decision",
};

/**
 * Long-stay rule: optional for long-stay-guide, and only a stay-length rule can satisfy it. The type is a
 * mechanical admissibility filter, never proof of relevance: a person must still confirm that the cited text
 * really concerns the length of a stay (see the human steps of the collection sheet).
 */
const longStayRule: FactRequirement = {
  ...anyOfficialRule,
  requirementId: "long_stay_rule",
  ruleType: ["minimum_stay", "night_cap"],
};

// --- Draft table ------------------------------------------------------------------------------

const DATA_VALUE = "A verified local figure with its sample size, observation period and confidence shown.";
const QUALITATIVE_VALUE = "A human-validated local observation that changes the advice for this city.";
const UNIVERSAL_VALUE = "None by itself: the advice does not change with the city.";

export const TOPIC_REQUIREMENTS: Readonly<Record<LocalSeoTopicSlug, TopicRequirements>> = {
  // data_dependent -------------------------------------------------------------------------
  "pricing-guide": {
    topic: "pricing-guide",
    family: "data_dependent",
    required: [priceDistribution],
    optional: [demandDriver],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: DATA_VALUE,
    forbiddenClaims: ["average_price_without_source", "seasonal_peak_without_source"],
    openDecision: null,
  },
  "pricing-positioning": {
    topic: "pricing-positioning",
    family: "data_dependent",
    required: [priceDistribution],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: DATA_VALUE,
    forbiddenClaims: ["average_price_without_source"],
    openDecision: null,
  },
  "revenue-optimization": {
    topic: "revenue-optimization",
    family: "data_dependent",
    required: [priceDistribution, calendarUnavailability],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: "Measured price and calendar-unavailability figures for the same market, never combined into a revenue estimate.",
    forbiddenClaims: [
      "revenue_estimate_without_source",
      "occupancy_rate_from_unavailability",
      "average_price_without_source",
    ],
    openDecision: null,
  },
  "occupancy-guide": {
    topic: "occupancy-guide",
    family: "data_dependent",
    required: [calendarUnavailability],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: "A measured calendar-unavailability figure, labelled as unavailability and never as occupancy.",
    forbiddenClaims: ["occupancy_rate_from_unavailability"],
    openDecision: null,
  },
  "seasonality-guide": {
    topic: "seasonality-guide",
    family: "data_dependent",
    required: [demandDriver],
    optional: [calendarUnavailability],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: "An officially sourced event or season calendar for the city.",
    forbiddenClaims: ["seasonal_peak_without_source", "demand_level_without_source"],
    openDecision: null,
  },
  "market-analysis": {
    topic: "market-analysis",
    family: "data_dependent",
    required: [priceDistribution],
    optional: [calendarUnavailability, anyOfficialRule],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: DATA_VALUE,
    forbiddenClaims: [
      "average_price_without_source",
      "demand_level_without_source",
      "occupancy_rate_from_unavailability",
    ],
    openDecision: null,
  },
  "local-demand-guide": {
    topic: "local-demand-guide",
    family: "data_dependent",
    required: [demandDriver],
    optional: [officialStatistic],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: "A sourced explanation of what drives visits to this city.",
    forbiddenClaims: ["demand_level_without_source"],
    openDecision: null,
  },
  "competitor-analysis": {
    topic: "competitor-analysis",
    family: "data_dependent",
    required: [priceDistribution],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "needs_data",
    onMissingOptional: "omit_section",
    standaloneValue: "Aggregated comparable listings for the market, never individual competitors.",
    forbiddenClaims: ["average_price_without_source"],
    openDecision: "Comparable-listing data comes from audits: public use needs the data-governance decision first.",
  },

  // local_qualitative ----------------------------------------------------------------------
  "family-travel-guide": {
    topic: "family-travel-guide",
    family: "local_qualitative",
    required: [qualitative("guest_expectation", "guest_expectation")],
    optional: [anyOfficialRule],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: QUALITATIVE_VALUE,
    forbiddenClaims: ["regulatory_rule_without_official_source", "demand_level_without_source"],
    openDecision: null,
  },
  "business-travel-guide": {
    topic: "business-travel-guide",
    family: "local_qualitative",
    required: [qualitative("neighbourhood_context", "neighbourhood_context")],
    optional: [anyOfficialRule],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: QUALITATIVE_VALUE,
    forbiddenClaims: ["regulatory_rule_without_official_source", "demand_level_without_source"],
    openDecision: null,
  },
  "long-stay-guide": {
    topic: "long-stay-guide",
    family: "local_qualitative",
    required: [],
    optional: [longStayRule, qualitative("guest_expectation", "guest_expectation")],
    // no required fact: a person must decide, so the page can never become ready on facts alone
    standalonePolicy: "requires_human_editorial_decision",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: "None by itself: an officially sourced stay-length rule (minimum stay or night cap) may add local value when one is validated.",
    forbiddenClaims: ["regulatory_rule_without_official_source"],
    openDecision: null,
  },
  "amenities-guide": {
    topic: "amenities-guide",
    family: "local_qualitative",
    required: [qualitative("guest_expectation", "guest_expectation")],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: QUALITATIVE_VALUE,
    forbiddenClaims: ["demand_level_without_source"],
    openDecision: null,
  },
  "guest-trust-guide": {
    topic: "guest-trust-guide",
    family: "local_qualitative",
    required: [qualitative("access_and_arrival", "access_and_arrival")],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: QUALITATIVE_VALUE,
    forbiddenClaims: ["local_review_average"],
    openDecision: null,
  },
  "photo-tips": {
    topic: "photo-tips",
    family: "local_qualitative",
    required: [qualitative("visual_character", "visual_character")],
    optional: [],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: QUALITATIVE_VALUE,
    forbiddenClaims: [],
    openDecision: null,
  },
  "first-photo": {
    topic: "first-photo",
    family: "local_qualitative",
    required: [qualitative("visual_character", "visual_character")],
    optional: [qualitative("architecture_or_layout", "architecture_or_layout")],
    standalonePolicy: "requires_all_required_facts",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: QUALITATIVE_VALUE,
    forbiddenClaims: [],
    openDecision: null,
  },

  // universal ------------------------------------------------------------------------------
  "seo-guide": universal("seo-guide", []),
  "title-optimization": universal("title-optimization", []),
  "description-optimization": universal("description-optimization", []),
  "ranking-factors": universal("ranking-factors", ["ranking_formula"]),
  "search-visibility": universal("search-visibility", ["ranking_formula"]),
  "booking-conversion": universal("booking-conversion", ["local_conversion_rate"]),
  "conversion-guide": universal("conversion-guide", ["local_conversion_rate"]),
  "photo-order": universal("photo-order", []),
  "review-strategy": universal("review-strategy", ["local_review_average"]),
  "listing-audit": universal(
    "listing-audit",
    [],
    "Whether the audit entry point alone justifies a city page is a product decision.",
  ),
};

function universal(
  topic: LocalSeoTopicSlug,
  forbiddenClaims: readonly ForbiddenClaimCode[],
  openDecision: string | null = null,
): TopicRequirements {
  return {
    topic,
    family: "universal",
    required: [],
    optional: [qualitative("guest_expectation", "guest_expectation")],
    standalonePolicy: "requires_human_editorial_decision",
    eligibilityWhenRequiredMissing: "hub_section_only",
    onMissingOptional: "omit_section",
    standaloneValue: UNIVERSAL_VALUE,
    forbiddenClaims,
    openDecision,
  };
}

// --- Missing data -----------------------------------------------------------------------------

export type MissingFactReason =
  | "absent"
  | "expired"
  | "not_validated"
  | "confidence_too_low"
  | "sample_too_small"
  | "public_use_not_approved"
  | "source_type_not_accepted";

/** A requirement that could not be met, reported instead of being filled with generic text. */
export type MissingFact = Readonly<{
  requirementId: string;
  kind: FactKind;
  topic: LocalSeoTopicSlug;
  reason: MissingFactReason;
  /** A fact that exists but fails the requirement (for instance an expired one), if any. */
  closestFactId: FactId | null;
}>;
