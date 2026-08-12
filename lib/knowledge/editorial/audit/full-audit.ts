import { buildEditorialAuditContext } from "./context";
import { coverageGovernanceEditorialAuditModule } from "./coverage-governance";
import { cannibalizationEditorialAuditModule } from "./cannibalization";
import { runEditorialAudit } from "./engine";
import { inventoryEditorialAuditModule } from "./inventory";
import { orphansDuplicatesEditorialAuditModule } from "./orphans-duplicates";
import { readinessEditorialAuditModule } from "./readiness";
import { resolverMetricsEditorialAuditModule } from "./resolver-metrics";
import type { EditorialAuditReport } from "./types";

const fullEditorialAuditModules = [
  inventoryEditorialAuditModule,
  resolverMetricsEditorialAuditModule,
  coverageGovernanceEditorialAuditModule,
  orphansDuplicatesEditorialAuditModule,
  cannibalizationEditorialAuditModule,
  readinessEditorialAuditModule,
] as const;

export function runFullEditorialAudit(): EditorialAuditReport {
  return runEditorialAudit(buildEditorialAuditContext(), fullEditorialAuditModules);
}
