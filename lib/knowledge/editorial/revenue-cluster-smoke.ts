import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { analyzeClusterCoverage } from "./coverage-analyzer";
import { buildEditorialContentNodes } from "./content-adapter";
import { getEditorialCluster } from "./cluster-governance";
import { canonicalEditorialNodes } from "./taxonomy";
import { revenueEditorialMappings } from "./mappings";
import { getClusterMappings, getEditorialMappings, getMappingsFrom, getMappingsTo, validateEditorialMappingRegistry } from "./mapping-registry";

export interface RevenueClusterSmokeCounts {
  relations: number;
  articles: number;
  guides: number;
  tools: number;
  solutions: number;
  reports: number;
  metrics: number;
  status: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runRevenueClusterSmokeTest(): RevenueClusterSmokeCounts {
  const datasetsSnapshot = JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]);
  const mappings = getEditorialMappings();
  const pricingMappingsSnapshot = JSON.stringify(getClusterMappings("topic:pricing"));
  const revenueMappings = revenueEditorialMappings;
  const revenueClusterMappings = getClusterMappings("topic:revenue");
  const revenuePillars = mappings.filter((mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:revenue");
  const revenueGovernance = getEditorialCluster("topic:revenue");
  assert(revenueGovernance, "Revenue governance must be available.");
  const coverage = analyzeClusterCoverage({
    topicId: "topic:revenue",
    contentNodes: buildEditorialContentNodes(),
    mappings,
    editorialNodes: canonicalEditorialNodes,
    expectedCoverage: revenueGovernance.expectedCoverage,
  });

  assert(validateEditorialMappingRegistry(mappings).valid, "The aggregated registry must be valid.");
  assert(revenueClusterMappings.length > 0, "Revenue cluster mappings must be present.");
  assert(revenuePillars.length === 1, "Revenue requires exactly one pillar.");
  assert(revenuePillars[0].sourceId === "content:guide:airbnb-revenue-optimization", "The Airbnb Revenue Optimization guide must be the Revenue pillar.");
  assert(coverage.supportingContentCount > 0, "Revenue requires supporting content.");
  assert(coverage.countsByContentType.tool > 0, "Revenue requires explicitly related tools.");
  assert(coverage.metrics.length === 5, "Revenue must reuse five KPI metrics.");
  assert(new Set(mappings.map((mapping) => `${mapping.type}:${mapping.sourceId}:${mapping.targetId}`)).size === mappings.length, "Aggregated mappings must not contain duplicates.");
  assert(coverage.incoherentMappingCount === 0, "Revenue mappings must not be orphaned.");
  assert(JSON.stringify(getClusterMappings("topic:pricing")) === pricingMappingsSnapshot, "Revenue mapping must not mutate Pricing mappings.");
  assert(
    JSON.stringify(getEditorialMappings()) === JSON.stringify(getEditorialMappings()) &&
      JSON.stringify(getMappingsFrom("content:guide:airbnb-revenue-optimization")) === JSON.stringify(getMappingsFrom("content:guide:airbnb-revenue-optimization")) &&
      JSON.stringify(getMappingsTo("topic:revenue")) === JSON.stringify(getMappingsTo("topic:revenue")) &&
      JSON.stringify(getClusterMappings("topic:revenue")) === JSON.stringify(getClusterMappings("topic:revenue")),
    "Aggregated mapping queries must be deterministic."
  );
  assert(JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot, "Revenue mapping must not mutate datasets.");

  const counts: RevenueClusterSmokeCounts = {
    relations: revenueMappings.length,
    articles: coverage.countsByContentType.article,
    guides: coverage.countsByContentType.guide,
    tools: coverage.countsByContentType.tool,
    solutions: coverage.countsByContentType.solution,
    reports: coverage.countsByContentType.report,
    metrics: coverage.metrics.length,
    status: coverage.status,
  };

  console.log("Editorial Revenue cluster smoke passed.", counts);
  return counts;
}
