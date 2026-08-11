import type { ContentNodeId, ContentType, EditorialNodeId } from "../types";

export type EditorialClusterReadiness =
  | "ready"
  | "needs_relations"
  | "needs_governance"
  | "overloaded"
  | "missing";

export type EditorialAuditIssueSeverity = "info" | "warning" | "error";

export interface EditorialAuditIssue {
  code: string;
  severity: EditorialAuditIssueSeverity;
  message: string;
  clusterId?: EditorialNodeId;
  nodeId?: ContentNodeId | EditorialNodeId;
}

export interface EditorialClusterAudit {
  topicId: `topic:${string}`;
  readiness?: EditorialClusterReadiness;
  issues: EditorialAuditIssue[];
  inventory?: {
    total: number;
    byType: Record<ContentType, number>;
  };
  resolverMetrics?: unknown;
  coverage?: unknown;
  governance?: unknown;
}

export interface EditorialAuditReport {
  schemaVersion: typeof auditSchemaVersion;
  generatedBy: typeof generatedBy;
  clusters: EditorialClusterAudit[];
  issues: EditorialAuditIssue[];
}

export const auditSchemaVersion = "1" as const;
export const generatedBy = "norixo-editorial-audit" as const;
