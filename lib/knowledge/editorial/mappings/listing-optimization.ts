import type { EditorialMapping } from "../mapping-registry";

const listingOptimizationGuideId = "content:guide:airbnb-listing-optimization" as const;
const listingOptimizationSolutionId = "content:solution:airbnb-listing-optimization" as const;
const listingOptimizationTopicId = "topic:listing-optimization" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const specializedPillarIds = [
  "content:guide:airbnb-seo",
  "content:guide:airbnb-conversion-optimization",
  "content:guide:airbnb-trust-optimization",
  "content:guide:airbnb-photo-optimization",
] as const;

/** Transversal hub mapping for Listing Optimization. It is not a cluster membership declaration. */
export const listingOptimizationEditorialMappings: readonly EditorialMapping[] = [
  { type: "is_about", sourceId: listingOptimizationGuideId, targetId: listingOptimizationTopicId },
  { type: "applies_to", sourceId: listingOptimizationGuideId, targetId: airbnbPlatformId },
  { type: "commercial_path_to", sourceId: listingOptimizationGuideId, targetId: listingOptimizationSolutionId },
  { type: "is_about", sourceId: listingOptimizationSolutionId, targetId: listingOptimizationTopicId },
  { type: "applies_to", sourceId: listingOptimizationSolutionId, targetId: airbnbPlatformId },
  ...specializedPillarIds.map((targetId) => ({
    type: "related_to" as const,
    sourceId: listingOptimizationGuideId,
    targetId,
  })),
];
