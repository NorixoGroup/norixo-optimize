import { runFullEditorialAudit } from "./full-audit";
import { isClusterReadyForAutomation } from "../cluster-governance";
import type { EditorialCannibalizationMetrics } from "./cannibalization";
import type { EditorialCoverageGovernanceMetrics } from "./coverage-governance";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readinessFor(report: ReturnType<typeof runFullEditorialAudit>, topicId: `topic:${string}`) {
  const readinessCluster = report.clusters.find((cluster) => cluster.topicId === topicId && cluster.readiness !== undefined);
  assert(readinessCluster, `${topicId} readiness result must be present.`);
  return readinessCluster;
}

function coverageFor(report: ReturnType<typeof runFullEditorialAudit>, topicId: `topic:${string}`) {
  const coverageCluster = report.clusters.find((cluster) => cluster.topicId === topicId && cluster.coverage !== undefined);
  assert(coverageCluster?.coverage, `${topicId} coverage result must be present.`);
  return coverageCluster.coverage as EditorialCoverageGovernanceMetrics;
}

function assertPrerequisites(report: ReturnType<typeof runFullEditorialAudit>, topicId: `topic:${string}`): void {
  const clusters = report.clusters.filter((cluster) => cluster.topicId === topicId);
  assert(clusters.some((cluster) => cluster.inventory), `${topicId} must include inventory.`);
  assert(clusters.some((cluster) => cluster.resolverMetrics), `${topicId} must include resolver metrics.`);
  assert(clusters.some((cluster) => cluster.coverage), `${topicId} must include coverage and governance metrics.`);
  assert(readinessFor(report, topicId).readiness !== undefined, `${topicId} must include readiness.`);
}

export function runFullEditorialAuditSmokeTest(): void {
  const report = runFullEditorialAudit();
  assert(report.schemaVersion === "1" && report.generatedBy === "norixo-editorial-audit", "The full audit report must use the current root contract.");
  assert(report.clusters.length > 0 && Array.isArray(report.issues) && report.issues.length > 0 && report.diagnostics, "The full audit report must include clusters, issues, and diagnostics.");

  const pricing = readinessFor(report, "topic:pricing");
  const revenue = readinessFor(report, "topic:revenue");
  const photos = readinessFor(report, "topic:photos");
  assert(pricing.readiness === "ready", "Pricing must be ready.");
  assert(revenue.readiness === "ready", "Revenue must be ready.");
  const photosCoverage = coverageFor(report, "topic:photos");
  assert(
    photos.readiness === "ready"
    && photosCoverage.governanceStatus === "active"
    && photosCoverage.coverageStatus === "strong"
    && isClusterReadyForAutomation("topic:photos"),
    "Photos must be active, strongly covered, ready, and ready for automation."
  );
  ["topic:pricing", "topic:revenue", "topic:photos"].forEach((topicId) => assertPrerequisites(report, topicId as `topic:${string}`));
  report.clusters.filter((cluster) => cluster.readiness === "ready").forEach((cluster) => assertPrerequisites(report, cluster.topicId));

  const cannibalization = report.diagnostics.cannibalization;
  assert(cannibalization && typeof cannibalization === "object", "Cannibalization diagnostics must be present.");
  const cannibalizationMetrics = cannibalization as EditorialCannibalizationMetrics;
  assert(
    typeof cannibalizationMetrics.analyzedArticles === "number"
    && typeof cannibalizationMetrics.analyzedPairs === "number"
    && typeof cannibalizationMetrics.signaledPairs === "number"
    && typeof cannibalizationMetrics.highSignalPairs === "number",
    "Cannibalization diagnostics must expose the required metrics."
  );

  const orphanCount = report.issues.filter((issue) => issue.code === "orphan_content_node").length;
  const duplicateMappingCount = report.issues.filter((issue) => issue.code === "duplicate_mapping").length;
  assert(orphanCount > 0, "The current corpus must retain at least one reported orphan.");
  assert(duplicateMappingCount === 0, "The current corpus must not report duplicate mappings.");

  const repeatedReport = runFullEditorialAudit();
  assert(JSON.stringify(repeatedReport) === JSON.stringify(report), "The full audit pipeline must be deterministic and leave its source registries unchanged.");

  console.log("Editorial full audit smoke passed.");
  console.log(`Pricing: ${pricing.readiness}`);
  console.log(`Revenue: ${revenue.readiness}`);
  console.log(`Photos: ${photos.readiness}`);
  console.log(`Orphans: ${orphanCount}`);
  console.log(`Duplicate mappings: ${duplicateMappingCount}`);
  console.log(`Cannibalization signaled pairs: ${cannibalizationMetrics.signaledPairs}`);
  console.log(`Cannibalization high-signal pairs: ${cannibalizationMetrics.highSignalPairs}`);
}
