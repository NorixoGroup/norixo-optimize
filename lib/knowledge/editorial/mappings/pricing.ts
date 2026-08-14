import type { EditorialMapping } from "../mapping-registry";

const pricingPillarId = "content:guide:airbnb-pricing-optimization" as const;
const pricingTopicId = "topic:pricing" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const pricingArticleIds = [
  "content:article:airbnb-pricing-strategy",
  "content:article:airbnb-dynamic-pricing",
  "content:article:airbnb-seasonal-pricing",
  "content:article:how-to-price-an-airbnb",
  "content:article:airbnb-weekend-pricing",
  "content:article:airbnb-last-minute-pricing",
  "content:article:airbnb-discount-strategy",
  "content:article:airbnb-competitor-pricing",
  "content:article:airbnb-minimum-stay-strategy",
] as const;

const pricingMetricArticleMappings: readonly EditorialMapping[] = [
  {
    type: "uses_metric",
    sourceId: "content:article:airbnb-occupancy-rate",
    targetId: "metrics.occupancy-rate",
  },
  {
    type: "uses_metric",
    sourceId: "content:article:airbnb-adr",
    targetId: "metrics.average-daily-rate",
  },
  {
    type: "uses_metric",
    sourceId: "content:article:airbnb-revpar",
    targetId: "metrics.revenue-per-available-rental-night",
  },
];

const pricingMetricArticleIds = pricingMetricArticleMappings.map((mapping) => mapping.sourceId);

const pricingToolMetricMappings: readonly EditorialMapping[] = [
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-adr-calculator",
    targetId: "metrics.average-daily-rate",
  },
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-occupancy-calculator",
    targetId: "metrics.occupancy-rate",
  },
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-revpar-calculator",
    targetId: "metrics.revenue-per-available-rental-night",
  },
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-revenue-calculator",
    targetId: "revenue.accommodation-revenue",
  },
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-pricing-calculator",
    targetId: "revenue.accommodation-revenue",
  },
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-pricing-calculator",
    targetId: "inventory.booked-nights",
  },
  {
    type: "uses_metric",
    sourceId: "content:tool:airbnb-profit-calculator",
    targetId: "revenue.accommodation-revenue",
  },
];

const pricingToolIds = [
  "content:tool:airbnb-adr-calculator",
  "content:tool:airbnb-occupancy-calculator",
  "content:tool:airbnb-revpar-calculator",
  "content:tool:airbnb-revenue-calculator",
  "content:tool:airbnb-pricing-calculator",
  "content:tool:airbnb-profit-calculator",
] as const;

const mapPricingContent = (
  contentId: (typeof pricingArticleIds)[number] | (typeof pricingMetricArticleIds)[number]
): EditorialMapping[] => [
  { type: "is_about", sourceId: contentId, targetId: pricingTopicId },
  { type: "part_of_cluster", sourceId: contentId, targetId: pricingTopicId },
  { type: "applies_to", sourceId: contentId, targetId: airbnbPlatformId },
];

/** Canonical Phase 1C mappings for the Pricing pilot only. */
export const pricingEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: pricingPillarId, targetId: pricingTopicId },
  { type: "is_about", sourceId: pricingPillarId, targetId: pricingTopicId },
  { type: "part_of_cluster", sourceId: pricingPillarId, targetId: pricingTopicId },
  { type: "applies_to", sourceId: pricingPillarId, targetId: airbnbPlatformId },
  {
    type: "commercial_path_to",
    sourceId: pricingPillarId,
    targetId: "content:solution:airbnb-pricing-optimization",
  },
  ...pricingArticleIds.flatMap((contentId) => [
    ...mapPricingContent(contentId),
    { type: "supports" as const, sourceId: contentId, targetId: pricingPillarId },
  ]),
  ...pricingMetricArticleIds.flatMap(mapPricingContent),
  ...pricingMetricArticleMappings,
  ...pricingToolIds.flatMap((contentId) => [
    { type: "part_of_cluster" as const, sourceId: contentId, targetId: pricingTopicId },
    { type: "supports" as const, sourceId: contentId, targetId: pricingPillarId },
    { type: "applies_to" as const, sourceId: contentId, targetId: airbnbPlatformId },
  ]),
  ...pricingToolMetricMappings,
  {
    type: "is_about",
    sourceId: "content:solution:airbnb-pricing-optimization",
    targetId: pricingTopicId,
  },
  {
    type: "part_of_cluster",
    sourceId: "content:solution:airbnb-pricing-optimization",
    targetId: pricingTopicId,
  },
  {
    type: "applies_to",
    sourceId: "content:solution:airbnb-pricing-optimization",
    targetId: airbnbPlatformId,
  },
];
