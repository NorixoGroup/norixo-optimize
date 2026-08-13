import type { EditorialMapping } from "../mapping-registry";

const conversionTopicId = "topic:conversion" as const;
const conversionPillarId = "content:guide:airbnb-conversion-optimization" as const;
const conversionSupportGuideId = "content:guide:airbnb-listing-audit" as const;
const conversionDescriptionGeneratorGuideId = "content:guide:airbnb-description-generator" as const;
const conversionSolutionId = "content:solution:airbnb-conversion-optimization" as const;
const conversionAuditSolutionId = "content:solution:airbnb-listing-audit" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const conversionArticleIds = [
  "content:article:airbnb-conversion-rate",
  "content:article:airbnb-booking-funnel",
  "content:article:airbnb-ctr",
  "content:article:airbnb-listing-trust",
  "content:article:airbnb-instant-book",
  "content:article:airbnb-booking-psychology",
  "content:article:airbnb-amenities",
  "content:article:airbnb-booking-confidence",
  "content:article:airbnb-listing-copywriting",
  "content:article:airbnb-guest-objections",
  "content:article:airbnb-booking-friction",
] as const;

const conversionSolutionIds = [conversionSolutionId, conversionAuditSolutionId] as const;

/** Canonical mapping for the Conversion cluster. */
export const conversionEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: conversionPillarId, targetId: conversionTopicId },
  { type: "is_about", sourceId: conversionPillarId, targetId: conversionTopicId },
  { type: "part_of_cluster", sourceId: conversionPillarId, targetId: conversionTopicId },
  { type: "applies_to", sourceId: conversionPillarId, targetId: airbnbPlatformId },
  { type: "commercial_path_to", sourceId: conversionPillarId, targetId: conversionSolutionId },
  { type: "commercial_path_to", sourceId: conversionPillarId, targetId: conversionAuditSolutionId },
  ...conversionArticleIds.flatMap((sourceId) => [
    { type: "is_about" as const, sourceId, targetId: conversionTopicId },
    { type: "part_of_cluster" as const, sourceId, targetId: conversionTopicId },
    { type: "supports" as const, sourceId, targetId: conversionPillarId },
    { type: "applies_to" as const, sourceId, targetId: airbnbPlatformId },
  ]),
  { type: "is_about", sourceId: conversionSupportGuideId, targetId: conversionTopicId },
  { type: "part_of_cluster", sourceId: conversionSupportGuideId, targetId: conversionTopicId },
  { type: "supports", sourceId: conversionSupportGuideId, targetId: conversionPillarId },
  { type: "applies_to", sourceId: conversionSupportGuideId, targetId: airbnbPlatformId },
  { type: "is_about", sourceId: conversionDescriptionGeneratorGuideId, targetId: conversionTopicId },
  { type: "part_of_cluster", sourceId: conversionDescriptionGeneratorGuideId, targetId: conversionTopicId },
  { type: "supports", sourceId: conversionDescriptionGeneratorGuideId, targetId: conversionPillarId },
  { type: "applies_to", sourceId: conversionDescriptionGeneratorGuideId, targetId: airbnbPlatformId },
  ...conversionSolutionIds.flatMap((sourceId) => [
    { type: "is_about" as const, sourceId, targetId: conversionTopicId },
    { type: "part_of_cluster" as const, sourceId, targetId: conversionTopicId },
    { type: "applies_to" as const, sourceId, targetId: airbnbPlatformId },
  ]),
];
