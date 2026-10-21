/**
 * SEO generator V3 — compile-time compatibility and safety assertions (types only, no runtime code).
 *
 * Nothing in this file exists at runtime: every export is a type, and the V2 imports are
 * `import type`, which the compiler erases. V3 therefore does not load any Intelligence V2 module
 * (several of them reach the database client). If a V2 type changes, `tsc` fails here.
 *
 * Documented incompatibilities with Intelligence V2 (deliberate, not bugs):
 *  - V2 public-overview confidence ("standard" | "high") and sample bands are coarser than the
 *    five-level confidence used by V3 and by the V2 benchmark artifacts; V3 follows the latter.
 *  - V2 facts are anonymous numeric records with no publisher, locator or evidence anchor; V3 facts
 *    require all three, so a V2 benchmark can become a V3 fact only after a provenance wrapper (S2+).
 *  - V2 freshness is derived from a 90-day window end; V3 freshness is a per-topic `maxAgeDays`.
 *  - V2 uses "unknown" for unresolved platform/property type; V3 uses null.
 */
import type { IntelligenceV2Platform, IntelligenceV2PropertyType } from "../../intelligenceV2/marketCell";
import type { OccupancyBenchmarkConfidenceLevel } from "../../intelligenceV2/occupancyBenchmarkArtifact";
import type { PricingBenchmarkConfidenceLevel } from "../../intelligenceV2/pricingBenchmarkBuilder";

import type { EditorialDecision } from "./editorialEligibility";
import type { GeneratedPage } from "./generatedPage";
import type {
  FactConfidenceLevel,
  FactPlatform,
  FactPropertyType,
  QuantitativeMetric,
} from "./localFact";
import type { TOPIC_REQUIREMENTS } from "./topicRequirements";
import type { LocalSeoTopicSlug } from "./topics";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

/** Confidence levels match both V2 benchmark artifact types exactly. */
export type ConfidenceMatchesV2Pricing = Assert<Equal<FactConfidenceLevel, PricingBenchmarkConfidenceLevel>>;
export type ConfidenceMatchesV2Occupancy = Assert<Equal<FactConfidenceLevel, OccupancyBenchmarkConfidenceLevel>>;

/** V3 platform / property type are the V2 ones minus "unknown". */
export type PlatformMatchesV2 = Assert<
  Equal<NonNullable<FactPlatform>, Exclude<IntelligenceV2Platform, "unknown">>
>;
export type PropertyTypeMatchesV2 = Assert<
  Equal<NonNullable<FactPropertyType>, Exclude<IntelligenceV2PropertyType, "unknown">>
>;

/** No metric can be confused with occupancy. */
export type NoOccupancyMetric = Assert<
  "occupancy_rate" extends QuantitativeMetric ? false : "occupancy" extends QuantitativeMetric ? false : true
>;

/** Editorial decisions and pages carry no indexing information. */
type IndexingKeys = "index" | "noindex" | "indexDirective" | "robots" | "sitemap" | "sitemapEligible" | "canonical";
export type EditorialDecisionHasNoIndexingKey = Assert<
  Extract<keyof EditorialDecision, IndexingKeys> extends never ? true : false
>;
export type GeneratedPageHasNoIndexingKey = Assert<
  Extract<keyof GeneratedPage, IndexingKeys> extends never ? true : false
>;

/** The requirements table covers exactly the 25 topics (no missing, no extra). */
export type RequirementsCoverEveryTopic = Assert<
  Equal<keyof typeof TOPIC_REQUIREMENTS, LocalSeoTopicSlug>
>;
