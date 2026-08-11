import { getKnowledgeObject } from "../registry";
import type {
  ClusterCoverageGap,
  ClusterCoverageInput,
  ClusterCoveragePolicy,
  ClusterCoverageReport,
  ClusterCoverageStatus,
} from "./coverage-types";
import type { ContentNodeId, ContentType, EditorialNodeId } from "./types";
import type { EditorialMapping, KpiKnowledgeObjectId } from "./mapping-registry";

/**
 * Structural policy only. The threshold is deliberately explicit so editorial
 * governance can revise it without changing the analyzer's mechanics.
 */
export const defaultClusterCoveragePolicy: ClusterCoveragePolicy = {
  minimumSupportingContent: 1,
  minimumDistinctSupportingContentTypes: 2,
  overloadedSupportingContentThreshold: 24,
};

const contentTypes: readonly ContentType[] = [
  "article",
  "guide",
  "tool",
  "solution",
  "ranking",
  "report",
  "local",
  "landing",
];

function createContentTypeCounts(): Record<ContentType, number> {
  return Object.fromEntries(contentTypes.map((contentType) => [contentType, 0])) as Record<
    ContentType,
    number
  >;
}

function uniqueInOrder<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function isKpiKnowledgeObjectId(id: string): id is KpiKnowledgeObjectId {
  return /^(domains|metrics|inventory|revenue)\.[^\s.]+$/.test(id);
}

function isKpiMetricMapping(mapping: EditorialMapping): mapping is Extract<EditorialMapping, {
  type: "uses_metric";
}> {
  return mapping.type === "uses_metric" && isKpiKnowledgeObjectId(mapping.targetId);
}

function clusterMemberIds(topicId: EditorialNodeId, mappings: readonly EditorialMapping[]): ContentNodeId[] {
  return uniqueInOrder(
    mappings.flatMap((mapping) => {
      if (
        (mapping.type === "part_of_cluster" || mapping.type === "pillar_for") &&
        mapping.targetId === topicId
      ) {
        return [mapping.sourceId as ContentNodeId];
      }

      return [];
    })
  );
}

function countIncoherentMappings(input: ClusterCoverageInput): number {
  const knownEditorialIds = new Set([
    ...input.contentNodes.map((node) => node.id),
    ...(input.editorialNodes ?? []).map((node) => node.id),
  ]);

  return input.mappings.filter((mapping) => {
    if (!knownEditorialIds.has(mapping.sourceId)) {
      return true;
    }

    if (isKpiMetricMapping(mapping)) {
      return !getKnowledgeObject(mapping.targetId);
    }

    return !knownEditorialIds.has(mapping.targetId);
  }).length;
}

function determineStatus(
  hasTopicMappings: boolean,
  pillarCount: number,
  supportingContentCount: number,
  supportingContentTypeCount: number,
  gaps: readonly ClusterCoverageGap[],
  incoherentMappingCount: number,
  policy: ClusterCoveragePolicy
): ClusterCoverageStatus {
  if (!hasTopicMappings) {
    return "missing";
  }

  if (incoherentMappingCount > 0 || pillarCount === 0) {
    return "broken";
  }

  if (supportingContentCount >= policy.overloadedSupportingContentThreshold) {
    return "overloaded";
  }

  if (
    supportingContentCount < policy.minimumSupportingContent ||
    supportingContentTypeCount < policy.minimumDistinctSupportingContentTypes ||
    gaps.some((gap) => gap.severity === "coverage")
  ) {
    return "partial";
  }

  return "strong";
}

export function analyzeClusterCoverage(input: ClusterCoverageInput): ClusterCoverageReport {
  const policy = input.policy ?? defaultClusterCoveragePolicy;
  const memberIds = clusterMemberIds(input.topicId, input.mappings);
  const memberIdSet = new Set(memberIds);
  const contentById = new Map(input.contentNodes.map((node) => [node.id, node]));
  const pillarIds = input.mappings
    .filter((mapping) => mapping.type === "pillar_for" && mapping.targetId === input.topicId)
    .map((mapping) => mapping.sourceId as ContentNodeId);
  const pillarIdSet = new Set(pillarIds);
  const supportingContentIds = uniqueInOrder(
    input.mappings.flatMap((mapping) =>
      mapping.type === "supports" && pillarIdSet.has(mapping.targetId as ContentNodeId)
        ? [mapping.sourceId as ContentNodeId]
        : []
    )
  );
  const countsByContentType = createContentTypeCounts();

  memberIds.forEach((memberId) => {
    const node = contentById.get(memberId);
    if (node) {
      countsByContentType[node.contentType] += 1;
    }
  });

  const supportingContentTypeCount = new Set(
    supportingContentIds.flatMap((contentId) => {
      const node = contentById.get(contentId);
      return node ? [node.contentType] : [];
    })
  ).size;
  const platforms = uniqueInOrder(
    input.mappings.flatMap((mapping) =>
      mapping.type === "applies_to" && memberIdSet.has(mapping.sourceId as ContentNodeId)
        ? [mapping.targetId as EditorialNodeId]
        : []
    )
  );
  const metrics = uniqueInOrder(
    input.mappings.flatMap((mapping) =>
      isKpiMetricMapping(mapping) && memberIdSet.has(mapping.sourceId)
        ? [mapping.targetId]
        : []
    )
  );
  const commercialPaths = uniqueInOrder(
    input.mappings.flatMap((mapping) =>
      mapping.type === "commercial_path_to" && memberIdSet.has(mapping.sourceId as ContentNodeId)
        ? [mapping.targetId as ContentNodeId]
        : []
    )
  );
  const incoherentMappingCount = countIncoherentMappings(input);
  const gaps: ClusterCoverageGap[] = [];

  if (pillarIds.length === 0) gaps.push({ code: "no_pillar", severity: "blocking" });
  if (supportingContentIds.length === 0) {
    gaps.push({ code: "no_supporting_content", severity: "coverage" });
  }
  if (countsByContentType.tool === 0) gaps.push({ code: "no_tool", severity: "coverage" });
  if (countsByContentType.solution === 0) gaps.push({ code: "no_solution", severity: "coverage" });
  if (countsByContentType.report === 0) gaps.push({ code: "no_report", severity: "optional" });
  if (platforms.length === 0) gaps.push({ code: "no_platform_mapping", severity: "coverage" });
  if (metrics.length === 0) gaps.push({ code: "no_metric_mapping", severity: "coverage" });
  if (commercialPaths.length === 0) gaps.push({ code: "no_commercial_path", severity: "coverage" });
  if (incoherentMappingCount > 0) {
    gaps.push({ code: "mapping_incoherent", severity: "blocking" });
  }

  const hasTopicMappings = input.mappings.some(
    (mapping) => mapping.targetId === input.topicId
  );

  return {
    topicId: input.topicId,
    pillarCount: pillarIds.length,
    supportingContentCount: supportingContentIds.length,
    countsByContentType,
    platforms,
    metrics,
    commercialPaths,
    gaps,
    incoherentMappingCount,
    status: determineStatus(
      hasTopicMappings,
      pillarIds.length,
      supportingContentIds.length,
      supportingContentTypeCount,
      gaps,
      incoherentMappingCount,
      policy
    ),
  };
}
