import { editorialLinkResolverMaxLinks, resolveEditorialLinks } from "../link-resolver";
import type { ContentNodeId } from "../types";
import type { EditorialAuditModule } from "./engine";

export interface EditorialResolverMetrics {
  eligibleNodes: number;
  nodesWithLinks: number;
  nodesWithoutLinks: number;
  totalResolvedLinks: number;
  averageLinks: number;
  medianLinks: number;
  minLinks: number;
  maxLinks: number;
  nodesAtLimit: number;
  maxLinksLimit: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function emptyMetrics(): EditorialResolverMetrics {
  return {
    eligibleNodes: 0,
    nodesWithLinks: 0,
    nodesWithoutLinks: 0,
    totalResolvedLinks: 0,
    averageLinks: 0,
    medianLinks: 0,
    minLinks: 0,
    maxLinks: 0,
    nodesAtLimit: 0,
    maxLinksLimit: editorialLinkResolverMaxLinks,
  };
}

function isClusterTopicId(topicId: string): topicId is `topic:${string}` {
  return topicId.startsWith("topic:");
}

export const resolverMetricsEditorialAuditModule: EditorialAuditModule<{
  clusters: readonly { topicId: `topic:${string}`; resolverMetrics: EditorialResolverMetrics; issues: [] }[];
}> = {
  id: "resolver_metrics",
  run(context) {
    return {
      clusters: context.clusterDefinitions.map((cluster) => {
        const { topicId } = cluster;
        if (!isClusterTopicId(topicId)) {
          throw new Error(`Editorial cluster definitions must use topic IDs: ${topicId}`);
        }

        const memberIds = new Set<ContentNodeId>(
          context.mappings.flatMap((mapping) =>
            (mapping.type === "part_of_cluster" || mapping.type === "pillar_for" || mapping.type === "is_about")
            && mapping.targetId === topicId
              ? context.contentNodes.some((node) => node.id === mapping.sourceId)
                ? [mapping.sourceId as ContentNodeId]
                : []
              : []
          )
        );
        const eligibleNodes = context.contentNodes.filter((node) => memberIds.has(node.id));
        const linkCounts = eligibleNodes.map((node) => resolveEditorialLinks(node.id).length);

        if (linkCounts.length === 0) {
          return { topicId, resolverMetrics: emptyMetrics(), issues: [] };
        }

        const totalResolvedLinks = linkCounts.reduce((total, count) => total + count, 0);
        const nodesWithLinks = linkCounts.filter((count) => count > 0).length;

        return {
          topicId,
          resolverMetrics: {
            eligibleNodes: eligibleNodes.length,
            nodesWithLinks,
            nodesWithoutLinks: eligibleNodes.length - nodesWithLinks,
            totalResolvedLinks,
            averageLinks: totalResolvedLinks / eligibleNodes.length,
            medianLinks: median(linkCounts),
            minLinks: Math.min(...linkCounts),
            maxLinks: Math.max(...linkCounts),
            nodesAtLimit: linkCounts.filter((count) => count >= editorialLinkResolverMaxLinks).length,
            maxLinksLimit: editorialLinkResolverMaxLinks,
          },
          issues: [],
        };
      }),
    };
  },
};
