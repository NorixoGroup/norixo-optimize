import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { buildEditorialContentNodes } from "./content-adapter";
import { seoRankingEditorialMappings } from "./mappings";
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
  const seoRankingPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:seo-ranking"
  );
  const supportingMappings = mappings.filter(
    (mapping) =>
      mapping.type === "supports" &&
      mapping.targetId === "content:guide:airbnb-pricing-optimization"
  );
  const toolMappings = supportingMappings.filter((mapping) => mapping.sourceId.startsWith("content:tool:"));
  const metricMappings = mappings.filter(
    (mapping) => mapping.type === "uses_metric" && mapping.targetId.includes(".")
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
  assert(seoRankingEditorialMappings.length === 30, "SEO / Ranking must retain its 30 canonical relations.");
  assert(seoRankingMappings.length === 8, "SEO / Ranking cluster mappings must contain its eight cluster-membership relations.");
  assert(seoRankingMappings.every((mapping) => mapping.targetId === "topic:seo-ranking"), "SEO / Ranking cluster queries must remain limited to SEO / Ranking mappings.");
  assert(seoRankingPillars.length === 1 && seoRankingPillars[0].sourceId === "content:guide:airbnb-seo", "SEO / Ranking requires the Airbnb SEO guide as its unique pillar.");

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
        JSON.stringify(getClusterMappings("topic:seo-ranking")),
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
