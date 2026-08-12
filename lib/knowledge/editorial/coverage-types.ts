import type {
  ContentNode,
  ContentNodeId,
  ContentType,
  EditorialNode,
  EditorialNodeId,
} from "./types";
import type { ExpectedClusterCoverage } from "./cluster-governance-types";
import type { EditorialMapping, KpiKnowledgeObjectId } from "./mapping-registry";

export type ClusterCoverageStatus = "strong" | "partial" | "overloaded" | "broken" | "missing";

export type ClusterCoverageGapCode =
  | "no_pillar"
  | "no_supporting_content"
  | "no_tool"
  | "no_solution"
  | "no_report"
  | "no_platform_mapping"
  | "no_metric_mapping"
  | "no_commercial_path"
  | "mapping_incoherent";

export interface ClusterCoverageGap {
  code: ClusterCoverageGapCode;
  severity: "blocking" | "coverage" | "optional";
}

export interface ClusterCoveragePolicy {
  minimumSupportingContent: number;
  minimumDistinctSupportingContentTypes: number;
  overloadedSupportingContentThreshold: number;
}

export interface ClusterCoverageInput {
  topicId: EditorialNodeId;
  contentNodes: readonly ContentNode[];
  mappings: readonly EditorialMapping[];
  editorialNodes?: readonly EditorialNode[];
  expectedCoverage: ExpectedClusterCoverage;
  policy?: ClusterCoveragePolicy;
}

export interface ClusterCoverageReport {
  topicId: EditorialNodeId;
  pillarCount: number;
  supportingContentCount: number;
  countsByContentType: Record<ContentType, number>;
  platforms: EditorialNodeId[];
  metrics: KpiKnowledgeObjectId[];
  commercialPaths: ContentNodeId[];
  gaps: ClusterCoverageGap[];
  incoherentMappingCount: number;
  status: ClusterCoverageStatus;
}
