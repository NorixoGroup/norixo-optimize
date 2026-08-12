import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import { cannibalizationEditorialAuditModule } from "./cannibalization";
import { highSignalThreshold, signaledPairThreshold } from "./cannibalization";
import type { EditorialAuditContext } from "./context";
import type { EditorialCannibalizationMetrics } from "./cannibalization";
import type { EditorialMapping } from "../mapping-registry";
import type { ContentNode, ContentNodeId, EditorialNode } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function article(id: ContentNodeId): ContentNode {
  return {
    id,
    contentType: "article",
    slug: id.replace("content:article:", ""),
    path: `/${id.replace("content:article:", "")}`,
    title: id,
    source: "data/articles",
    locale: "en",
  };
}

function guide(id: ContentNodeId): ContentNode {
  return {
    id,
    contentType: "guide",
    slug: id.replace("content:guide:", ""),
    path: `/${id.replace("content:guide:", "")}`,
    title: id,
    source: "data/guides",
    locale: "en",
  };
}

function fixtureContext(contentNodes: readonly ContentNode[], mappings: readonly EditorialMapping[]): EditorialAuditContext {
  const editorialNodes: readonly EditorialNode[] = [
    { id: "topic:fixture-cluster", kind: "topic", label: "Fixture cluster", status: "planned" },
    { id: "topic:fixture-primary-left", kind: "topic", label: "Fixture primary left", status: "planned" },
    { id: "topic:fixture-primary-right", kind: "topic", label: "Fixture primary right", status: "planned" },
    { id: "topic:fixture-primary-shared", kind: "topic", label: "Fixture primary shared", status: "planned" },
  ];

  return { contentNodes, mappings, editorialNodes, clusterDefinitions: [] };
}

function metricsFor(report: ReturnType<typeof runEditorialAudit>): EditorialCannibalizationMetrics {
  const metrics = report.diagnostics.cannibalization;
  assert(metrics, "Cannibalization diagnostics must be present.");
  return metrics as EditorialCannibalizationMetrics;
}

function runFixture(context: EditorialAuditContext) {
  return runEditorialAudit(context, [cannibalizationEditorialAuditModule]);
}

export function runEditorialCannibalizationSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const contextSnapshot = JSON.stringify(context);
  const mappingsSnapshot = JSON.stringify(context.mappings);
  const contentNodesSnapshot = JSON.stringify(context.contentNodes);
  const report = runFixture(context);
  const metrics = metricsFor(report);
  const highSignalPairs = metrics.pairs.filter((pair) => pair.signalCount >= highSignalThreshold);
  const distribution = metrics.signalCountDistribution;
  const signaledRate = metrics.analyzedPairs === 0 ? 0 : metrics.signaledPairs / metrics.analyzedPairs;
  const highSignalRate = metrics.analyzedPairs === 0 ? 0 : metrics.highSignalPairs / metrics.analyzedPairs;
  const signalTooBroad = signaledRate > 0.8;

  assert(metrics.analyzedArticles > 0, "At least one article must be analyzed.");
  assert(metrics.analyzedPairs >= metrics.highSignalPairs && metrics.signaledPairs >= metrics.highSignalPairs, "Pair counters must be coherent.");
  assert(report.issues.length === metrics.highSignalPairs && report.issues.every((issue) => issue.severity === "info"), "High-signal pairs must produce only info issues.");
  assert(report.clusters.length === 0, "Cannibalization is a global module and must not produce clusters.");
  assert(metrics.pairs.length === metrics.signaledPairs && distribution.zero + distribution.one + distribution.two + distribution.three === metrics.analyzedPairs, "Signaled-pair metrics must be coherent.");
  assert(metrics.pairs.every((pair) => pair.signalCount >= signaledPairThreshold), "Pairs must meet the signaled-pair threshold.");
  assert(highSignalPairs.length === metrics.highSignalPairs, "High-signal pairs must use the high-signal threshold.");

  const pairKeys = new Set(metrics.pairs.map((pair) => `${pair.leftNodeId}|${pair.rightNodeId}`));
  assert(pairKeys.size === metrics.pairs.length, "Pairs must not be duplicated.");
  metrics.pairs.forEach((pair) => {
    assert(pair.leftNodeId !== pair.rightNodeId, "A pair must contain two different articles.");
    assert(pair.sharedClusters.length > 0, "Each analyzed pair must share a canonical cluster.");
    assert(pair.signalCount >= signaledPairThreshold && pair.signalCount <= highSignalThreshold, "Signaled pairs must remain within the configured thresholds.");
    assert(pair.sharedOutgoingRatio >= 0 && pair.sharedOutgoingRatio <= 1, "Outgoing ratios must remain between zero and one.");
    assert(new Set(pair.sharedOutgoingTargets).size === pair.sharedOutgoingTargets.length, "Shared outgoing targets must be deterministic and deduplicated.");
    assert(!pairKeys.has(`${pair.rightNodeId}|${pair.leftNodeId}`), "A reverse pair must not be emitted separately.");
  });
  highSignalPairs.forEach((pair) => {
    assert(report.issues.some((issue) => issue.code === "cannibalization_signal_detected" && issue.nodeId === pair.leftNodeId), "Each high-signal pair must have an issue.");
  });

  const weakLeftId = "content:article:fixture-weak-left" as const;
  const weakRightId = "content:article:fixture-weak-right" as const;
  const weakReport = runFixture(fixtureContext(
    [article(weakLeftId), article(weakRightId)],
    [
      { type: "part_of_cluster", sourceId: weakLeftId, targetId: "topic:fixture-cluster" },
      { type: "part_of_cluster", sourceId: weakRightId, targetId: "topic:fixture-cluster" },
      { type: "is_about", sourceId: weakLeftId, targetId: "topic:fixture-primary-left" },
      { type: "is_about", sourceId: weakRightId, targetId: "topic:fixture-primary-right" },
    ]
  ));
  const weakMetrics = metricsFor(weakReport);
  assert(weakMetrics.analyzedPairs === 1 && weakMetrics.signalCountDistribution.zero === 1 && weakMetrics.signaledPairs === 0 && weakMetrics.pairs.length === 0 && weakMetrics.highSignalPairs === 0, "A pair sharing only one cluster must have zero signals and not be signaled.");
  assert(weakReport.issues.length === 0, "A zero-signal pair must not produce an issue.");

  const oneSignalLeftId = "content:article:fixture-one-signal-left" as const;
  const oneSignalRightId = "content:article:fixture-one-signal-right" as const;
  const oneSignalReport = runFixture(fixtureContext(
    [article(oneSignalLeftId), article(oneSignalRightId)],
    [
      { type: "part_of_cluster", sourceId: oneSignalLeftId, targetId: "topic:fixture-cluster" },
      { type: "part_of_cluster", sourceId: oneSignalRightId, targetId: "topic:fixture-cluster" },
      { type: "is_about", sourceId: oneSignalLeftId, targetId: "topic:fixture-primary-shared" },
      { type: "is_about", sourceId: oneSignalRightId, targetId: "topic:fixture-primary-shared" },
    ]
  ));
  const oneSignalMetrics = metricsFor(oneSignalReport);
  assert(oneSignalMetrics.signalCountDistribution.one === 1 && oneSignalMetrics.signaledPairs === 0 && oneSignalMetrics.pairs.length === 0, "A pair sharing only a primary topic must have one signal and not be signaled.");
  assert(oneSignalReport.issues.length === 0, "A one-signal pair must not produce an issue.");

  const intermediateLeftId = "content:article:fixture-intermediate-left" as const;
  const intermediateRightId = "content:article:fixture-intermediate-right" as const;
  const intermediateGuideId = "content:guide:fixture-intermediate-guide" as const;
  const intermediateReport = runFixture(fixtureContext(
    [article(intermediateLeftId), article(intermediateRightId), guide(intermediateGuideId)],
    [
      { type: "part_of_cluster", sourceId: intermediateLeftId, targetId: "topic:fixture-cluster" },
      { type: "part_of_cluster", sourceId: intermediateRightId, targetId: "topic:fixture-cluster" },
      { type: "is_about", sourceId: intermediateLeftId, targetId: "topic:fixture-primary-shared" },
      { type: "is_about", sourceId: intermediateRightId, targetId: "topic:fixture-primary-shared" },
      { type: "supports", sourceId: intermediateLeftId, targetId: intermediateGuideId },
      { type: "supports", sourceId: intermediateRightId, targetId: intermediateGuideId },
    ]
  ));
  const intermediateMetrics = metricsFor(intermediateReport);
  assert(intermediateMetrics.signalCountDistribution.two === 1 && intermediateMetrics.signaledPairs === 1 && intermediateMetrics.pairs.length === 1 && intermediateMetrics.pairs[0].signalCount === 2 && intermediateMetrics.highSignalPairs === 0, "A two-signal pair must be signaled without becoming high-signal.");
  assert(intermediateReport.issues.length === 0, "A two-signal pair must not produce an issue.");

  const highLeftId = "content:article:fixture-high-left" as const;
  const highRightId = "content:article:fixture-high-right" as const;
  const highGuideIds = [
    "content:guide:fixture-high-guide-one",
    "content:guide:fixture-high-guide-two",
    "content:guide:fixture-high-guide-three",
  ] as const;
  const highReport = runFixture(fixtureContext(
    [article(highLeftId), article(highRightId), ...highGuideIds.map(guide)],
    [
      { type: "part_of_cluster", sourceId: highLeftId, targetId: "topic:fixture-cluster" },
      { type: "part_of_cluster", sourceId: highRightId, targetId: "topic:fixture-cluster" },
      { type: "is_about", sourceId: highLeftId, targetId: "topic:fixture-primary-shared" },
      { type: "is_about", sourceId: highRightId, targetId: "topic:fixture-primary-shared" },
      ...highGuideIds.flatMap((targetId) => [
        { type: "supports" as const, sourceId: highLeftId, targetId },
        { type: "supports" as const, sourceId: highRightId, targetId },
      ]),
      { type: "related_to", sourceId: highLeftId, targetId: highRightId },
      { type: "related_to", sourceId: highRightId, targetId: highLeftId },
    ]
  ));
  const highMetrics = metricsFor(highReport);
  assert(highMetrics.signalCountDistribution.three === 1 && highMetrics.signaledPairs === 1 && highMetrics.pairs.length === 1 && highMetrics.pairs[0].signalCount === highSignalThreshold && highMetrics.highSignalPairs === 1, "The high-signal fixture must satisfy the high-signal threshold.");
  assert(highReport.issues.length === 1 && highReport.issues[0].severity === "info", "The high-signal fixture must produce one info issue.");

  assert(JSON.stringify(runFixture(context)) === JSON.stringify(report), "Cannibalization diagnostics must be deterministic.");
  assert(JSON.stringify(context) === contextSnapshot, "Cannibalization must not mutate context.");
  assert(JSON.stringify(context.mappings) === mappingsSnapshot, "Cannibalization must not mutate mappings.");
  assert(JSON.stringify(context.contentNodes) === contentNodesSnapshot, "Cannibalization must not mutate content nodes.");

  console.log("Editorial cannibalization smoke passed.");
  console.log(`Articles: ${metrics.analyzedArticles}`);
  console.log(`Pairs: ${metrics.analyzedPairs}`);
  console.log(`Signaled: ${metrics.signaledPairs}`);
  console.log(`High signal: ${metrics.highSignalPairs}`);
  console.log(`Signal count 0: ${distribution.zero}`);
  console.log(`Signal count 1: ${distribution.one}`);
  console.log(`Signal count 2: ${distribution.two}`);
  console.log(`Signal count 3: ${distribution.three}`);
  console.log(`High signal rate: ${(highSignalRate * 100).toFixed(2)}%`);
  console.log(`Signal too broad: ${signalTooBroad ? "yes" : "no"}`);
}
