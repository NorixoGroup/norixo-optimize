/**
 * SEO generator V3 — topic catalogue (contract only, no runtime behaviour).
 *
 * The 25 slugs mirror data/localSeo.ts. They are declared here as a literal union so that the
 * contracts can be exhaustive (`Record<LocalSeoTopicSlug, …>`). A future test (S2) must assert that
 * this list and data/localSeo.ts stay identical; V3 deliberately does not import the data file.
 */

export const LOCAL_SEO_TOPIC_SLUGS = [
  "pricing-guide",
  "seo-guide",
  "photo-tips",
  "title-optimization",
  "description-optimization",
  "amenities-guide",
  "guest-trust-guide",
  "booking-conversion",
  "ranking-factors",
  "search-visibility",
  "occupancy-guide",
  "revenue-optimization",
  "competitor-analysis",
  "listing-audit",
  "photo-order",
  "first-photo",
  "review-strategy",
  "pricing-positioning",
  "seasonality-guide",
  "family-travel-guide",
  "business-travel-guide",
  "long-stay-guide",
  "local-demand-guide",
  "market-analysis",
  "conversion-guide",
] as const;

export type LocalSeoTopicSlug = (typeof LOCAL_SEO_TOPIC_SLUGS)[number];

/**
 * How much a topic depends on local facts.
 *  - data_dependent    : needs measured or officially published local figures.
 *  - local_qualitative : can be useful with a human-validated qualitative local note.
 *  - universal         : the advice does not change with the city; local facts are optional.
 */
export type TopicFamily = "data_dependent" | "local_qualitative" | "universal";

/** Page path of a city x topic page. Pure type; building it is the caller's concern. */
export type CityTopicPath = `/airbnb-optimizer/${string}/${LocalSeoTopicSlug}`;
