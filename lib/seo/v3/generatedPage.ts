/**
 * SEO generator V3 — a generated page and its traceability (contract only).
 *
 * A GeneratedPage is a pure value: no timestamp is read from the clock (the evaluation instant is
 * `eligibility.asOf`), so the same inputs always describe the same page. It carries no indexing
 * information on purpose; see editorialEligibility.ts.
 */
import type { EditorialDecision } from "./editorialEligibility";
import type { GeneratedClaim } from "./generatedClaim";
import type { FactId } from "./localFact";
import type { MissingFact } from "./topicRequirements";
import type { CityTopicPath, LocalSeoTopicSlug } from "./topics";

export const GENERATOR_V3_CONTRACT_VERSION = "seo-v3-contract/1";

export type PageSection = Readonly<{
  sectionId: string;
  heading: string;
  claims: readonly GeneratedClaim[];
}>;

/** One input fact as it was when the page was built (id + version identify it exactly). */
export type FactSnapshotRef = Readonly<{
  factId: FactId;
  version: number;
}>;

export type PageTraceability = Readonly<{
  /** Hash of the registry snapshot the page was built from. */
  registrySnapshotId: string;
  /** Hash of the inputs (city, topic, facts, requirements version), for repeatability checks. */
  inputsFingerprint: string;
  inputFacts: readonly FactSnapshotRef[];
  /** Hash of the rendered content, or null until the page has been rendered. */
  contentHash: string | null;
  /** Where to fall back to if the page is withdrawn. */
  rollbackTarget: "v2_current_renderer";
}>;

export type GeneratedPage = Readonly<{
  citySlug: string;
  topic: LocalSeoTopicSlug;
  pathname: CityTopicPath;
  sections: readonly PageSection[];
  /**
   * Invariant for the S3 validator: equals the set of fact ids cited by `sections[].claims[]`
   * (`supportingFactIds`, `basisFactIds` and `figures[].factId`), without duplicates.
   */
  usedFactIds: readonly FactId[];
  missingFacts: readonly MissingFact[];
  eligibility: EditorialDecision;
  generator: Readonly<{
    contractVersion: typeof GENERATOR_V3_CONTRACT_VERSION;
    topicRequirementsVersion: string;
  }>;
  traceability: PageTraceability;
}>;
