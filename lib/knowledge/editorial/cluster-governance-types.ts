import type { KpiKnowledgeObjectId } from "./mapping-registry";
import type { ContentNodeId, ContentType, EditorialNodeId } from "./types";

export type ClusterGovernanceStatus =
  | "active"
  | "planned"
  | "overloaded"
  | "broken"
  | "frozen"
  | "deprecated";

export type ClusterPriority = "critical" | "high" | "medium" | "low";

export interface ExpectedClusterCoverage {
  requiresPillar: boolean;
  requiresCommercialPath?: boolean;
  minSupportingContent: number;
  expectedContentTypes: ContentType[];
  expectedPlatforms: EditorialNodeId[];
  expectedMetrics: KpiKnowledgeObjectId[];
  optionalContentTypes: ContentType[];
}

export interface EditorialClusterDefinition {
  topicId: EditorialNodeId;
  slug: string;
  label: string;
  status: ClusterGovernanceStatus;
  priority: ClusterPriority;
  pillarId?: ContentNodeId;
  primaryPlatform?: EditorialNodeId;
  scope: (EditorialNodeId | KpiKnowledgeObjectId)[];
  expectedCoverage: ExpectedClusterCoverage;
}
