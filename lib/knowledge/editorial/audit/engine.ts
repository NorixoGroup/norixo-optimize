import { auditSchemaVersion, generatedBy } from "./types";
import type { EditorialAuditContext } from "./context";
import type { EditorialAuditIssue, EditorialAuditReport, EditorialClusterAudit } from "./types";

export interface EditorialAuditModule<TResult extends {
  clusters?: readonly EditorialClusterAudit[];
  issues?: readonly EditorialAuditIssue[];
}> {
  id: string;
  run(context: EditorialAuditContext): TResult;
}

/** Module errors propagate: a partial audit must never be reported as valid. */
export function runEditorialAudit(
  context: EditorialAuditContext,
  modules: readonly EditorialAuditModule<{ clusters?: readonly EditorialClusterAudit[]; issues?: readonly EditorialAuditIssue[] }>[]
): EditorialAuditReport {
  const clusters: EditorialClusterAudit[] = [];
  const issues: EditorialAuditIssue[] = [];

  modules.forEach((module) => {
    const result = module.run(context);
    if (result.clusters) clusters.push(...result.clusters);
    if (result.issues) issues.push(...result.issues);
  });

  return { schemaVersion: auditSchemaVersion, generatedBy, clusters, issues };
}
