import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import { coverageGovernanceEditorialAuditModule } from "./coverage-governance";
import type { EditorialCoverageGovernanceMetrics } from "./coverage-governance";
import type { EditorialAuditContext } from "./context";
import type { EditorialMapping } from "../mapping-registry";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function metricsFor(
  report: ReturnType<typeof runEditorialAudit>,
  topicId: `topic:${string}`
): EditorialCoverageGovernanceMetrics {
  const cluster = report.clusters.find((candidate) => candidate.topicId === topicId);
  assert(cluster && cluster.coverage, `${topicId} coverage metrics must be present.`);
  return cluster.coverage as EditorialCoverageGovernanceMetrics;
}

function clusterFor(report: ReturnType<typeof runEditorialAudit>, topicId: `topic:${string}`) {
  const cluster = report.clusters.find((candidate) => candidate.topicId === topicId);
  assert(cluster, `${topicId} audit cluster must be present.`);
  return cluster;
}

function hasIssue(
  report: ReturnType<typeof runEditorialAudit>,
  topicId: `topic:${string}`,
  code: string
): boolean {
  return clusterFor(report, topicId).issues.some((candidate) => candidate.code === code);
}

export function runEditorialCoverageGovernanceSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const contextSnapshot = JSON.stringify(context);
  const clusterDefinitionsSnapshot = JSON.stringify(context.clusterDefinitions);
  const mappingsSnapshot = JSON.stringify(context.mappings);
  const contentNodesSnapshot = JSON.stringify(context.contentNodes);
  const report = runEditorialAudit(context, [coverageGovernanceEditorialAuditModule]);
  const pricing = metricsFor(report, "topic:pricing");
  const revenue = metricsFor(report, "topic:revenue");
  const photos = metricsFor(report, "topic:photos");

  assert(
    pricing.governancePresent
    && pricing.governanceStatus === "active"
    && pricing.pillarDeclared
    && pricing.coverageAvailable
    && pricing.coverageStatus === "strong"
    && pricing.coveragePillarCount === 1
    && pricing.governanceCoverageAligned,
    "Pricing must remain active, strongly covered, and aligned."
  );
  assert(clusterFor(report, "topic:pricing").issues.length === 0, "Pricing must have no structural issues.");

  assert(
    revenue.governancePresent
    && revenue.governanceStatus === "active"
    && revenue.pillarDeclared
    && revenue.coverageAvailable
    && revenue.coverageStatus === "strong"
    && revenue.coveragePillarCount === 1
    && revenue.governanceCoverageAligned,
    "Revenue must remain active, strongly covered, and aligned."
  );
  assert(clusterFor(report, "topic:revenue").issues.length === 0, "Revenue must have no structural issues.");

  assert(
    photos.governancePresent
    && photos.governanceStatus === "overloaded"
    && photos.coveragePillarCount > 0
    && (photos.coverageStatus === "overloaded" || photos.coverageStatus === "partial")
    && photos.governanceCoverageAligned,
    "Photos must remain coherent with overloaded governance."
  );

  const activeBrokenTopicId = "topic:active-broken" as const;
  const activeBrokenContext: EditorialAuditContext = {
    ...context,
    clusterDefinitions: [
      ...context.clusterDefinitions,
      {
        topicId: activeBrokenTopicId,
        slug: "active-broken",
        label: "Active broken",
        status: "active",
        priority: "low",
        primaryPlatform: "platform:airbnb",
        scope: [activeBrokenTopicId],
        expectedCoverage: {
          requiresPillar: true,
          minSupportingContent: 0,
          expectedContentTypes: [],
          expectedPlatforms: [],
          expectedMetrics: [],
          optionalContentTypes: [],
        },
      },
    ],
  };
  const activeBrokenReport = runEditorialAudit(activeBrokenContext, [coverageGovernanceEditorialAuditModule]);
  const activeBroken = metricsFor(activeBrokenReport, activeBrokenTopicId);
  assert(!activeBroken.governanceCoverageAligned, "An active cluster without its required pillar must be unaligned.");
  assert(hasIssue(activeBrokenReport, activeBrokenTopicId, "expected_pillar_missing"), "A missing required pillar must produce an issue.");

  const mismatchTopicId = "topic:pillar-mismatch" as const;
  const actualPillarMapping = context.mappings.find(
    (mapping): mapping is EditorialMapping & { type: "pillar_for" } => mapping.type === "pillar_for"
  );
  assert(actualPillarMapping, "The real context must provide a pillar mapping for the mismatch fixture.");
  const mismatchContext: EditorialAuditContext = {
    ...context,
    editorialNodes: [
      ...context.editorialNodes,
      { id: mismatchTopicId, kind: "topic", label: "Pillar mismatch", status: "planned" },
    ],
    mappings: [...context.mappings, { ...actualPillarMapping, targetId: mismatchTopicId }],
    clusterDefinitions: [
      ...context.clusterDefinitions,
      {
        topicId: mismatchTopicId,
        slug: "pillar-mismatch",
        label: "Pillar mismatch",
        status: "active",
        priority: "low",
        pillarId: "content:guide:airbnb-revenue-optimization",
        primaryPlatform: "platform:airbnb",
        scope: [mismatchTopicId],
        expectedCoverage: {
          requiresPillar: true,
          minSupportingContent: 0,
          expectedContentTypes: [],
          expectedPlatforms: [],
          expectedMetrics: [],
          optionalContentTypes: [],
        },
      },
    ],
  };
  const mismatchReport = runEditorialAudit(mismatchContext, [coverageGovernanceEditorialAuditModule]);
  const mismatch = metricsFor(mismatchReport, mismatchTopicId);
  assert(!mismatch.governanceCoverageAligned, "A governance pillar different from the real pillar must be unaligned.");
  assert(hasIssue(mismatchReport, mismatchTopicId, "pillar_mismatch"), "A different governance pillar must produce a mismatch issue.");

  assert(JSON.stringify(runEditorialAudit(context, [coverageGovernanceEditorialAuditModule])) === JSON.stringify(report), "Coverage governance must be deterministic.");
  assert(JSON.stringify(context) === contextSnapshot, "Coverage governance must not mutate context.");
  assert(JSON.stringify(context.clusterDefinitions) === clusterDefinitionsSnapshot, "Coverage governance must not mutate cluster definitions.");
  assert(JSON.stringify(context.mappings) === mappingsSnapshot, "Coverage governance must not mutate mappings.");
  assert(JSON.stringify(context.contentNodes) === contentNodesSnapshot, "Coverage governance must not mutate content nodes.");
  assert(report.clusters.every((cluster) => cluster.readiness === undefined), "Coverage governance must not calculate readiness.");

  console.log("Editorial coverage governance smoke passed.");
  console.log(`Pricing: ${pricing.governanceStatus} / ${pricing.coverageStatus} / ${pricing.governanceCoverageAligned ? "aligned" : "unaligned"}`);
  console.log(`Revenue: ${revenue.governanceStatus} / ${revenue.coverageStatus} / ${revenue.governanceCoverageAligned ? "aligned" : "unaligned"}`);
  console.log(`Photos: ${photos.governanceStatus} / ${photos.coverageStatus} / ${photos.governanceCoverageAligned ? "aligned" : "unaligned"}`);
}
