import { buildEditorialAuditContext } from "./context";
import { runEditorialAudit } from "./engine";
import { coverageGovernanceEditorialAuditModule } from "./coverage-governance";
import { inventoryEditorialAuditModule } from "./inventory";
import { readinessEditorialAuditModule } from "./readiness";
import { resolverMetricsEditorialAuditModule } from "./resolver-metrics";
import type { EditorialAuditContext } from "./context";
import type { EditorialAuditExecutionState } from "./engine";
import type { EditorialReadinessMetrics } from "./readiness";
import type { ContentType } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixtureTopicId = "topic:readiness-fixture" as const;

function fixtureContext(requiresPillar = false): EditorialAuditContext {
  return {
    contentNodes: [],
    editorialNodes: [{ id: fixtureTopicId, kind: "topic", label: "Readiness fixture", status: "planned" }],
    mappings: [],
    clusterDefinitions: [{
      topicId: fixtureTopicId,
      slug: "readiness-fixture",
      label: "Readiness fixture",
      status: "active",
      priority: "low",
      primaryPlatform: "platform:airbnb",
      scope: [fixtureTopicId],
      expectedCoverage: {
        requiresPillar,
        minSupportingContent: 0,
        expectedContentTypes: [],
        expectedPlatforms: [],
        expectedMetrics: [],
        optionalContentTypes: [],
      },
    }],
  };
}

function byType(): Record<ContentType, number> {
  return { article: 0, guide: 0, tool: 0, solution: 0, ranking: 0, report: 0, local: 0, landing: 0 };
}

function fixtureInventory(total: number) {
  return {
    id: "fixture_inventory",
    run: () => ({ clusters: [{ topicId: fixtureTopicId, inventory: { total, byType: byType() }, issues: [] }] }),
  };
}

function fixtureResolver(eligibleNodes: number, nodesWithLinks: number) {
  return {
    id: "fixture_resolver_metrics",
    run: () => ({ clusters: [{ topicId: fixtureTopicId, resolverMetrics: { eligibleNodes, nodesWithLinks }, issues: [] }] }),
  };
}

function fixtureCoverage(options: {
  governancePresent?: boolean;
  pillarDeclared?: boolean;
  coveragePillarCount?: number;
  governanceCoverageAligned?: boolean;
  governanceStatus?: string;
  coverageStatus?: string;
} = {}) {
  return {
    id: "fixture_coverage_governance",
    run: () => ({
      clusters: [{
        topicId: fixtureTopicId,
        coverage: {
          governancePresent: options.governancePresent ?? true,
          pillarDeclared: options.pillarDeclared ?? true,
          coveragePillarCount: options.coveragePillarCount ?? 1,
          governanceCoverageAligned: options.governanceCoverageAligned ?? true,
          governanceStatus: options.governanceStatus ?? "active",
          coverageStatus: options.coverageStatus ?? "strong",
        },
        issues: [],
      }],
    }),
  };
}

function readinessResult(report: ReturnType<typeof runEditorialAudit>, topicId: `topic:${string}`) {
  const cluster = report.clusters.find((candidate) => candidate.topicId === topicId && candidate.readiness !== undefined);
  assert(cluster, `${topicId} readiness result must be present.`);
  const metrics = (cluster as { readinessMetrics?: EditorialReadinessMetrics }).readinessMetrics;
  assert(metrics, `${topicId} readiness metrics must be present.`);
  return { cluster, metrics };
}

function coverageFor(report: ReturnType<typeof runEditorialAudit>, topicId: `topic:${string}`): Record<string, unknown> {
  const coverage = report.clusters.find((cluster) => cluster.topicId === topicId && cluster.coverage)?.coverage;
  assert(coverage && typeof coverage === "object", `${topicId} coverage and governance metrics must be present.`);
  return coverage as Record<string, unknown>;
}

function assertThrows(callback: () => void, message: string): void {
  let thrown: unknown;
  try { callback(); } catch (error) { thrown = error; }
  assert(thrown instanceof Error && thrown.message === message, `Expected error: ${message}`);
}

export function runEditorialReadinessSmokeTest(): void {
  const context = buildEditorialAuditContext();
  const contextSnapshot = JSON.stringify(context);
  const modules = [
    inventoryEditorialAuditModule,
    resolverMetricsEditorialAuditModule,
    coverageGovernanceEditorialAuditModule,
    readinessEditorialAuditModule,
  ];
  const report = runEditorialAudit(context, modules);
  const prerequisiteResultsSnapshot = JSON.stringify(report.clusters.filter((cluster) => cluster.readiness === undefined));
  const pricing = readinessResult(report, "topic:pricing");
  const revenue = readinessResult(report, "topic:revenue");
  const photos = readinessResult(report, "topic:photos");
  const seoRanking = readinessResult(report, "topic:seo-ranking");

  ["topic:pricing", "topic:revenue"].forEach((topicId) => {
    const result = readinessResult(report, topicId as `topic:${string}`);
    const prerequisites = report.clusters.filter((cluster) => cluster.topicId === topicId);
    const coverage = coverageFor(report, topicId as `topic:${string}`);
    assert(result.metrics.readiness === "ready" && JSON.stringify(result.metrics.reasons) === '["ready"]' && result.cluster.issues.length === 0 && coverage.governanceStatus === "active" && coverage.coverageStatus === "strong", `${topicId} must be active, strongly covered, and ready without readiness issues.`);
    assert(prerequisites.some((cluster) => cluster.inventory) && prerequisites.some((cluster) => cluster.resolverMetrics) && prerequisites.some((cluster) => cluster.coverage), `${topicId} must include all prerequisite results.`);
  });
  assert(photos.metrics.readiness === "overloaded" && JSON.stringify(photos.metrics.reasons) === '["cluster_overloaded"]' && photos.cluster.issues.length === 1 && photos.cluster.issues[0].code === "readiness_overloaded" && photos.cluster.issues[0].severity === "warning", "Photos must remain overloaded.");
  assert(coverageFor(report, "topic:photos").coverageStatus === "partial", "Photos must retain its partial coverage without bypassing overloaded readiness.");
  assert(seoRanking.metrics.readiness === "needs_governance" && JSON.stringify(seoRanking.metrics.reasons) === '["governance_not_active"]' && seoRanking.cluster.issues[0]?.code === "readiness_needs_governance" && seoRanking.cluster.issues[0]?.severity === "warning", "SEO / Ranking must require active governance before readiness.");
  assert(coverageFor(report, "topic:seo-ranking").governanceStatus === "planned" && coverageFor(report, "topic:seo-ranking").coverageStatus === "partial", "SEO / Ranking must expose planned governance and partial coverage.");

  const missing = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(0), fixtureResolver(0, 0), fixtureCoverage(), readinessEditorialAuditModule]), fixtureTopicId);
  assert(missing.metrics.readiness === "missing" && JSON.stringify(missing.metrics.reasons) === '["inventory_missing"]' && missing.cluster.issues[0]?.code === "readiness_missing", "Zero inventory must take missing priority.");

  const needsGovernance = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(1, 1), fixtureCoverage({ governancePresent: false }), readinessEditorialAuditModule]), fixtureTopicId);
  assert(needsGovernance.metrics.readiness === "needs_governance" && JSON.stringify(needsGovernance.metrics.reasons) === '["governance_missing"]' && needsGovernance.cluster.issues[0]?.code === "readiness_needs_governance", "Missing governance must require governance.");

  const governancePlanned = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(5, 4), fixtureCoverage({ governanceStatus: "planned" }), readinessEditorialAuditModule]), fixtureTopicId);
  assert(governancePlanned.metrics.readiness === "needs_governance" && JSON.stringify(governancePlanned.metrics.reasons) === '["governance_not_active"]', "Planned governance must never become ready.");

  const pillarMissing = readinessResult(runEditorialAudit(fixtureContext(true), [fixtureInventory(1), fixtureResolver(1, 1), fixtureCoverage({ pillarDeclared: false, coveragePillarCount: 0 }), readinessEditorialAuditModule]), fixtureTopicId);
  assert(pillarMissing.metrics.readiness === "needs_governance" && JSON.stringify(pillarMissing.metrics.reasons) === '["pillar_missing"]', "A required absent pillar must require governance.");

  const needsRelations = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(5, 3), fixtureCoverage(), readinessEditorialAuditModule]), fixtureTopicId);
  assert(needsRelations.metrics.readiness === "needs_relations" && JSON.stringify(needsRelations.metrics.reasons) === '["relations_coverage_low"]' && needsRelations.cluster.issues[0]?.code === "readiness_needs_relations" && needsRelations.cluster.issues[0]?.severity === "info", "Low relation coverage must require relations.");

  const coveragePartial = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(5, 4), fixtureCoverage({ coverageStatus: "partial" }), readinessEditorialAuditModule]), fixtureTopicId);
  assert(coveragePartial.metrics.readiness === "needs_relations" && JSON.stringify(coveragePartial.metrics.reasons) === '["coverage_not_strong"]' && coveragePartial.cluster.issues[0]?.code === "readiness_needs_relations", "Partial coverage with active governance must require relations.");

  const ready = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(5, 4), fixtureCoverage(), readinessEditorialAuditModule]), fixtureTopicId);
  assert(ready.metrics.readiness === "ready" && JSON.stringify(ready.metrics.reasons) === '["ready"]' && ready.cluster.issues.length === 0, "Active, strong, aligned coverage with sufficient relations must be ready.");

  const plannedPartial = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(5, 4), fixtureCoverage({ governanceStatus: "planned", coverageStatus: "partial" }), readinessEditorialAuditModule]), fixtureTopicId);
  assert(plannedPartial.metrics.readiness === "needs_governance" && JSON.stringify(plannedPartial.metrics.reasons) === '["governance_not_active"]', "Planned governance must take priority over partial coverage.");

  const noEligibleLinks = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(0, 0), fixtureCoverage(), readinessEditorialAuditModule]), fixtureTopicId);
  assert(noEligibleLinks.metrics.readiness === "needs_relations" && JSON.stringify(noEligibleLinks.metrics.reasons) === '["no_eligible_link_nodes"]', "No eligible link nodes must require relations.");

  const priority = readinessResult(runEditorialAudit(fixtureContext(), [fixtureInventory(0), fixtureResolver(0, 0), fixtureCoverage({ governancePresent: false }), readinessEditorialAuditModule]), fixtureTopicId);
  assert(priority.metrics.readiness === "missing", "Missing inventory must take priority over governance and relations.");

  assertThrows(() => runEditorialAudit(fixtureContext(), [readinessEditorialAuditModule]), "Missing prerequisite audit result: inventory");
  assertThrows(() => runEditorialAudit(fixtureContext(), [fixtureInventory(1), readinessEditorialAuditModule]), "Missing prerequisite audit result: resolver_metrics");
  assertThrows(() => runEditorialAudit(fixtureContext(), [fixtureInventory(1), fixtureResolver(1, 1), readinessEditorialAuditModule]), "Missing prerequisite audit result: coverage_governance");

  const diagnosticsReport = runEditorialAudit(context, [
    inventoryEditorialAuditModule,
    resolverMetricsEditorialAuditModule,
    coverageGovernanceEditorialAuditModule,
    { id: "global-diagnostics", run: () => ({ diagnostics: { orphans_duplicates: { orphanCount: 48 }, cannibalization: { highSignalPairs: 0 } } }) },
    readinessEditorialAuditModule,
  ]);
  assert(JSON.stringify(readinessResult(diagnosticsReport, "topic:pricing").metrics) === JSON.stringify(pricing.metrics) && JSON.stringify(readinessResult(diagnosticsReport, "topic:photos").metrics) === JSON.stringify(photos.metrics), "Global orphan and cannibalization diagnostics must not affect readiness.");

  let capturedState: EditorialAuditExecutionState | undefined;
  let capturedStateSnapshot = "";
  const immutableReport = runEditorialAudit(context, [
    inventoryEditorialAuditModule,
    resolverMetricsEditorialAuditModule,
    coverageGovernanceEditorialAuditModule,
    {
      id: "state-snapshot",
      run: (_context, state) => {
        assert(state, "The engine must provide execution state.");
        capturedState = state;
        capturedStateSnapshot = JSON.stringify(state);
        return {};
      },
    },
    readinessEditorialAuditModule,
  ]);
  assert(capturedState && capturedStateSnapshot === JSON.stringify(capturedState) && prerequisiteResultsSnapshot === JSON.stringify(immutableReport.clusters.filter((cluster) => cluster.readiness === undefined)) && JSON.stringify(context) === contextSnapshot, "Readiness must not mutate context, execution state, or prerequisite results.");
  assert(JSON.stringify(runEditorialAudit(context, modules)) === JSON.stringify(report), "Readiness pipeline must be deterministic.");

  console.log("Editorial readiness smoke passed.");
  console.log(`Pricing: ${pricing.metrics.readiness}`);
  console.log(`Revenue: ${revenue.metrics.readiness}`);
  console.log(`Photos: ${photos.metrics.readiness}`);
  console.log(`SEO / Ranking: ${seoRanking.metrics.readiness}`);
}
