import type { EditorialMapping } from "../mapping-registry";

const seoRankingTopicId = "topic:seo-ranking" as const;
const seoRankingPillarId = "content:guide:airbnb-seo" as const;
const seoRankingSupportGuideId = "content:guide:airbnb-ranking" as const;
const seoRankingTitleGeneratorGuideId = "content:guide:airbnb-title-generator" as const;
const seoRankingSolutionId = "content:solution:airbnb-seo" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const seoRankingArticleIds = [
  "content:article:how-airbnb-seo-works",
  "content:article:airbnb-search-ranking-factors",
  "content:article:airbnb-keyword-optimization",
  "content:article:airbnb-listing-visibility",
  "content:article:airbnb-search-algorithm",
  "content:article:airbnb-ranking-recovery",
  "content:article:airbnb-listing-freshness",
  "content:article:airbnb-title-ctr",
] as const;

/** Canonical mapping for the SEO / Ranking cluster. */
export const seoRankingEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: seoRankingPillarId, targetId: seoRankingTopicId },
  { type: "is_about", sourceId: seoRankingPillarId, targetId: seoRankingTopicId },
  { type: "part_of_cluster", sourceId: seoRankingPillarId, targetId: seoRankingTopicId },
  { type: "applies_to", sourceId: seoRankingPillarId, targetId: airbnbPlatformId },
  { type: "commercial_path_to", sourceId: seoRankingPillarId, targetId: seoRankingSolutionId },
  { type: "is_about", sourceId: seoRankingSupportGuideId, targetId: seoRankingTopicId },
  { type: "part_of_cluster", sourceId: seoRankingSupportGuideId, targetId: seoRankingTopicId },
  { type: "supports", sourceId: seoRankingSupportGuideId, targetId: seoRankingPillarId },
  { type: "applies_to", sourceId: seoRankingSupportGuideId, targetId: airbnbPlatformId },
  { type: "is_about", sourceId: seoRankingTitleGeneratorGuideId, targetId: seoRankingTopicId },
  { type: "part_of_cluster", sourceId: seoRankingTitleGeneratorGuideId, targetId: seoRankingTopicId },
  { type: "supports", sourceId: seoRankingTitleGeneratorGuideId, targetId: seoRankingPillarId },
  { type: "applies_to", sourceId: seoRankingTitleGeneratorGuideId, targetId: airbnbPlatformId },
  ...seoRankingArticleIds.flatMap((sourceId) => [
    { type: "is_about" as const, sourceId, targetId: seoRankingTopicId },
    { type: "part_of_cluster" as const, sourceId, targetId: seoRankingTopicId },
    { type: "supports" as const, sourceId, targetId: seoRankingPillarId },
    { type: "applies_to" as const, sourceId, targetId: airbnbPlatformId },
  ]),
  { type: "is_about", sourceId: seoRankingSolutionId, targetId: seoRankingTopicId },
  { type: "part_of_cluster", sourceId: seoRankingSolutionId, targetId: seoRankingTopicId },
  { type: "applies_to", sourceId: seoRankingSolutionId, targetId: airbnbPlatformId },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-search-ranking-factors",
    targetId: "content:article:airbnb-search-algorithm",
  },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-listing-visibility",
    targetId: "content:article:airbnb-search-ranking-factors",
  },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-title-ctr",
    targetId: "content:guide:airbnb-title-generator",
  },
];
