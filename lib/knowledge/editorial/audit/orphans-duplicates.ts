import type { EditorialMapping } from "../mapping-registry";
import type { ContentNodeId } from "../types";
import type { EditorialAuditModule } from "./engine";
import type { EditorialAuditIssue } from "./types";

const usefulRelations = new Set<EditorialMapping["type"]>([
  "is_about",
  "part_of_cluster",
  "pillar_for",
  "supports",
  "related_to",
  "commercial_path_to",
  "applies_to",
  "uses_metric",
]);

export interface EditorialOrphanDuplicateMetrics {
  totalContentNodes: number;
  orphanContentNodes: ContentNodeId[];
  orphanCount: number;
  duplicateMappings: string[];
  duplicateMappingCount: number;
}

function mappingKey(mapping: EditorialMapping): string {
  return `${mapping.sourceId}|${mapping.type}|${mapping.targetId}`;
}

export const orphansDuplicatesEditorialAuditModule: EditorialAuditModule<{
  clusters: [];
  issues: EditorialAuditIssue[];
  metrics: EditorialOrphanDuplicateMetrics;
}> = {
  id: "orphans_duplicates",
  run(context) {
    const connectedContentNodeIds = new Set<ContentNodeId>();

    context.mappings.forEach((mapping) => {
      if (!usefulRelations.has(mapping.type)) return;

      context.contentNodes.forEach((node) => {
        if (mapping.sourceId === node.id || mapping.targetId === node.id) {
          connectedContentNodeIds.add(node.id);
        }
      });
    });

    const orphanContentNodes = context.contentNodes
      .filter((node) => !connectedContentNodeIds.has(node.id))
      .map((node) => node.id);
    const seenMappingKeys = new Set<string>();
    const duplicateMappings = context.mappings.flatMap((mapping) => {
      const key = mappingKey(mapping);
      if (seenMappingKeys.has(key)) return [key];
      seenMappingKeys.add(key);
      return [];
    });
    const metrics: EditorialOrphanDuplicateMetrics = {
      totalContentNodes: context.contentNodes.length,
      orphanContentNodes,
      orphanCount: orphanContentNodes.length,
      duplicateMappings,
      duplicateMappingCount: duplicateMappings.length,
    };
    const issues: EditorialAuditIssue[] = [
      ...orphanContentNodes.map((nodeId) => ({
        code: "orphan_content_node",
        severity: "info" as const,
        message: `Content node has no useful editorial relation: ${nodeId}.`,
        nodeId,
      })),
      ...duplicateMappings.map((key) => ({
        code: "duplicate_mapping",
        severity: "warning" as const,
        message: `Duplicate editorial mapping: ${key}.`,
      })),
    ];

    return { clusters: [], issues, metrics };
  },
};
