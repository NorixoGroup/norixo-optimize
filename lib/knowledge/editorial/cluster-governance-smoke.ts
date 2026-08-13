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
  const conversion = getEditorialCluster("topic:conversion");
  const trust = getEditorialCluster("topic:trust");
  const guestExperience = getEditorialCluster("topic:guest-experience");

  assert(validateEditorialClusterGovernance().valid, "Cluster governance must be valid.");
  assert(pricing?.status === "active", "Pricing governance must be active.");
  assert(revenue?.status === "active", "Revenue governance must be active.");
  assert(seoRanking?.status === "active", "SEO/Ranking governance must be active.");
  assert(conversion?.status === "active", "Conversion governance must be active.");
  assert(trust?.status === "active", "Trust governance must be active.");
  assert(guestExperience?.status === "active", "Guest Experience governance must be active.");
  assert(conversion.priority === "high", "Conversion priority must be high.");
  assert(conversion.primaryPlatform === "platform:airbnb", "Conversion primary platform must be Airbnb.");
  assert(conversion.expectedCoverage.requiresPillar, "Conversion must require a pillar.");
  assert(conversion.expectedCoverage.requiresCommercialPath, "Conversion must require a commercial path.");
  assert(conversion.expectedCoverage.minSupportingContent === 6, "Conversion minimum supporting content is invalid.");
  assert(JSON.stringify(conversion.expectedCoverage.expectedContentTypes) === JSON.stringify(["article", "guide", "solution"]), "Conversion expected content types are invalid.");
  assert(JSON.stringify(conversion.expectedCoverage.optionalContentTypes) === JSON.stringify(["tool", "ranking", "report"]), "Conversion optional content types are invalid.");
  assert(JSON.stringify(conversion.expectedCoverage.expectedMetrics) === JSON.stringify([]), "Conversion must not expect invented metrics.");
  assert(trust.priority === "high", "Trust priority must be high.");
  assert(trust.primaryPlatform === "platform:airbnb", "Trust primary platform must be Airbnb.");
  assert(trust.expectedCoverage.requiresPillar, "Trust must require a pillar.");
  assert(trust.expectedCoverage.requiresCommercialPath === false, "Trust must not require a commercial path.");
  assert(trust.expectedCoverage.minSupportingContent === 3, "Trust minimum supporting content is invalid.");
  assert(JSON.stringify(trust.expectedCoverage.expectedContentTypes) === JSON.stringify(["article", "guide"]), "Trust expected content types are invalid.");
  assert(JSON.stringify(trust.expectedCoverage.optionalContentTypes) === JSON.stringify(["solution", "tool", "ranking", "report"]), "Trust optional content types are invalid.");
  assert(JSON.stringify(trust.expectedCoverage.expectedMetrics) === JSON.stringify([]), "Trust must not expect invented metrics.");
  assert(guestExperience.priority === "high", "Guest Experience priority must be high.");
  assert(guestExperience.primaryPlatform === "platform:airbnb", "Guest Experience primary platform must be Airbnb.");
  assert(guestExperience.expectedCoverage.requiresPillar, "Guest Experience must require a pillar.");
  assert(guestExperience.expectedCoverage.requiresCommercialPath === false, "Guest Experience must not require a commercial path.");
  assert(guestExperience.expectedCoverage.minSupportingContent === 4, "Guest Experience minimum supporting content is invalid.");
  assert(JSON.stringify(guestExperience.expectedCoverage.expectedContentTypes) === JSON.stringify(["article", "guide"]), "Guest Experience expected content types are invalid.");
  assert(JSON.stringify(guestExperience.expectedCoverage.optionalContentTypes) === JSON.stringify(["solution", "tool", "ranking", "report"]), "Guest Experience optional content types are invalid.");
  assert(JSON.stringify(guestExperience.expectedCoverage.expectedMetrics) === JSON.stringify([]), "Guest Experience must not expect invented metrics.");
  assert(photos?.expectedCoverage.requiresCommercialPath === true, "Photos must keep its commercial path gap explicit.");
  assert(pricing?.pillarId === "content:guide:airbnb-pricing-optimization", "Pricing pillar is invalid.");
  assert(revenue?.pillarId === "content:guide:airbnb-revenue-optimization", "Revenue pillar is invalid.");
  assert(seoRanking?.pillarId === "content:guide:airbnb-seo", "SEO/Ranking pillar is invalid.");
  assert(conversion.pillarId === "content:guide:airbnb-conversion-optimization", "Conversion pillar is invalid.");
  assert(trust.pillarId === "content:guide:airbnb-trust-optimization", "Trust pillar is invalid.");
  assert(guestExperience.pillarId === "content:guide:airbnb-guest-experience", "Guest Experience pillar is invalid.");
  assert(photos.pillarId === "content:guide:airbnb-photo-optimization", "Photos pillar is invalid.");
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
  assert(pricing && revenue && photos && seoRanking && conversion && trust && guestExperience, "Canonical governance definitions must be available.");
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
  const conversionCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:conversion",
    expectedCoverage: conversion.expectedCoverage,
  });
  const trustCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:trust",
    expectedCoverage: trust.expectedCoverage,
  });
  const guestExperienceCoverage = analyzeClusterCoverage({
    ...coverageInput,
    topicId: "topic:guest-experience",
    expectedCoverage: guestExperience.expectedCoverage,
  });
  assert(pricingCoverage.status === "strong" && pricingCoverage.pillarCount === 1, "Pricing governance and coverage must agree.");
  assert(revenueCoverage.status === "strong" && revenueCoverage.pillarCount === 1, "Revenue governance and coverage must agree.");
  assert(photosCoverage.status === "strong" && photosCoverage.pillarCount === 1, "Photos governance and coverage must agree.");
  assert(seoRankingCoverage.status === "strong" && seoRankingCoverage.pillarCount === 1, "SEO/Ranking governance and coverage must agree.");
  assert(conversionCoverage.status === "strong" && conversionCoverage.pillarCount === 1, "Conversion governance and coverage must agree.");
  assert(trustCoverage.status === "strong" && trustCoverage.pillarCount === 1, "Trust governance and coverage must agree.");
  assert(guestExperienceCoverage.status === "strong" && guestExperienceCoverage.pillarCount === 1, "Guest Experience governance and coverage must agree.");
  assert(isClusterReadyForAutomation("topic:photos"), "Active strong Photos must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:guest-experience"), "Active strong Guest Experience must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:trust"), "Active strong Trust must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:pricing"), "Active strong Pricing must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:revenue"), "Active strong Revenue must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:seo-ranking"), "Active strong SEO/Ranking must be automation-ready.");
  assert(isClusterReadyForAutomation("topic:conversion"), "Active strong Conversion must be automation-ready.");
  assert(JSON.stringify(getEditorialClusters()) === clustersSnapshot, "Governance helpers must not mutate clusters.");
  assert(JSON.stringify(getEditorialMappings()) === mappingsSnapshot, "Governance helpers must not mutate mappings.");
  assert(JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot, "Governance helpers must not mutate datasets.");

  console.log("Editorial cluster governance smoke passed.", {
    active: getClustersByStatus("active").map((cluster) => cluster.topicId),
    planned: getClustersByStatus("planned").map((cluster) => cluster.topicId),
    overloaded: getClustersByStatus("overloaded").map((cluster) => cluster.topicId),
  });
}
