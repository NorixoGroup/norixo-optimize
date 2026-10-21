/**
 * SEO generator V3 — the verifiable local fact (contract only).
 *
 * A LocalFact is immutable. A correction is a NEW fact with `version + 1` and `supersedes`
 * pointing at the previous one; nothing is edited in place.
 *
 * Safety rules encoded in the types:
 *  - there is no `occupancy_rate` metric: calendar unavailability is its own metric and carries a
 *    literal `semantics` marker, so it cannot be mistaken for occupancy;
 *  - every fact has a `validUntil`: an undated fact does not exist;
 *  - `human_validated` and `approved` cannot be expressed without the record of who decided;
 *  - nothing here is "published by default": public use starts at `forbidden` or
 *    `requires_human_approval`.
 */
import type {
  IntelligenceV2Platform,
  IntelligenceV2PropertyType,
} from "../../intelligenceV2/marketCell";

import type { FactSource, IsoDate, IsoDateTime } from "./factSource";
import type { LocalSeoTopicSlug } from "./topics";

/**
 * Stable identifier derived from scope, kind, metric/attribute and observed period.
 * It must never embed a user, workspace, listing or audit identifier.
 */
export type FactId = `fact:${string}`;

export type FactKind = "quantitative" | "qualitative" | "regulatory" | "geographic";

// --- Scope ------------------------------------------------------------------------------------

export type GeographicScope =
  | Readonly<{ level: "country"; countryCode: string }>
  | Readonly<{ level: "city"; countryCode: string; citySlug: string }>
  | Readonly<{ level: "district"; countryCode: string; citySlug: string; districtName: string }>;

/** V2 uses "unknown" for unresolved values; a V3 fact states "not applicable" with null instead. */
export type FactPlatform = Exclude<IntelligenceV2Platform, "unknown"> | null;
export type FactPropertyType = Exclude<IntelligenceV2PropertyType, "unknown"> | null;

// --- Values -----------------------------------------------------------------------------------

/**
 * Deliberately has NO "occupancy_rate". Calendar unavailability is not a booking.
 * Adding an occupancy metric would require a new, explicit decision.
 */
export type QuantitativeMetric =
  | "nightly_price_distribution"
  | "calendar_unavailability_rate"
  | "official_statistic";

export type QuantitativeValue =
  | Readonly<{
      metric: "nightly_price_distribution";
      currency: string;
      median: number;
      p10?: number;
      p25?: number;
      p75?: number;
      p90?: number;
      sampleSize: number;
    }>
  | Readonly<{
      metric: "calendar_unavailability_rate";
      /** Share of observed nights that were unavailable, between 0 and 1. */
      ratio: number;
      /** Literal marker: this is unavailability, never occupancy. */
      semantics: "calendar_unavailability_not_occupancy";
      observedNights: number;
      sampleSize: number;
    }>
  | Readonly<{
      metric: "official_statistic";
      name: string;
      value: number;
    }>;

export type QualitativeCategory =
  | "guest_expectation"
  | "architecture_or_layout"
  | "visual_character"
  | "access_and_arrival"
  | "neighbourhood_context"
  | "demand_driver";

export type QualitativeValue = Readonly<{
  category: QualitativeCategory;
  statement: string;
  language: string;
  /** Whether the statement restates a cited source or is an editorial observation. */
  basis: "cited_source" | "editorial_observation";
}>;

export type RegulatoryRuleType =
  | "registration_required"
  | "night_cap"
  | "minimum_stay"
  | "tax"
  | "permit"
  | "other";

export type RegulatoryValue = Readonly<{
  ruleType: RegulatoryRuleType;
  rule: string;
  effectiveFrom: IsoDate | null;
  effectiveUntil: IsoDate | null;
  /** Article, decree or page of the official text. */
  officialReference: string;
}>;

export type GeographicAttribute =
  | "country"
  | "region"
  | "timezone"
  | "primary_language"
  | "neighbourhood_name";

export type GeographicValue = Readonly<{
  attribute: GeographicAttribute;
  value: string;
}>;

// --- Time, confidence, validation, usage ------------------------------------------------------

export type ObservedPeriod = Readonly<{ start: IsoDate; end: IsoDate }>;

/**
 * Same five levels as the Intelligence V2 benchmark artifacts (checked in compat.ts), so a V2
 * benchmark can be mapped without translation.
 */
export type FactConfidenceLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

export type FactConfidence = Readonly<{
  level: FactConfidenceLevel;
  rationale: string;
}>;

export type FactValidation =
  | Readonly<{ status: "draft" }>
  | Readonly<{ status: "pending_review"; submittedAt: IsoDateTime }>
  | Readonly<{
      status: "human_validated";
      /** Reviewer role or opaque reviewer id; not a personal name. */
      validatedBy: string;
      validatedAt: IsoDateTime;
      note: string | null;
    }>
  | Readonly<{ status: "rejected"; rejectedAt: IsoDateTime; reason: string }>
  | Readonly<{ status: "revoked"; revokedAt: IsoDateTime; reason: string }>;

/** Display obligations the renderer and the claim validator must honour for this fact. */
export type DisplayConstraint =
  | "show_sample_size"
  | "show_observation_period"
  | "show_confidence"
  | "attribute_source"
  | "label_as_unavailability_not_occupancy"
  | "no_benchmark_language"
  | "label_as_editorial_note";

export type PublicUse =
  | Readonly<{ publicUse: "forbidden" }>
  | Readonly<{ publicUse: "requires_human_approval" }>
  | Readonly<{
      publicUse: "approved";
      approval: Readonly<{
        approvedBy: string;
        approvedAt: IsoDateTime;
        /** Topics for which the approval holds; "any_topic" must be a deliberate choice. */
        scope: "any_topic" | readonly LocalSeoTopicSlug[];
      }>;
    }>;

export type UsageRestrictions = Readonly<{
  use: PublicUse;
  displayConstraints: readonly DisplayConstraint[];
}>;

// --- The fact ---------------------------------------------------------------------------------

type LocalFactBase = Readonly<{
  factId: FactId;
  scope: GeographicScope;
  platform: FactPlatform;
  propertyType: FactPropertyType;
  /** Unit of the value when it is not implied by the value type (ISO 4217 code, "%", …). */
  unit: string | null;
  source: FactSource;
  collectedAt: IsoDateTime;
  /** Period the data describes, when it describes one (null for an editorial observation). */
  observedPeriod: ObservedPeriod | null;
  /** The fact must not be treated as current after this instant. Required. */
  validUntil: IsoDateTime;
  confidence: FactConfidence;
  validation: FactValidation;
  usage: UsageRestrictions;
  /** Topics this fact is relevant to. Relevance is a claim of the registry, not of the page. */
  relevantTopics: readonly LocalSeoTopicSlug[];
  /** Starts at 1. */
  version: number;
  /** Fact this one replaces, or null for the first version. */
  supersedes: FactId | null;
}>;

export type QuantitativeFact = LocalFactBase &
  Readonly<{ kind: "quantitative"; value: QuantitativeValue }>;
export type QualitativeFact = LocalFactBase &
  Readonly<{ kind: "qualitative"; value: QualitativeValue }>;
export type RegulatoryFact = LocalFactBase &
  Readonly<{ kind: "regulatory"; value: RegulatoryValue }>;
export type GeographicFact = LocalFactBase &
  Readonly<{ kind: "geographic"; value: GeographicValue }>;

export type LocalFact = QuantitativeFact | QualitativeFact | RegulatoryFact | GeographicFact;
