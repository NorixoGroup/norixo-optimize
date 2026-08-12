import type { ContentNodeId } from "../types";
import type { EditorialAuditModule } from "./engine";
import type { EditorialAuditIssue } from "./types";

export const sharedOutgoingRatioThreshold = 0.6;
export const signaledPairThreshold = 2;
export const highSignalThreshold = 3;

export interface EditorialCannibalizationPair {
  leftNodeId: ContentNodeId;
  rightNodeId: ContentNodeId;
  sharedClusters: `topic:${string}`[];
  sharedOutgoingTargets: string[];
  sharedOutgoingRatio: number;
  samePrimaryTopic: boolean;
  reciprocalRelatedTo: boolean;
  signalCount: number;
}

export interface EditorialCannibalizationMetrics {
  analyzedArticles: number;
  analyzedPairs: number;
  signaledPairs: number;
  highSignalPairs: number;
  signalCountDistribution: {
    zero: number;
    one: number;
    two: number;
    three: number;
  };
  pairs: EditorialCannibalizationPair[];
}

interface ArticleRelations {
  clusters: Set<`topic:${string}`>;
  primaryTopics: Set<`topic:${string}`>;
  outgoingTargets: Set<string>;
  relatedTargets: Set<string>;
}

function isTopicId(id: string): id is `topic:${string}` {
  return id.startsWith("topic:");
}

function hasSharedValue<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  return [...left].some((value) => right.has(value));
}

function sharedValues<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): T[] {
  return [...left].filter((value) => right.has(value));
}

export const cannibalizationEditorialAuditModule: EditorialAuditModule<{
  clusters: [];
  issues: EditorialAuditIssue[];
  diagnostics: { cannibalization: EditorialCannibalizationMetrics };
}> = {
  id: "cannibalization",
  run(context) {
    const articles = context.contentNodes.filter((node) => node.contentType === "article");
    const articleRelations = new Map<string, ArticleRelations>(
      articles.map((article) => [article.id, {
        clusters: new Set(),
        primaryTopics: new Set(),
        outgoingTargets: new Set(),
        relatedTargets: new Set(),
      }])
    );

    context.mappings.forEach((mapping) => {
      const relations = articleRelations.get(mapping.sourceId);
      if (!relations) return;

      if ((mapping.type === "part_of_cluster" || mapping.type === "is_about") && isTopicId(mapping.targetId)) {
        relations.clusters.add(mapping.targetId);
      }
      if (mapping.type === "is_about" && isTopicId(mapping.targetId)) {
        relations.primaryTopics.add(mapping.targetId);
      }
      if (mapping.type === "supports" || mapping.type === "related_to" || mapping.type === "commercial_path_to") {
        relations.outgoingTargets.add(mapping.targetId);
      }
      if (mapping.type === "related_to") {
        relations.relatedTargets.add(mapping.targetId);
      }
    });

    const pairs: EditorialCannibalizationPair[] = [];
    let analyzedPairs = 0;
    const signalCountDistribution = { zero: 0, one: 0, two: 0, three: 0 };

    articles.forEach((left, leftIndex) => {
      const leftRelations = articleRelations.get(left.id)!;

      articles.slice(leftIndex + 1).forEach((right) => {
        const rightRelations = articleRelations.get(right.id)!;
        const sharedClusters = sharedValues(leftRelations.clusters, rightRelations.clusters);
        // A shared cluster makes two articles comparable; it is not itself a cannibalization signal.
        if (sharedClusters.length === 0) return;

        analyzedPairs += 1;
        const sharedOutgoingTargets = sharedValues(leftRelations.outgoingTargets, rightRelations.outgoingTargets);
        const outgoingUnion = new Set([...leftRelations.outgoingTargets, ...rightRelations.outgoingTargets]);
        const sharedOutgoingRatio = outgoingUnion.size === 0 ? 0 : sharedOutgoingTargets.length / outgoingUnion.size;
        const samePrimaryTopic = hasSharedValue(leftRelations.primaryTopics, rightRelations.primaryTopics);
        const reciprocalRelatedTo = leftRelations.relatedTargets.has(right.id) && rightRelations.relatedTargets.has(left.id);
        const signalCount = Number(samePrimaryTopic)
          + Number(sharedOutgoingRatio >= sharedOutgoingRatioThreshold)
          + Number(reciprocalRelatedTo);

        if (signalCount === 0) signalCountDistribution.zero += 1;
        if (signalCount === 1) signalCountDistribution.one += 1;
        if (signalCount === 2) signalCountDistribution.two += 1;
        if (signalCount === 3) signalCountDistribution.three += 1;

        if (signalCount >= signaledPairThreshold) {
          pairs.push({
            leftNodeId: left.id,
            rightNodeId: right.id,
            sharedClusters,
            sharedOutgoingTargets,
            sharedOutgoingRatio,
            samePrimaryTopic,
            reciprocalRelatedTo,
            signalCount,
          });
        }
      });
    });

    const highSignalPairs = pairs.filter((pair) => pair.signalCount >= highSignalThreshold);
    const metrics: EditorialCannibalizationMetrics = {
      analyzedArticles: articles.length,
      analyzedPairs,
      signaledPairs: pairs.length,
      highSignalPairs: highSignalPairs.length,
      signalCountDistribution,
      pairs,
    };
    const issues: EditorialAuditIssue[] = highSignalPairs.map((pair) => ({
      code: "cannibalization_signal_detected",
      severity: "info",
      message: `Structural cannibalization signals detected for ${pair.leftNodeId} and ${pair.rightNodeId}.`,
      nodeId: pair.leftNodeId,
    }));

    return { clusters: [], issues, diagnostics: { cannibalization: metrics } };
  },
};
