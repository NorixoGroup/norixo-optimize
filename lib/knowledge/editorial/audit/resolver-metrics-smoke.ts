import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import { resolverMetricsEditorialAuditModule } from "./resolver-metrics";
import type { EditorialResolverMetrics } from "./resolver-metrics";
import { resolveEditorialLinks } from "../link-resolver";
import type { ContentNodeId } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function memberIdsForCluster(
  context: ReturnType<typeof buildEditorialAuditContext>,
  topicId: `topic:${string}`
): Set<ContentNodeId> {
  const contentIds = new Set(context.contentNodes.map((node) => node.id));

  return new Set(
    context.mappings.flatMap((mapping) =>
      (mapping.type === "part_of_cluster" || mapping.type === "pillar_for" || mapping.type === "is_about")
      && mapping.targetId === topicId
      && contentIds.has(mapping.sourceId as ContentNodeId)
        ? [mapping.sourceId as ContentNodeId]
        : []
    )
  );
}

function metricsFor(
  report: ReturnType<typeof runEditorialAudit>,
  topicId: `topic:${string}`
): EditorialResolverMetrics {
  const cluster = report.clusters.find((candidate) => candidate.topicId === topicId);
  assert(cluster && cluster.resolverMetrics, `${topicId} resolver metrics must be present.`);
  return cluster.resolverMetrics as EditorialResolverMetrics;
}

function assertMetricInvariants(topicId: `topic:${string}`, metrics: EditorialResolverMetrics): void {
  assert(metrics.eligibleNodes >= 0, `${topicId} eligible nodes must be non-negative.`);
  assert(metrics.nodesWithLinks + metrics.nodesWithoutLinks === metrics.eligibleNodes, `${topicId} link-node counts must equal eligible nodes.`);
  assert(metrics.totalResolvedLinks >= metrics.nodesWithLinks, `${topicId} resolved links must cover linked nodes.`);
  assert(metrics.averageLinks >= 0 && metrics.medianLinks >= 0 && metrics.minLinks >= 0, `${topicId} aggregate metrics must be non-negative.`);
  assert(metrics.maxLinks >= metrics.minLinks, `${topicId} max links must be at least min links.`);
  assert(metrics.nodesAtLimit >= 0 && metrics.maxLinksLimit > 0, `${topicId} resolver limit metrics must be valid.`);
}

function assertMedianMatchesResolvedLinks(
  context: ReturnType<typeof buildEditorialAuditContext>,
  topicId: `topic:${string}`,
  metrics: EditorialResolverMetrics
): void {
  const counts = context.contentNodes
    .filter((node) => memberIdsForCluster(context, topicId).has(node.id))
    .map((node) => resolveEditorialLinks(node.id).length)
    .sort((left, right) => left - right);
  const middle = Math.floor(counts.length / 2);
  const expectedMedian = counts.length === 0
    ? 0
    : counts.length % 2 === 0
      ? (counts[middle - 1] + counts[middle]) / 2
      : counts[middle];

  assert(metrics.medianLinks === expectedMedian, `${topicId} median must match resolved-link counts.`);
}

export function runEditorialResolverMetricsSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const contextSnapshot = JSON.stringify(context);
  const mappingsSnapshot = JSON.stringify(context.mappings);
  const contentNodesSnapshot = JSON.stringify(context.contentNodes);
  const clusterDefinitionsSnapshot = JSON.stringify(context.clusterDefinitions);
  const report = runEditorialAudit(context, [resolverMetricsEditorialAuditModule]);
  const knownTopics = ["topic:photos", "topic:pricing", "topic:revenue"] as const;
  const metricsByTopic = Object.fromEntries(knownTopics.map((topicId) => [topicId, metricsFor(report, topicId)]));

  knownTopics.forEach((topicId) => {
    const metrics = metricsByTopic[topicId];
    assertMetricInvariants(topicId, metrics);
    assert(metrics.eligibleNodes === memberIdsForCluster(context, topicId).size, `${topicId} members must be deduplicated.`);
    assertMedianMatchesResolvedLinks(context, topicId, metrics);
  });

  assert(metricsByTopic["topic:photos"].nodesWithLinks > 0, "Photos must contain at least one node with resolved links.");
  assert(metricsByTopic["topic:pricing"].nodesWithLinks > 0, "Pricing must contain nodes with resolved links.");
  assert(metricsByTopic["topic:revenue"].nodesWithLinks > 0, "Revenue must contain nodes with resolved links.");

  const pricingMembers = memberIdsForCluster(context, "topic:pricing");
  const revenueMembers = memberIdsForCluster(context, "topic:revenue");
  const sharedPricingRevenueMembers = [...pricingMembers].filter((id) => revenueMembers.has(id));
  assert(sharedPricingRevenueMembers.length > 0, "Pricing and Revenue must retain their shared multi-cluster members.");
  assert(
    metricsByTopic["topic:pricing"].eligibleNodes === pricingMembers.size
    && metricsByTopic["topic:revenue"].eligibleNodes === revenueMembers.size,
    "Shared members must occur once per cluster without duplication."
  );

  const emptyContext = {
    ...context,
    clusterDefinitions: [
      ...context.clusterDefinitions,
      {
        topicId: "topic:empty" as const,
        slug: "empty",
        label: "Empty",
        status: "planned" as const,
        priority: "low" as const,
        primaryPlatform: "platform:airbnb" as const,
        scope: ["topic:empty" as const],
        expectedCoverage: {
          requiresPillar: false,
          minSupportingContent: 0,
          expectedContentTypes: [],
          expectedPlatforms: [],
          expectedMetrics: [],
          optionalContentTypes: [],
        },
      },
    ],
  };
  const emptyMetrics = metricsFor(runEditorialAudit(emptyContext, [resolverMetricsEditorialAuditModule]), "topic:empty");
  assert(
    emptyMetrics.eligibleNodes === 0
    && emptyMetrics.nodesWithLinks === 0
    && emptyMetrics.nodesWithoutLinks === 0
    && emptyMetrics.totalResolvedLinks === 0
    && emptyMetrics.averageLinks === 0
    && emptyMetrics.medianLinks === 0
    && emptyMetrics.minLinks === 0
    && emptyMetrics.maxLinks === 0
    && emptyMetrics.nodesAtLimit === 0,
    "Empty clusters must have zero resolver metrics."
  );

  assert(JSON.stringify(runEditorialAudit(context, [resolverMetricsEditorialAuditModule])) === JSON.stringify(report), "Resolver metrics must be deterministic.");
  assert(JSON.stringify(context) === contextSnapshot, "Resolver metrics must not mutate context.");
  assert(JSON.stringify(context.mappings) === mappingsSnapshot, "Resolver metrics must not mutate mappings.");
  assert(JSON.stringify(context.contentNodes) === contentNodesSnapshot, "Resolver metrics must not mutate content nodes.");
  assert(JSON.stringify(context.clusterDefinitions) === clusterDefinitionsSnapshot, "Resolver metrics must not mutate cluster definitions.");

  console.log("Editorial resolver metrics smoke passed.");
  console.log("Photos", metricsByTopic["topic:photos"]);
  console.log("Pricing", metricsByTopic["topic:pricing"]);
  console.log("Revenue", metricsByTopic["topic:revenue"]);
}
