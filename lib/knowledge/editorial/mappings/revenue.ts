import type { EditorialMapping } from "../mapping-registry";

const revenuePillarId = "content:guide:airbnb-revenue-optimization" as const;
const revenueTopicId = "topic:revenue" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const revenueArticleIds = [
  "content:article:airbnb-occupancy-rate",
  "content:article:airbnb-adr",
  "content:article:airbnb-revpar",
] as const;

const revenueToolIds = [
  "content:tool:airbnb-adr-calculator",
  "content:tool:airbnb-occupancy-calculator",
  "content:tool:airbnb-revpar-calculator",
  "content:tool:airbnb-revenue-calculator",
  "content:tool:airbnb-pricing-calculator",
  "content:tool:airbnb-profit-calculator",
] as const;

const mapRevenueContent = (contentId: (typeof revenueArticleIds)[number]): EditorialMapping[] => [
  { type: "is_about", sourceId: contentId, targetId: revenueTopicId },
  { type: "part_of_cluster", sourceId: contentId, targetId: revenueTopicId },
  { type: "supports", sourceId: contentId, targetId: revenuePillarId },
];

/** Canonical Phase 1E mappings for the Revenue / KPI pilot only. */
export const revenueEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: revenuePillarId, targetId: revenueTopicId },
  { type: "is_about", sourceId: revenuePillarId, targetId: revenueTopicId },
  { type: "part_of_cluster", sourceId: revenuePillarId, targetId: revenueTopicId },
  { type: "applies_to", sourceId: revenuePillarId, targetId: airbnbPlatformId },
  { type: "commercial_path_to", sourceId: revenuePillarId, targetId: "content:solution:airbnb-revenue-optimization" },
  ...revenueArticleIds.flatMap(mapRevenueContent),
  ...revenueToolIds.flatMap((contentId) => [
    { type: "part_of_cluster" as const, sourceId: contentId, targetId: revenueTopicId },
    { type: "supports" as const, sourceId: contentId, targetId: revenuePillarId },
  ]),
  { type: "is_about", sourceId: "content:solution:airbnb-revenue-optimization", targetId: revenueTopicId },
  { type: "part_of_cluster", sourceId: "content:solution:airbnb-revenue-optimization", targetId: revenueTopicId },
  { type: "applies_to", sourceId: "content:solution:airbnb-revenue-optimization", targetId: airbnbPlatformId },
];
