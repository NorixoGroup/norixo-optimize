import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import { inventoryEditorialAuditModule } from "./inventory";
import type { ContentType } from "../types";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function runEditorialInventorySmokeTest(): void {
  const context = buildEditorialAuditContext();
  const snapshot = JSON.stringify(context);
  const report = runEditorialAudit(context, [inventoryEditorialAuditModule]);
  const types: readonly ContentType[] = ["article", "guide", "tool", "solution", "ranking", "report", "local", "landing"];
  for (const topicId of ["topic:pricing", "topic:revenue", "topic:photos"]) {
    const cluster = report.clusters.find((candidate) => candidate.topicId === topicId);
    assert(cluster && cluster.inventory && cluster.inventory.total > 0 && !cluster.readiness && cluster.issues.length === 0, `${topicId} inventory must be complete without readiness.`);
    const inventory = cluster.inventory;
    assert(types.every((type) => Number.isInteger(inventory.byType[type]) && inventory.byType[type] >= 0) && inventory.total === Object.values(inventory.byType).reduce((sum, value) => sum + value, 0), `${topicId} totals must be coherent.`);
  }
  assert(JSON.stringify(runEditorialAudit(context, [inventoryEditorialAuditModule])) === JSON.stringify(report), "Inventory must be deterministic.");
  assert(JSON.stringify(context) === snapshot, "Inventory must not mutate context.");
  const emptyContext = { ...context, clusterDefinitions: [...context.clusterDefinitions, { topicId: "topic:empty" as const, slug: "empty", label: "Empty", status: "planned" as const, priority: "low" as const, primaryPlatform: "platform:airbnb" as const, scope: ["topic:empty" as const], expectedCoverage: { requiresPillar: false, minSupportingContent: 0, expectedContentTypes: [], expectedPlatforms: [], expectedMetrics: [], optionalContentTypes: [] } }] };
  const emptyCluster = runEditorialAudit(emptyContext, [inventoryEditorialAuditModule]).clusters.find((cluster) => cluster.topicId === "topic:empty");
  assert(emptyCluster?.inventory && emptyCluster.inventory.total === 0 && Object.values(emptyCluster.inventory.byType).every((count) => count === 0) && emptyCluster.issues.length === 0, "Empty clusters must have zero inventory and no issues.");
  console.log("Editorial inventory smoke passed.", Object.fromEntries(report.clusters.filter((cluster) => ["topic:pricing", "topic:revenue", "topic:photos"].includes(cluster.topicId)).map((cluster) => [cluster.topicId, cluster.inventory])));
}
