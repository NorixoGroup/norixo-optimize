import { auditSchemaVersion, generatedBy } from "./types";
import type { EditorialAuditContext } from "./context";
import type { EditorialAuditDiagnostics, EditorialAuditIssue, EditorialAuditReport, EditorialClusterAudit } from "./types";

export interface EditorialAuditExecutionState {
  readonly clusters: readonly EditorialClusterAudit[];
  readonly issues: readonly EditorialAuditIssue[];
  readonly diagnostics: Readonly<EditorialAuditDiagnostics>;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object") {
    const object = value as object;
    if (seen.has(object)) return value;
    seen.add(object);
    Object.values(object).forEach((child) => deepFreeze(child, seen));
    Object.freeze(object);
  }

  return value;
}

export interface EditorialAuditModule<TResult extends {
  clusters?: readonly EditorialClusterAudit[];
  issues?: readonly EditorialAuditIssue[];
  diagnostics?: EditorialAuditDiagnostics;
}> {
  id: string;
  run(context: EditorialAuditContext, state?: EditorialAuditExecutionState): TResult;
}

function executionState(
  clusters: readonly EditorialClusterAudit[],
  issues: readonly EditorialAuditIssue[],
  diagnostics: ReadonlyMap<string, unknown>
): EditorialAuditExecutionState {
  return deepFreeze(structuredClone({
    clusters: Object.freeze([...clusters]),
    issues: Object.freeze([...issues]),
    diagnostics: Object.freeze(Object.fromEntries(diagnostics)),
  }));
}

/** Module errors propagate: a partial audit must never be reported as valid. */
export function runEditorialAudit(
  context: EditorialAuditContext,
  modules: readonly EditorialAuditModule<{
    clusters?: readonly EditorialClusterAudit[];
    issues?: readonly EditorialAuditIssue[];
    diagnostics?: EditorialAuditDiagnostics;
  }>[]
): EditorialAuditReport {
  const clusters: EditorialClusterAudit[] = [];
  const issues: EditorialAuditIssue[] = [];
  const diagnostics = new Map<string, unknown>();

  modules.forEach((module) => {
    const result = module.run(context, executionState(clusters, issues, diagnostics));
    if (result.clusters) clusters.push(...result.clusters);
    if (result.issues) issues.push(...result.issues);
    if (result.diagnostics) {
      Object.entries(result.diagnostics).forEach(([key, value]) => {
        if (diagnostics.has(key)) {
          throw new Error(`Duplicate editorial audit diagnostic key: ${key}`);
        }
        diagnostics.set(key, value);
      });
    }
  });

  return { schemaVersion: auditSchemaVersion, generatedBy, clusters, issues, diagnostics: Object.fromEntries(diagnostics) };
}
