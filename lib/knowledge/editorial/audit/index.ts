export {
  auditSchemaVersion,
  generatedBy,
} from "./types";
export type {
  EditorialAuditIssue,
  EditorialAuditIssueSeverity,
  EditorialAuditReport,
  EditorialClusterAudit,
  EditorialClusterReadiness,
} from "./types";
export { buildEditorialAuditContext } from "./context";
export type { EditorialAuditContext } from "./context";
export { runEditorialAudit } from "./engine";
export type { EditorialAuditModule } from "./engine";
export { inventoryEditorialAuditModule } from "./inventory";
export type { EditorialInventoryMetrics } from "./inventory";
export { resolverMetricsEditorialAuditModule } from "./resolver-metrics";
export type { EditorialResolverMetrics } from "./resolver-metrics";
export { coverageGovernanceEditorialAuditModule } from "./coverage-governance";
export type { EditorialCoverageGovernanceMetrics } from "./coverage-governance";
export { orphansDuplicatesEditorialAuditModule } from "./orphans-duplicates";
export type { EditorialOrphanDuplicateMetrics } from "./orphans-duplicates";
export { cannibalizationEditorialAuditModule } from "./cannibalization";
export type { EditorialCannibalizationMetrics, EditorialCannibalizationPair } from "./cannibalization";
export { readinessEditorialAuditModule } from "./readiness";
export type { EditorialReadinessMetrics } from "./readiness";
