import type { EditorialCoverageGovernanceMetrics } from "./coverage-governance";
import type { EditorialAuditExecutionState, EditorialAuditModule } from "./engine";
import type { EditorialResolverMetrics } from "./resolver-metrics";
import type { EditorialAuditIssue, EditorialClusterReadiness } from "./types";

export const relationsCoverageThreshold = 0.8;

export interface EditorialReadinessMetrics {
  topicId: `topic:${string}`;
  readiness: EditorialClusterReadiness;
  reasons: string[];
}

function isClusterTopicId(topicId: string): topicId is `topic:${string}` {
  return topicId.startsWith("topic:");
}

function isResolverMetrics(value: unknown): value is EditorialResolverMetrics {
  return typeof value === "object" && value !== null
    && typeof (value as { eligibleNodes?: unknown }).eligibleNodes === "number"
    && typeof (value as { nodesWithLinks?: unknown }).nodesWithLinks === "number";
}

function isCoverageGovernanceMetrics(value: unknown): value is EditorialCoverageGovernanceMetrics {
  return typeof value === "object" && value !== null
    && typeof (value as { governancePresent?: unknown }).governancePresent === "boolean"
    && typeof (value as { pillarDeclared?: unknown }).pillarDeclared === "boolean"
    && typeof (value as { governanceCoverageAligned?: unknown }).governanceCoverageAligned === "boolean"
    && typeof (value as { governanceStatus?: unknown }).governanceStatus === "string"
    && typeof (value as { coverageStatus?: unknown }).coverageStatus === "string";
}

function ensurePrerequisite(state: EditorialAuditExecutionState, prerequisite: "inventory" | "resolver_metrics" | "coverage_governance"): void {
  const available = state.clusters.some((cluster) => {
    if (prerequisite === "inventory") return cluster.inventory !== undefined;
    if (prerequisite === "resolver_metrics") return isResolverMetrics(cluster.resolverMetrics);
    return isCoverageGovernanceMetrics(cluster.coverage);
  });

  if (!available) throw new Error(`Missing prerequisite audit result: ${prerequisite}`);
}

function readinessIssue(metrics: EditorialReadinessMetrics): EditorialAuditIssue | undefined {
  if (metrics.readiness === "ready") return undefined;

  const severity = metrics.readiness === "needs_relations" ? "info" : "warning";
  const code = metrics.readiness === "missing"
    ? "readiness_missing"
    : metrics.readiness === "needs_governance"
      ? "readiness_needs_governance"
      : metrics.readiness === "overloaded"
        ? "readiness_overloaded"
        : "readiness_needs_relations";

  return {
    code,
    severity,
    message: `Readiness: ${metrics.reasons.join(",")}.`,
    clusterId: metrics.topicId,
  };
}

export const readinessEditorialAuditModule: EditorialAuditModule<{
  clusters: readonly {
    topicId: `topic:${string}`;
    readiness: EditorialClusterReadiness;
    readinessMetrics: EditorialReadinessMetrics;
    issues: EditorialAuditIssue[];
  }[];
}> = {
  id: "readiness",
  run(context, state) {
    if (!state) throw new Error("Readiness requires execution state.");

    ensurePrerequisite(state, "inventory");
    ensurePrerequisite(state, "resolver_metrics");
    ensurePrerequisite(state, "coverage_governance");

    // Orphans and cannibalization are global diagnostics and cannot yet be attributed safely to a cluster.
    return {
      clusters: context.clusterDefinitions.map((definition) => {
        if (!isClusterTopicId(definition.topicId)) {
          throw new Error(`Editorial cluster definitions must use topic IDs: ${definition.topicId}`);
        }

        const topicId = definition.topicId;
        const entries = state.clusters.filter((cluster) => cluster.topicId === topicId);
        const inventory = entries.find((cluster) => cluster.inventory)?.inventory;
        const resolverMetrics = entries.map((cluster) => cluster.resolverMetrics).find(isResolverMetrics);
        const coverageGovernance = entries.map((cluster) => cluster.coverage).find(isCoverageGovernanceMetrics);
        let readiness: EditorialClusterReadiness;
        let reasons: string[];

        if (!inventory || inventory.total === 0) {
          readiness = "missing";
          reasons = ["inventory_missing"];
        } else if (!coverageGovernance || !coverageGovernance.governancePresent) {
          readiness = "needs_governance";
          reasons = ["governance_missing"];
        } else if (
          coverageGovernance.governanceStatus === "planned"
          || coverageGovernance.governanceStatus === "frozen"
          || coverageGovernance.governanceStatus === "deprecated"
        ) {
          readiness = "needs_governance";
          reasons = ["governance_not_active"];
        } else if (
          definition.expectedCoverage.requiresPillar
          && !coverageGovernance.pillarDeclared
          && coverageGovernance.coveragePillarCount === 0
        ) {
          readiness = "needs_governance";
          reasons = ["pillar_missing"];
        } else if (!coverageGovernance.governanceCoverageAligned) {
          readiness = "needs_governance";
          reasons = ["governance_misaligned"];
        } else if (coverageGovernance.governanceStatus === "overloaded" || coverageGovernance.coverageStatus === "overloaded") {
          readiness = "overloaded";
          reasons = ["cluster_overloaded"];
        } else if (coverageGovernance.coverageStatus !== "strong") {
          readiness = "needs_relations";
          reasons = ["coverage_not_strong"];
        } else if (!resolverMetrics) {
          throw new Error("Missing prerequisite audit result: resolver_metrics");
        } else if (resolverMetrics.eligibleNodes === 0) {
          readiness = "needs_relations";
          reasons = ["no_eligible_link_nodes"];
        } else if (resolverMetrics.nodesWithLinks / resolverMetrics.eligibleNodes < relationsCoverageThreshold) {
          readiness = "needs_relations";
          reasons = ["relations_coverage_low"];
        } else {
          readiness = "ready";
          reasons = ["ready"];
        }

        const readinessMetrics: EditorialReadinessMetrics = { topicId, readiness, reasons };
        const issue = readinessIssue(readinessMetrics);

        return { topicId, readiness, readinessMetrics, issues: issue ? [issue] : [] };
      }),
    };
  },
};
