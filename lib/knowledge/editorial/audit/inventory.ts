import type { EditorialAuditModule } from "./engine";
import type { ContentType } from "../types";

const contentTypes: readonly ContentType[] = ["article", "guide", "tool", "solution", "ranking", "report", "local", "landing"];

export interface EditorialInventoryMetrics { total: number; byType: Record<ContentType, number>; }

function emptyMetrics(): EditorialInventoryMetrics {
  return { total: 0, byType: Object.fromEntries(contentTypes.map((type) => [type, 0])) as Record<ContentType, number> };
}

export const inventoryEditorialAuditModule: EditorialAuditModule<{ clusters: readonly { topicId: `topic:${string}`; inventory: EditorialInventoryMetrics; issues: [] }[] }> = {
  id: "inventory",
  run(context) {
    return {
      clusters: context.clusterDefinitions.map((cluster) => {
        const memberIds = new Set(context.mappings.flatMap((mapping) =>
          (mapping.type === "part_of_cluster" || mapping.type === "pillar_for" || mapping.type === "is_about") && mapping.targetId === cluster.topicId
            ? [mapping.sourceId] : []
        ));
        const inventory = emptyMetrics();
        context.contentNodes.forEach((node) => {
          if (memberIds.has(node.id)) inventory.byType[node.contentType] += 1;
        });
        inventory.total = contentTypes.reduce((total, type) => total + inventory.byType[type], 0);
        return { topicId: cluster.topicId as `topic:${string}`, inventory, issues: [] };
      }),
    };
  },
};
