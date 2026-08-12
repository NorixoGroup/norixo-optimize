import { analyzeClusterCoverage } from "../coverage-analyzer";
import type { ClusterGovernanceStatus, ClusterPriority } from "../cluster-governance-types";
import type { ClusterCoverageStatus } from "../coverage-types";
import type { ContentNodeId } from "../types";
import type { EditorialAuditIssue } from "./types";
import type { EditorialAuditModule } from "./engine";

export interface EditorialCoverageGovernanceMetrics {
  governancePresent: boolean;
  governanceStatus?: ClusterGovernanceStatus;
  governancePriority?: ClusterPriority;
  pillarDeclared: boolean;
  expectedPillarId?: ContentNodeId;
  coverageAvailable: boolean;
  coverageStatus?: ClusterCoverageStatus;
  coveragePillarCount: number;
  coverageSupportingCount: number;
  governanceCoverageAligned: boolean;
}

function isClusterTopicId(topicId: string): topicId is `topic:${string}` {
  return topicId.startsWith("topic:");
}

function issue(
  code: "governance_coverage_mismatch" | "expected_pillar_missing" | "pillar_mismatch",
  severity: "warning" | "error",
  message: string,
  clusterId: `topic:${string}`
): EditorialAuditIssue {
  return { code, severity, message, clusterId };
}

function isStatusAligned(
  governanceStatus: ClusterGovernanceStatus,
  coverageStatus: ClusterCoverageStatus
): boolean {
  switch (governanceStatus) {
    case "active":
      return coverageStatus === "strong";
    case "overloaded":
      return coverageStatus === "overloaded" || coverageStatus === "partial";
    case "planned":
      return coverageStatus !== "broken";
    case "broken":
      return coverageStatus === "broken" || coverageStatus === "missing";
    case "frozen":
    case "deprecated":
      return true;
  }
}

export const coverageGovernanceEditorialAuditModule: EditorialAuditModule<{
  clusters: readonly {
    topicId: `topic:${string}`;
    coverage: EditorialCoverageGovernanceMetrics;
    issues: EditorialAuditIssue[];
  }[];
}> = {
  id: "coverage_governance",
  run(context) {
    return {
      clusters: context.clusterDefinitions.map((cluster) => {
        const { topicId } = cluster;
        if (!isClusterTopicId(topicId)) {
          throw new Error(`Editorial cluster definitions must use topic IDs: ${topicId}`);
        }

        const coverage = analyzeClusterCoverage({
          topicId,
          contentNodes: context.contentNodes,
          mappings: context.mappings,
          editorialNodes: context.editorialNodes,
          expectedCoverage: cluster.expectedCoverage,
        });
        const actualPillarIds = context.mappings
          .filter((mapping) => mapping.type === "pillar_for" && mapping.targetId === topicId)
          .map((mapping) => mapping.sourceId);
        const pillarRequiredMissing = cluster.expectedCoverage.requiresPillar && coverage.pillarCount === 0;
        const pillarMismatch = Boolean(
          cluster.pillarId
          && coverage.pillarCount > 0
          && (actualPillarIds.length !== 1 || actualPillarIds[0] !== cluster.pillarId)
        );
        const statusAligned = isStatusAligned(cluster.status, coverage.status);
        const governanceCoverageAligned = !pillarRequiredMissing && !pillarMismatch && statusAligned;
        const issues: EditorialAuditIssue[] = [];

        if (pillarRequiredMissing) {
          issues.push(issue(
            "expected_pillar_missing",
            cluster.status === "active" ? "error" : "warning",
            "Governance requires a pillar but coverage found none.",
            topicId
          ));
        } else if (pillarMismatch) {
          issues.push(issue(
            "pillar_mismatch",
            cluster.status === "active" ? "error" : "warning",
            "The governance pillar does not match the coverage pillar.",
            topicId
          ));
        } else if (!statusAligned) {
          issues.push(issue(
            "governance_coverage_mismatch",
            coverage.status === "broken" || coverage.status === "missing" ? "error" : "warning",
            `Governance status ${cluster.status} is not aligned with coverage status ${coverage.status}.`,
            topicId
          ));
        }

        return {
          topicId,
          coverage: {
            governancePresent: true,
            governanceStatus: cluster.status,
            governancePriority: cluster.priority,
            pillarDeclared: Boolean(cluster.pillarId),
            expectedPillarId: cluster.pillarId,
            coverageAvailable: coverage.status !== "missing",
            coverageStatus: coverage.status,
            coveragePillarCount: coverage.pillarCount,
            coverageSupportingCount: coverage.supportingContentCount,
            governanceCoverageAligned,
          },
          issues,
        };
      }),
    };
  },
};
