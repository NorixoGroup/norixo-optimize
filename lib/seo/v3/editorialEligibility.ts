/**
 * SEO generator V3 — editorial eligibility (contract only).
 *
 * This answers ONE question: does the content deserve to exist as a standalone page?
 * It is intentionally independent from every technical indexing decision:
 *  - robots index / noindex,
 *  - sitemap inclusion,
 *  - canonical and redirects.
 * Those stay in lib/seo/searchEligibility.ts and lib/seo/sitemapEligibility.ts and are changed by a
 * separate, human-approved decision. An editorial decision never implies an indexing decision
 * (enforced at type level in compat.ts: no indexing key may appear on EditorialDecision).
 */
import type { IsoDateTime } from "./factSource";

export const EDITORIAL_ELIGIBILITY_VALUES = [
  "publishable_standalone",
  "hub_section_only",
  "needs_data",
] as const;

export type EditorialEligibility = (typeof EDITORIAL_ELIGIBILITY_VALUES)[number];

export type EditorialDecisionReason =
  | "all_required_facts_present"
  | "required_fact_missing"
  | "required_fact_expired"
  | "required_fact_not_validated"
  | "required_fact_confidence_too_low"
  | "required_fact_sample_too_small"
  | "required_fact_public_use_not_approved"
  | "topic_has_no_local_value"
  | "human_editorial_decision";

export type EditorialDecider =
  | Readonly<{ kind: "rule"; ruleVersion: string }>
  | Readonly<{
      kind: "human";
      /** Reviewer role or opaque reviewer id; not a personal name. */
      reviewer: string;
      decidedAt: IsoDateTime;
      note: string;
    }>;

export type EditorialDecision = Readonly<{
  eligibility: EditorialEligibility;
  /** Never empty: every decision states why. */
  reasons: readonly [EditorialDecisionReason, ...EditorialDecisionReason[]];
  decidedBy: EditorialDecider;
  /** The instant used to judge freshness. Passed in, never read from the clock, so runs are repeatable. */
  asOf: IsoDateTime;
}>;
