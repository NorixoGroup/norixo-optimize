import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { analyzeClusterCoverage } from "./coverage-analyzer";
import { buildEditorialContentNodes } from "./content-adapter";
import {
  getClustersByPriority,
  getClustersByStatus,
  getEditorialCluster,
  getEditorialClusters,
  isClusterReadyForAutomation,
  validateEditorialClusterGovernance,
} from "./cluster-governance";
import { getEditorialMappings } from "./mapping-registry";
import { canonicalEditorialNodes } from "./taxonomy";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runClusterGovernanceSmokeTest(): void {
  const datasetsSnapshot = JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]);
  const mappingsSnapshot = JSON.stringify(getEditorialMappings());
  const clustersSnapshot = JSON.stringify(getEditorialClusters());
  const pricing = getEditorialCluster("topic:pricing");
  const revenue = getEditorialCluster("topic:revenue");
  const photos = getEditorialCluster("topic:photos");
  const seoRanking = getEditorialCluster("topic:seo-ranking");

  assert(validateEditorialClusterGovernance().valid, "Cluster governance must be valid.");
  assert(pricing?.status === "active", "Pricing governance must be active.");
  assert(revenue?.status === "active", "Revenue governance must be active.");
  assert(seoRanking?.status === "active", "SEO/Ranking governance must be active.");
  assert(pricing?.pillarId === "content:guide:airbnb-pricing-optimization", "Pricing pillar is invalid.");
  assert(revenue?.pillarId === "content:guide:airbnb-revenue-optimization", "Revenue pillar is invalid.");
  assert(seoRanking?.pillarId === "content:guide:airbnb-seo", "SEO/Ranking pillar is invalid.");
  assert(new Set(getEditorialClusters().map((cluster) => cluster.topicId)).size === getEditorialClusters().length, "Cluster topics must be unique.");
  assert(
    JSON.stringify(getEditorialClusters()) === JSON.stringify(getEditorialClusters()) &&
      JSON.stringify(getClustersByStatus("active")) === JSON.stringify(getClustersByStatus("active")) &&
      JSON.stringify(getClustersByPriority("high")) === JSON.stringify(getClustersByPriority("high")),
    "Governance query helpers must be deterministic."
  );

  const coverageInput = {
    contentNodes: buildEditorialContentNodes(),
    mappings: getEditorialMappings(),
    editorialNodes: canonicalEditorialNodes,
  };
  assert(pricing && revenue && photos && seoRanking, "Canonical governance definitions must be available.");
  const pricingCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:pricing",
    expectedCoverage: pricing.expectedCoverage,
  });
  const revenueCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:revenue",
    expectedCoverage: revenue.expectedCoverage,
  });
  const photosCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:photos",
    expectedCoverage: photos.expectedCoverage,
  });
  const seoRankingCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:seo-ranking",
    expectedCoverage: seoRanking.expectedCoverage,
  });
  assert(pricingCoverage.status === "strong" && pricingCoverage.pillarCount === 1, "Pricing governance and coverage must agree.");
  assert(revenueCoverage.status === "strong" && revenueCoverage.pillarCount === 1, "Revenue governance and coverage must agree.");
  assert(photosCoverage.status === "partial" && photosCoverage.pillarCount === 1, "Photos coverage must remain partial.");
  assert(seoRankingCoverage.status === "strong" && seoRankingCoverage.pillarCount === 1, "SEO/Ranking governance and coverage must agree.");
  assert(!isClusterReadyForAutomation("topic:photos"), "Overloaded Photos must not be automation-ready.");
  assert(isClusterReadyForAutomation("topic:pricing"), "Active strong Pricing must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:revenue"), "Active strong Revenue must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:seo-ranking"), "Active strong SEO/Ranking must be automation-ready.");
  assert(JSON.stringify(getEditorialClusters()) === clustersSnapshot, "Governance helpers must not mutate clusters.");
  assert(JSON.stringify(getEditorialMappings()) === mappingsSnapshot, "Governance helpers must not mutate mappings.");
  assert(JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot, "Governance helpers must not mutate datasets.");

  console.log("Editorial cluster governance smoke passed.", {
    active: getClustersByStatus("active").map((cluster) => cluster.topicId),
    planned: getClustersByStatus("planned").map((cluster) => cluster.topicId),
    overloaded: getClustersByStatus("overloaded").map((cluster) => cluster.topicId),
  });
}
