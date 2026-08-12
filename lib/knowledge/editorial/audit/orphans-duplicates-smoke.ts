import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import { orphansDuplicatesEditorialAuditModule } from "./orphans-duplicates";
import type { EditorialAuditContext } from "./context";
import type { EditorialOrphanDuplicateMetrics } from "./orphans-duplicates";
import type { EditorialMapping } from "../mapping-registry";
import type { ContentNode, ContentNodeId, EditorialNode } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function contentNode(id: ContentNodeId): ContentNode {
  return {
    id,
    contentType: "article",
    slug: id.replace("content:article:", ""),
    path: `/${id.replace("content:article:", "")}`,
    title: id,
    source: "data/articles",
    locale: "en",
  };
}

function fixtureContext(contentNodes: readonly ContentNode[], mappings: readonly EditorialMapping[]): EditorialAuditContext {
  const topic: EditorialNode = { id: "topic:fixture", kind: "topic", label: "Fixture", status: "planned" };

  return { contentNodes, mappings, editorialNodes: [topic], clusterDefinitions: [] };
}

function runModule(context: EditorialAuditContext): EditorialOrphanDuplicateMetrics {
  return orphansDuplicatesEditorialAuditModule.run(context).metrics;
}

function assertIssueCounts(
  issues: ReturnType<typeof runEditorialAudit>["issues"],
  metrics: EditorialOrphanDuplicateMetrics
): void {
  assert(
    issues.filter((issue) => issue.code === "orphan_content_node").length === metrics.orphanCount,
    "Orphan issues must equal the orphan count."
  );
  assert(
    issues.filter((issue) => issue.code === "duplicate_mapping").length === metrics.duplicateMappingCount,
    "Duplicate issues must equal the duplicate mapping count."
  );
}

export function runEditorialOrphansDuplicatesSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const contextSnapshot = JSON.stringify(context);
  const mappingsSnapshot = JSON.stringify(context.mappings);
  const contentNodesSnapshot = JSON.stringify(context.contentNodes);
  const report = runEditorialAudit(context, [orphansDuplicatesEditorialAuditModule]);
  const metrics = runModule(context);

  assert(metrics.totalContentNodes > 0, "The real context must include content nodes.");
  assert(metrics.orphanCount >= 0 && metrics.orphanCount <= metrics.totalContentNodes, "Orphan count must be within the content-node total.");
  assert(metrics.orphanContentNodes.length === metrics.orphanCount, "Orphan IDs must equal the orphan count.");
  assert(metrics.duplicateMappingCount >= 0 && metrics.duplicateMappings.length === metrics.duplicateMappingCount, "Duplicate mapping keys must equal the duplicate count.");
  assert(report.clusters.length === 0 && report.clusters.every((cluster) => cluster.readiness === undefined), "The global module must not produce clusters or readiness.");
  assertIssueCounts(report.issues, metrics);

  const orphanId = "content:article:fixture-orphan" as const;
  const sourceOnlyId = "content:article:fixture-source-only" as const;
  const targetOnlyId = "content:article:fixture-target-only" as const;
  const connectedContext = fixtureContext(
    [contentNode(orphanId), contentNode(sourceOnlyId), contentNode(targetOnlyId)],
    [
      { type: "is_about", sourceId: sourceOnlyId, targetId: "topic:fixture" },
      { type: "related_to", sourceId: sourceOnlyId, targetId: targetOnlyId },
    ]
  );
  const connectedMetrics = runModule(connectedContext);
  assert(connectedMetrics.orphanCount === 1 && connectedMetrics.orphanContentNodes[0] === orphanId, "Only the unmapped fixture node must be orphaned.");
  assert(!connectedMetrics.orphanContentNodes.includes(sourceOnlyId), "A source-only connected node must not be orphaned.");
  assert(!connectedMetrics.orphanContentNodes.includes(targetOnlyId), "A target-only connected node must not be orphaned.");

  const duplicateSourceId = "content:article:fixture-duplicate-source" as const;
  const duplicateTargetId = "content:article:fixture-duplicate-target" as const;
  const duplicateMapping: EditorialMapping = {
    type: "related_to",
    sourceId: duplicateSourceId,
    targetId: duplicateTargetId,
  };
  const duplicateContext = fixtureContext(
    [contentNode(duplicateSourceId), contentNode(duplicateTargetId)],
    [duplicateMapping, { ...duplicateMapping }]
  );
  const duplicateMetrics = runModule(duplicateContext);
  const duplicateReport = runEditorialAudit(duplicateContext, [orphansDuplicatesEditorialAuditModule]);
  const duplicateKey = `${duplicateSourceId}|related_to|${duplicateTargetId}`;
  assert(duplicateMetrics.duplicateMappingCount === 1, "One repeated mapping must produce one duplicate.");
  assert(duplicateMetrics.duplicateMappings.includes(duplicateKey), "The duplicate mapping key must be returned.");
  assert(duplicateReport.issues.some((issue) => issue.code === "duplicate_mapping"), "A duplicate mapping must produce an issue.");

  const reverseContext = fixtureContext(
    [contentNode(duplicateSourceId), contentNode(duplicateTargetId)],
    [
      { type: "related_to", sourceId: duplicateSourceId, targetId: duplicateTargetId },
      { type: "related_to", sourceId: duplicateTargetId, targetId: duplicateSourceId },
    ]
  );
  assert(runModule(reverseContext).duplicateMappingCount === 0, "Inverse related mappings must not be considered duplicates.");

  assert(JSON.stringify(runEditorialAudit(context, [orphansDuplicatesEditorialAuditModule])) === JSON.stringify(report), "Orphans and duplicates must be deterministic.");
  assert(JSON.stringify(context) === contextSnapshot, "Orphans and duplicates must not mutate context.");
  assert(JSON.stringify(context.mappings) === mappingsSnapshot, "Orphans and duplicates must not mutate mappings.");
  assert(JSON.stringify(context.contentNodes) === contentNodesSnapshot, "Orphans and duplicates must not mutate content nodes.");

  console.log("Editorial orphans duplicates smoke passed.");
  console.log(`totalContentNodes: ${metrics.totalContentNodes}`);
  console.log(`orphanCount: ${metrics.orphanCount}`);
  console.log(`duplicateMappingCount: ${metrics.duplicateMappingCount}`);
}
