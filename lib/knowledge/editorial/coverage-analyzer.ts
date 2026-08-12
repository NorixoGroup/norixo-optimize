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

const contentTypeGapCodes: Partial<Record<ContentType, ClusterCoverageGap["code"]>> = {
  tool: "no_tool",
  solution: "no_solution",
  report: "no_report",
};

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

function expectedSupportingContentTypes(
  input: ClusterCoverageInput,
  pillarContentTypes: ReadonlySet<ContentType>
): ContentType[] {
  return uniqueInOrder(
    input.expectedCoverage.expectedContentTypes.filter((contentType) => !pillarContentTypes.has(contentType))
  );
}

function determineStatus(
  hasTopicMappings: boolean,
  pillarCount: number,
  supportingContentCount: number,
  hasRequiredSupportingContentTypes: boolean,
  gaps: readonly ClusterCoverageGap[],
  incoherentMappingCount: number,
  policy: ClusterCoveragePolicy,
  input: ClusterCoverageInput
): ClusterCoverageStatus {
  if (!hasTopicMappings) {
    return "missing";
  }

  if (incoherentMappingCount > 0 || (input.expectedCoverage.requiresPillar && pillarCount === 0)) {
    return "broken";
  }

  if (supportingContentCount >= policy.overloadedSupportingContentThreshold) {
    return "overloaded";
  }

  if (
    supportingContentCount < input.expectedCoverage.minSupportingContent ||
    !hasRequiredSupportingContentTypes ||
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
  const pillarContentTypes = new Set(
    pillarIds.flatMap((contentId) => {
      const node = contentById.get(contentId);
      return node ? [node.contentType] : [];
    })
  );
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

  const nonPillarCountsByContentType = createContentTypeCounts();

  memberIds.forEach((memberId) => {
    if (pillarIdSet.has(memberId)) return;

    const node = contentById.get(memberId);
    if (node) {
      nonPillarCountsByContentType[node.contentType] += 1;
    }
  });

  const requiredSupportingContentTypes = expectedSupportingContentTypes(input, pillarContentTypes);
  const hasRequiredSupportingContentTypes = requiredSupportingContentTypes.every(
    (contentType) => nonPillarCountsByContentType[contentType] > 0
  );
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

  if (input.expectedCoverage.requiresPillar && pillarIds.length === 0) {
    gaps.push({ code: "no_pillar", severity: "blocking" });
  }
  if (supportingContentIds.length === 0) {
    gaps.push({ code: "no_supporting_content", severity: "coverage" });
  }

  input.expectedCoverage.expectedContentTypes.forEach((contentType) => {
    const gapCode = contentTypeGapCodes[contentType];
    if (gapCode && nonPillarCountsByContentType[contentType] === 0) {
      gaps.push({ code: gapCode, severity: "coverage" });
    }
  });
  input.expectedCoverage.optionalContentTypes.forEach((contentType) => {
    const gapCode = contentTypeGapCodes[contentType];
    if (gapCode && nonPillarCountsByContentType[contentType] === 0) {
      gaps.push({ code: gapCode, severity: "optional" });
    }
  });

  if (
    input.expectedCoverage.expectedPlatforms.some((expectedPlatform) => !platforms.includes(expectedPlatform))
  ) {
    gaps.push({ code: "no_platform_mapping", severity: "coverage" });
  }
  if (input.expectedCoverage.expectedMetrics.some((expectedMetric) => !metrics.includes(expectedMetric))) {
    gaps.push({ code: "no_metric_mapping", severity: "coverage" });
  }
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
      hasRequiredSupportingContentTypes,
      gaps,
      incoherentMappingCount,
      policy,
      input
    ),
  };
}
