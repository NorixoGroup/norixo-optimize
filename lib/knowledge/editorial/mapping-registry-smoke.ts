import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { buildEditorialContentNodes } from "./content-adapter";
import {
  conversionEditorialMappings,
  guestExperienceEditorialMappings,
  listingOptimizationEditorialMappings,
  marketIntelligenceEditorialMappings,
  seoRankingEditorialMappings,
  trustEditorialMappings,
} from "./mappings";
import {
  getClusterMappings,
  getEditorialMappings,
  getMappingsFrom,
  getMappingsTo,
  validateEditorialMappingRegistry,
  type EditorialMapping,
} from "./mapping-registry";

export interface PricingMappingSmokeCounts {
  relations: number;
  articles: number;
  guides: number;
  tools: number;
  solutions: number;
  reports: number;
  metrics: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function runEditorialMappingRegistrySmokeTest(): PricingMappingSmokeCounts {
  const datasetSnapshots = [articles, guides, tools, solutions, marketReports].map((dataset) =>
    JSON.stringify(dataset)
  );
  const contentNodesSnapshot = JSON.stringify(buildEditorialContentNodes());
  const mappings = getEditorialMappings();
  const registryValidation = validateEditorialMappingRegistry(mappings);
  const pricingPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:pricing"
  );
  const seoRankingMappings = getClusterMappings("topic:seo-ranking");
  const seoRankingMemberIds = new Set(seoRankingMappings.map((mapping) => mapping.sourceId));
  const seoRankingPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:seo-ranking"
  );
  const seoRankingGuideMembers = [...seoRankingMemberIds].filter((id) => id.startsWith("content:guide:"));
  const conversionMappings = getClusterMappings("topic:conversion");
  const conversionMemberIds = new Set(conversionMappings.map((mapping) => mapping.sourceId));
  const conversionPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:conversion"
  );
  const conversionArticleMembers = [...conversionMemberIds].filter((id) => id.startsWith("content:article:"));
  const conversionGuideMembers = [...conversionMemberIds].filter((id) => id.startsWith("content:guide:"));
  const conversionSolutionMembers = [...conversionMemberIds].filter((id) => id.startsWith("content:solution:"));
  const trustMappings = getClusterMappings("topic:trust");
  const trustMemberIds = new Set(trustMappings.map((mapping) => mapping.sourceId));
  const trustPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:trust"
  );
  const trustArticleMembers = [...trustMemberIds].filter((id) => id.startsWith("content:article:"));
  const trustGuideMembers = [...trustMemberIds].filter((id) => id.startsWith("content:guide:"));
  const trustSolutionMembers = [...trustMemberIds].filter((id) => id.startsWith("content:solution:"));
  const trustToolMembers = [...trustMemberIds].filter((id) => id.startsWith("content:tool:"));
  const trustReportMembers = [...trustMemberIds].filter((id) => id.startsWith("content:report:"));
  const reviewsPrimaryTrustMembers = [
    "content:article:airbnb-reviews",
    "content:article:airbnb-rating",
    "content:article:airbnb-review-response",
  ] as const;
  const trustPrimaryTrustMembers = [
    "content:article:airbnb-trust-signals",
    "content:article:airbnb-superhost",
  ] as const;
  const guestExperienceMappings = getClusterMappings("topic:guest-experience");
  const guestExperienceMemberIds = new Set(guestExperienceMappings.map((mapping) => mapping.sourceId));
  const guestExperiencePillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:guest-experience"
  );
  const guestExperienceArticleMembers = [...guestExperienceMemberIds].filter((id) => id.startsWith("content:article:"));
  const guestExperienceGuideMembers = [...guestExperienceMemberIds].filter((id) => id.startsWith("content:guide:"));
  const guestExperienceSolutionMembers = [...guestExperienceMemberIds].filter((id) => id.startsWith("content:solution:"));
  const guestExperienceToolMembers = [...guestExperienceMemberIds].filter((id) => id.startsWith("content:tool:"));
  const guestExperienceRankingMembers = [...guestExperienceMemberIds].filter((id) => id.startsWith("content:ranking:"));
  const guestExperienceReportMembers = [...guestExperienceMemberIds].filter((id) => id.startsWith("content:report:"));
  const marketIntelligenceMappings = getClusterMappings("topic:market-intelligence");
  const marketIntelligenceMemberIds = new Set(marketIntelligenceMappings.map((mapping) => mapping.sourceId));
  const marketIntelligencePillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:market-intelligence"
  );
  const marketIntelligenceRankingMembers = [...marketIntelligenceMemberIds].filter((id) => id.startsWith("content:ranking:"));
  const marketIntelligenceReportMembers = [...marketIntelligenceMemberIds].filter((id) => id.startsWith("content:report:"));
  const supportingMappings = mappings.filter(
    (mapping) =>
      mapping.type === "supports" &&
      mapping.targetId === "content:guide:airbnb-pricing-optimization"
  );
  const toolMappings = supportingMappings.filter((mapping) => mapping.sourceId.startsWith("content:tool:"));
  const metricMappings = mappings.filter(
    (mapping) => mapping.type === "uses_metric" && mapping.targetId.includes(".")
  );
  const listingOptimizationGuideId = "content:guide:airbnb-listing-optimization" as const;
  const listingOptimizationSolutionId = "content:solution:airbnb-listing-optimization" as const;
  const listingOptimizationMappings = mappings.filter(
    (mapping) =>
      mapping.sourceId === listingOptimizationGuideId ||
      mapping.sourceId === listingOptimizationSolutionId
  );
  const listingOptimizationRelatedTo = listingOptimizationEditorialMappings.filter(
    (mapping) => mapping.type === "related_to"
  );

  assert(registryValidation.valid, "The Pricing mapping registry must be valid.");
  assert(pricingPillars.length === 1, "Pricing requires exactly one pillar.");
  assert(
    pricingPillars[0].sourceId === "content:guide:airbnb-pricing-optimization",
    "The Airbnb Pricing Optimization guide must be the Pricing pillar."
  );
  assert(supportingMappings.length > 0, "Pricing requires supporting content.");
  assert(toolMappings.length > 0, "Pricing has explicitly related tools and requires tool mappings.");
  assert(new Set(mappings.map((mapping) => `${mapping.type}:${mapping.sourceId}:${mapping.targetId}`)).size === mappings.length, "Mappings must be unique.");
  assert(!mappings.some((mapping) => mapping.targetId === "platform:booking"), "Pricing mappings must not target Booking.");
  assert(
    getClusterMappings("topic:pricing").every((mapping) => mapping.targetId === "topic:pricing"),
    "Pricing cluster queries must remain limited to Pricing mappings."
  );
  assert(getClusterMappings("topic:revenue").length > 0, "Revenue mappings must remain present.");
  assert(getClusterMappings("topic:photos").length > 0, "Photos mappings must remain present.");
  assert(seoRankingEditorialMappings.length === 38, "SEO / Ranking must expose its 38 canonical relations.");
  assert(seoRankingMappings.length === 10, "SEO / Ranking cluster mappings must contain its ten cluster-membership relations.");
  assert(seoRankingMappings.every((mapping) => mapping.targetId === "topic:seo-ranking"), "SEO / Ranking cluster queries must remain limited to SEO / Ranking mappings.");
  assert(seoRankingPillars.length === 1 && seoRankingPillars[0].sourceId === "content:guide:airbnb-seo", "SEO / Ranking requires the Airbnb SEO guide as its unique pillar.");
  assert(seoRankingGuideMembers.length === 3, "SEO / Ranking must contain its pillar guide, ranking support guide, and title generator support guide.");
  assert(seoRankingMemberIds.has("content:guide:airbnb-ranking"), "Airbnb Ranking guide must be a SEO / Ranking support member.");
  assert(seoRankingMemberIds.has("content:guide:airbnb-title-generator"), "Airbnb Title Generator guide must be a SEO / Ranking support member.");
  assert(
    mappings.some(
      (mapping) =>
        mapping.type === "supports" &&
        mapping.sourceId === "content:guide:airbnb-ranking" &&
        mapping.targetId === "content:guide:airbnb-seo"
    ),
    "Airbnb Ranking guide must support the canonical Airbnb SEO pillar."
  );
  assert(
    mappings.some(
      (mapping) =>
        mapping.type === "supports" &&
        mapping.sourceId === "content:guide:airbnb-title-generator" &&
        mapping.targetId === "content:guide:airbnb-seo"
    ),
    "Airbnb Title Generator guide must support the canonical Airbnb SEO pillar."
  );
  assert(
    !mappings.some(
      (mapping) =>
        mapping.type === "pillar_for" &&
        mapping.sourceId === "content:guide:airbnb-title-generator"
    ),
    "Airbnb Title Generator guide must not become a SEO / Ranking pillar."
  );
  assert(conversionEditorialMappings.length === 72, "Conversion must expose its 72 canonical relations.");
  assert(conversionMappings.length === 19, "Conversion cluster mappings must contain its pillar and eighteen cluster-membership relations.");
  assert(conversionMappings.every((mapping) => mapping.targetId === "topic:conversion"), "Conversion cluster queries must remain limited to Conversion mappings.");
  assert(conversionPillars.length === 1 && conversionPillars[0].sourceId === "content:guide:airbnb-conversion-optimization", "Conversion requires the Airbnb Conversion Optimization guide as its unique pillar.");
  assert(conversionArticleMembers.length === 13, "Conversion must contain thirteen article members.");
  assert(conversionGuideMembers.length === 3, "Conversion must contain three guide members.");
  assert(conversionSolutionMembers.length === 2, "Conversion must contain two solution members.");
  assert(conversionMemberIds.has("content:article:airbnb-listing-copywriting"), "Listing Copywriting article must remain a Conversion member.");
  assert(conversionMemberIds.has("content:guide:airbnb-description-generator"), "Description Generator guide must be a Conversion support member.");
  assert(
    mappings.some(
      (mapping) =>
        mapping.type === "supports" &&
        mapping.sourceId === "content:guide:airbnb-description-generator" &&
        mapping.targetId === "content:guide:airbnb-conversion-optimization"
    ),
    "Description Generator guide must support the canonical Conversion pillar."
  );
  assert(
    !mappings.some(
      (mapping) =>
        mapping.type === "pillar_for" &&
        mapping.sourceId === "content:guide:airbnb-description-generator"
    ),
    "Description Generator guide must not become a Conversion pillar."
  );
  assert(!conversionMemberIds.has("content:guide:airbnb-listing-optimization"), "Listing Optimization guide must not be a Conversion member.");
  assert(!conversionMemberIds.has("content:solution:airbnb-listing-optimization"), "Listing Optimization solution must not be a Conversion member.");
  assert(trustEditorialMappings.length === 24, "Trust must expose its 24 canonical relations.");
  assert(trustMappings.length === 7, "Trust cluster mappings must contain its pillar and six cluster-membership relations.");
  assert(trustMappings.every((mapping) => mapping.targetId === "topic:trust"), "Trust cluster queries must remain limited to Trust mappings.");
  assert(trustPillars.length === 1 && trustPillars[0].sourceId === "content:guide:airbnb-trust-optimization", "Trust requires the Airbnb Trust Optimization guide as its unique pillar.");
  assert(trustMemberIds.size === 6, "Trust must contain six members.");
  assert(trustArticleMembers.length === 5, "Trust must contain five article members.");
  assert(trustGuideMembers.length === 1, "Trust must contain one guide member.");
  assert(trustSolutionMembers.length === 0, "Trust must not contain solution members.");
  assert(trustToolMembers.length === 0, "Trust must not contain tool members.");
  assert(trustReportMembers.length === 0, "Trust must not contain report members.");
  assert(
    reviewsPrimaryTrustMembers.every((sourceId) =>
      trustMemberIds.has(sourceId) &&
        !mappings.some(
          (mapping) =>
            mapping.type === "is_about" &&
            mapping.sourceId === sourceId &&
            mapping.targetId === "topic:trust"
        )
    ),
    "Reviews-owned articles must be Trust members without is_about topic:trust."
  );
  assert(
    trustPrimaryTrustMembers.every((sourceId) =>
      mappings.some(
        (mapping) =>
          mapping.type === "is_about" &&
          mapping.sourceId === sourceId &&
          mapping.targetId === "topic:trust"
      )
    ),
    "Trust-owned articles must keep is_about topic:trust."
  );
  assert(
    !trustEditorialMappings.some((mapping) => mapping.type === "commercial_path_to"),
    "Trust must not define a commercial path in this phase."
  );
  assert(
    !trustEditorialMappings.some((mapping) => mapping.sourceId === mapping.targetId),
    "Trust mappings must not contain auto-links."
  );
  assert(
    !([
      "content:article:airbnb-guest-experience",
      "content:article:airbnb-communication",
      "content:article:airbnb-check-in",
      "content:article:airbnb-cleanliness",
      "content:article:airbnb-guest-satisfaction",
    ] as const).some((id) => trustMemberIds.has(id)),
    "Guest Experience articles must remain outside the Trust cluster."
  );
  assert(guestExperienceEditorialMappings.length === 27, "Guest Experience must expose its 27 canonical relations.");
  assert(guestExperienceMappings.length === 7, "Guest Experience cluster mappings must contain its pillar and six cluster-membership relations.");
  assert(guestExperienceMappings.every((mapping) => mapping.targetId === "topic:guest-experience"), "Guest Experience cluster queries must remain limited to Guest Experience mappings.");
  assert(guestExperiencePillars.length === 1 && guestExperiencePillars[0].sourceId === "content:guide:airbnb-guest-experience", "Guest Experience requires the Airbnb Guest Experience guide as its unique pillar.");
  assert(guestExperienceMemberIds.size === 6, "Guest Experience must contain six members.");
  assert(guestExperienceArticleMembers.length === 5, "Guest Experience must contain five article members.");
  assert(guestExperienceGuideMembers.length === 1, "Guest Experience must contain one guide member.");
  assert(guestExperienceSolutionMembers.length === 0, "Guest Experience must not contain solution members.");
  assert(guestExperienceToolMembers.length === 0, "Guest Experience must not contain tool members.");
  assert(guestExperienceRankingMembers.length === 0, "Guest Experience must not contain ranking members.");
  assert(guestExperienceReportMembers.length === 0, "Guest Experience must not contain report members.");
  assert(
    !guestExperienceEditorialMappings.some((mapping) => mapping.type === "commercial_path_to"),
    "Guest Experience must not define a commercial path in this phase."
  );
  assert(
    !guestExperienceEditorialMappings.some((mapping) => mapping.type === "uses_metric"),
    "Guest Experience must not define metrics in this phase."
  );
  assert(
    !guestExperienceEditorialMappings.some((mapping) => mapping.sourceId === mapping.targetId),
    "Guest Experience mappings must not contain auto-links."
  );
  assert(marketIntelligenceEditorialMappings.length === 4, "Market Intelligence must expose its four minimal hub relations.");
  assert(marketIntelligenceMappings.length === 2, "Market Intelligence cluster mappings must contain only pillar and cluster membership relations.");
  assert(marketIntelligenceMappings.every((mapping) => mapping.targetId === "topic:market-intelligence"), "Market Intelligence cluster queries must remain limited to Market Intelligence mappings.");
  assert(marketIntelligencePillars.length === 1 && marketIntelligencePillars[0].sourceId === "content:guide:airbnb-market-intelligence", "Market Intelligence requires the Airbnb Market Intelligence guide as its unique pillar.");
  assert(marketIntelligenceMemberIds.size === 1, "Market Intelligence must contain only its hub in this phase.");
  assert(marketIntelligenceMemberIds.has("content:guide:airbnb-market-intelligence"), "Market Intelligence hub must be registered.");
  assert(marketIntelligenceRankingMembers.length === 0, "Market Intelligence must not contain ranking members in this phase.");
  assert(marketIntelligenceReportMembers.length === 0, "Market Intelligence must not contain report members in this phase.");
  assert(
    marketIntelligenceEditorialMappings.some(
      (mapping) =>
        mapping.type === "is_about" &&
        mapping.sourceId === "content:guide:airbnb-market-intelligence" &&
        mapping.targetId === "topic:market-intelligence"
    ),
    "Market Intelligence hub must be about the Market Intelligence topic."
  );
  assert(
    marketIntelligenceEditorialMappings.some(
      (mapping) =>
        mapping.type === "applies_to" &&
        mapping.sourceId === "content:guide:airbnb-market-intelligence" &&
        mapping.targetId === "platform:airbnb"
    ),
    "Market Intelligence hub must apply to Airbnb."
  );
  assert(
    !marketIntelligenceEditorialMappings.some((mapping) => mapping.type === "supports"),
    "Market Intelligence must not define supporting content in this phase."
  );
  assert(
    !marketIntelligenceEditorialMappings.some((mapping) => mapping.type === "related_to"),
    "Market Intelligence must not define related content in this phase."
  );
  assert(
    !marketIntelligenceEditorialMappings.some((mapping) => mapping.type === "commercial_path_to"),
    "Market Intelligence must not define a commercial path in this phase."
  );
  assert(
    !marketIntelligenceEditorialMappings.some((mapping) => mapping.type === "uses_metric"),
    "Market Intelligence must not define metrics in this phase."
  );
  assert(listingOptimizationEditorialMappings.length === 9, "Listing Optimization must expose nine transversal relations.");
  assert(listingOptimizationMappings.length === 9, "Listing Optimization transversal mappings must be registered.");
  assert(
    listingOptimizationEditorialMappings.some(
      (mapping) =>
        mapping.type === "is_about" &&
        mapping.sourceId === listingOptimizationGuideId &&
        mapping.targetId === "topic:listing-optimization"
    ),
    "Listing Optimization guide must be about the Listing Optimization topic."
  );
  assert(
    listingOptimizationEditorialMappings.some(
      (mapping) =>
        mapping.type === "applies_to" &&
        mapping.sourceId === listingOptimizationGuideId &&
        mapping.targetId === "platform:airbnb"
    ),
    "Listing Optimization guide must apply to Airbnb."
  );
  assert(
    listingOptimizationEditorialMappings.some(
      (mapping) =>
        mapping.type === "is_about" &&
        mapping.sourceId === listingOptimizationSolutionId &&
        mapping.targetId === "topic:listing-optimization"
    ),
    "Listing Optimization solution must be about the Listing Optimization topic."
  );
  assert(
    listingOptimizationEditorialMappings.some(
      (mapping) =>
        mapping.type === "applies_to" &&
        mapping.sourceId === listingOptimizationSolutionId &&
        mapping.targetId === "platform:airbnb"
    ),
    "Listing Optimization solution must apply to Airbnb."
  );
  assert(
    listingOptimizationEditorialMappings.some(
      (mapping) =>
        mapping.type === "commercial_path_to" &&
        mapping.sourceId === listingOptimizationGuideId &&
        mapping.targetId === listingOptimizationSolutionId
    ),
    "Listing Optimization guide must define a commercial path to the Listing Optimization solution."
  );
  assert(listingOptimizationRelatedTo.length === 4, "Listing Optimization hub must define four specialist related links.");
  assert(
    ([
      "content:guide:airbnb-seo",
      "content:guide:airbnb-conversion-optimization",
      "content:guide:airbnb-trust-optimization",
      "content:guide:airbnb-photo-optimization",
    ] as const).every((targetId) =>
      listingOptimizationRelatedTo.some(
        (mapping) => mapping.sourceId === listingOptimizationGuideId && mapping.targetId === targetId
      )
    ),
    "Listing Optimization hub must relate to the four canonical specialist pillars."
  );
  assert(
    !listingOptimizationEditorialMappings.some((mapping) => mapping.type === "supports"),
    "Listing Optimization transversal mapping must not use supports."
  );
  assert(
    !listingOptimizationEditorialMappings.some((mapping) => mapping.type === "pillar_for"),
    "Listing Optimization transversal mapping must not declare a pillar."
  );
  assert(
    !listingOptimizationEditorialMappings.some((mapping) => mapping.type === "part_of_cluster"),
    "Listing Optimization transversal mapping must not declare cluster membership."
  );
  assert(
    !listingOptimizationEditorialMappings.some(
      (mapping) =>
        mapping.sourceId === "content:guide:airbnb-title-generator" ||
        mapping.targetId === "content:guide:airbnb-title-generator" ||
        mapping.sourceId === "content:guide:airbnb-description-generator" ||
        mapping.targetId === "content:guide:airbnb-description-generator"
    ),
    "Listing Optimization T39 mapping must not touch title or description generator guides."
  );

  const invalidRelation: EditorialMapping = {
    type: "is_about",
    sourceId: "content:article:airbnb-pricing-strategy",
    targetId: "platform:airbnb",
  };
  assert(
    !validateEditorialMappingRegistry([...mappings, invalidRelation]).valid,
    "Relations with forbidden source and target kinds must be rejected."
  );

  const orphanMapping: EditorialMapping = {
    type: "uses_metric",
    sourceId: "content:tool:missing",
    targetId: "metrics.average-daily-rate",
  };
  assert(
    !validateEditorialMappingRegistry([...mappings, orphanMapping]).valid,
    "Mappings with missing source IDs must be rejected."
  );

  assert(
    JSON.stringify(getEditorialMappings()) === JSON.stringify(getEditorialMappings()) &&
      JSON.stringify(getMappingsFrom("content:guide:airbnb-pricing-optimization")) ===
        JSON.stringify(getMappingsFrom("content:guide:airbnb-pricing-optimization")) &&
      JSON.stringify(getMappingsTo("topic:pricing")) === JSON.stringify(getMappingsTo("topic:pricing")) &&
      JSON.stringify(getClusterMappings("topic:pricing")) ===
        JSON.stringify(getClusterMappings("topic:pricing")) &&
      JSON.stringify(getClusterMappings("topic:seo-ranking")) ===
        JSON.stringify(getClusterMappings("topic:seo-ranking")) &&
      JSON.stringify(getClusterMappings("topic:conversion")) ===
        JSON.stringify(getClusterMappings("topic:conversion")) &&
      JSON.stringify(getClusterMappings("topic:trust")) ===
        JSON.stringify(getClusterMappings("topic:trust")) &&
      JSON.stringify(getClusterMappings("topic:guest-experience")) ===
        JSON.stringify(getClusterMappings("topic:guest-experience")),
    "Mapping query helpers must be deterministic."
  );

  assert(
    JSON.stringify(buildEditorialContentNodes()) === contentNodesSnapshot,
    "Mapping registry must not mutate ContentNodes."
  );
  assert(
    JSON.stringify([articles, guides, tools, solutions, marketReports]) ===
      JSON.stringify(datasetSnapshots.map((snapshot) => JSON.parse(snapshot))),
    "Mapping registry must not mutate datasets."
  );

  const counts: PricingMappingSmokeCounts = {
    relations: mappings.length,
    articles: new Set(
      mappings
        .filter((mapping) => mapping.sourceId.startsWith("content:article:"))
        .map((mapping) => mapping.sourceId)
    ).size,
    guides: new Set(
      mappings
        .filter((mapping) => mapping.sourceId.startsWith("content:guide:"))
        .map((mapping) => mapping.sourceId)
    ).size,
    tools: new Set(
      mappings
        .filter((mapping) => mapping.sourceId.startsWith("content:tool:"))
        .map((mapping) => mapping.sourceId)
    ).size,
    solutions: new Set(
      mappings
        .filter((mapping) => mapping.sourceId.startsWith("content:solution:"))
        .map((mapping) => mapping.sourceId)
    ).size,
    reports: new Set(
      mappings
        .filter((mapping) => mapping.sourceId.startsWith("content:report:"))
        .map((mapping) => mapping.sourceId)
    ).size,
    metrics: new Set(metricMappings.map((mapping) => mapping.targetId)).size,
  };

  console.log("Editorial Pricing mapping registry smoke passed.", counts);
  return counts;
}
