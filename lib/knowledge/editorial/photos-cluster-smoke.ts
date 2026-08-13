import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { analyzeClusterCoverage } from "./coverage-analyzer";
import { buildEditorialContentNodes } from "./content-adapter";
import { getEditorialCluster, isClusterReadyForAutomation } from "./cluster-governance";
import { getClusterMappings, getEditorialMappings, validateEditorialMappingRegistry } from "./mapping-registry";
import { auditPhotosCluster } from "./photos-audit";
import { canonicalEditorialNodes } from "./taxonomy";
import type { ContentNodeId } from "./types";
import { photosEditorialMappings } from "./mappings";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runPhotosClusterSmokeTest(): void {
  const datasetsSnapshot = JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]);
  const pricingSnapshot = JSON.stringify(getClusterMappings("topic:pricing"));
  const revenueSnapshot = JSON.stringify(getClusterMappings("topic:revenue"));
  const mappings = getEditorialMappings();
  const audit = auditPhotosCluster();
  const governance = getEditorialCluster("topic:photos");
  assert(governance, "Photos governance must be available.");
  const coverage = analyzeClusterCoverage({
    topicId: "topic:photos",
    contentNodes: buildEditorialContentNodes(),
    mappings,
    editorialNodes: canonicalEditorialNodes,
    expectedCoverage: governance.expectedCoverage,
  });
  const photoPillars = mappings.filter((mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:photos");
  const highGroups = audit.cannibalizationGroups.filter((group) => group.severity === "high");

  assert(validateEditorialMappingRegistry(mappings).valid, "The aggregated mapping registry must be valid.");
  assert(getClusterMappings("topic:photos").length > 0, "Photos must be present in the mapping registry.");
  assert(photoPillars.length === 1 && photoPillars[0].sourceId === "content:guide:airbnb-photo-optimization", "Photos requires the canonical photo-optimization pillar.");
  assert(audit.contents.length === 30, "All audited Photos articles must be detected.");
  assert(audit.cannibalizationGroups.length > 0, "Photos cannibalization groups must be present.");
  const knownGeneralPhotoArticles = ["content:article:airbnb-photography", "content:article:airbnb-photo-optimization", "content:article:airbnb-photo-tips"] as const satisfies readonly ContentNodeId[];
  assert(highGroups.some((group) => knownGeneralPhotoArticles.every((member) => group.members.includes(member))), "The known general-photo quasi-synonyms must be detected.");
  assert(new Set(mappings.map((mapping) => `${mapping.type}:${mapping.sourceId}:${mapping.targetId}`)).size === mappings.length, "Mappings must not contain duplicates.");
  assert(coverage.incoherentMappingCount === 0, "Photos mappings must not be orphaned.");
  assert(JSON.stringify(getClusterMappings("topic:pricing")) === pricingSnapshot, "Photos mapping must not mutate Pricing.");
  assert(JSON.stringify(getClusterMappings("topic:revenue")) === revenueSnapshot, "Photos mapping must not mutate Revenue.");
  assert(coverage.pillarCount === 1, "Photos coverage must detect one pillar.");
  assert(governance?.status === "active", "Photos governance must be active after core rebalance.");
  assert(coverage.status === "strong", "Photos coverage must be strong after commercial path rebalance.");
  assert(isClusterReadyForAutomation("topic:photos"), "Active strong Photos must be automation-ready after rebalance.");
  assert(JSON.stringify(auditPhotosCluster()) === JSON.stringify(audit), "Photos audit must be deterministic.");
  assert(JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot, "Photos audit must not mutate datasets.");

  console.log("Editorial Photos cluster smoke passed.", {
    contents: audit.contents.length,
    relations: photosEditorialMappings.length,
    supportingContent: coverage.supportingContentCount,
    cannibalization: audit.cannibalizationGroups.length,
    high: highGroups.length,
    medium: audit.cannibalizationGroups.filter((group) => group.severity === "medium").length,
    low: audit.cannibalizationGroups.filter((group) => group.severity === "low").length,
    coverage: coverage.status,
    governance: governance.status,
    automationReady: isClusterReadyForAutomation("topic:photos"),
  });
}
