import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import { analyzeClusterCoverage } from "./coverage-analyzer";
import { buildEditorialContentNodes } from "./content-adapter";
import { canonicalEditorialNodes } from "./taxonomy";
import { getClusterMappings, getEditorialMappings } from "./mapping-registry";
import type { ClusterCoverageInput } from "./coverage-types";
import type { ContentNode } from "./types";
import type { EditorialMapping } from "./mapping-registry";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pricingInput(): ClusterCoverageInput {
  return {
    topicId: "topic:pricing",
    contentNodes: buildEditorialContentNodes(),
    mappings: getEditorialMappings(),
    editorialNodes: canonicalEditorialNodes,
  };
}

function syntheticContentNodes(count: number): ContentNode[] {
  return [
    {
      id: "content:guide:pricing-pillar",
      contentType: "guide",
      slug: "pricing-pillar",
      path: "/guides/pricing-pillar",
      title: "Pricing Pillar",
      source: "data/guides",
      locale: "en",
    },
    ...Array.from({ length: count }, (_, index) => ({
      id: `content:article:pricing-support-${index}` as const,
      contentType: "article" as const,
      slug: `pricing-support-${index}`,
      path: `/articles/pricing-support-${index}`,
      title: `Pricing Support ${index}`,
      source: "data/articles" as const,
      locale: "en",
    })),
  ];
}

function overloadedFixture(): ClusterCoverageInput {
  const contentNodes = syntheticContentNodes(25);
  const pillarId = "content:guide:pricing-pillar" as const;
  const topicId = "topic:pricing" as const;
  const mappings: EditorialMapping[] = [
    { type: "pillar_for", sourceId: pillarId, targetId: topicId },
    { type: "part_of_cluster", sourceId: pillarId, targetId: topicId },
    ...contentNodes.slice(1).flatMap((node) => [
      { type: "part_of_cluster" as const, sourceId: node.id, targetId: topicId },
      { type: "supports" as const, sourceId: node.id, targetId: pillarId },
    ]),
  ];

  return { topicId, contentNodes, mappings, editorialNodes: canonicalEditorialNodes };
}

export function runCoverageAnalyzerSmokeTest(): void {
  const datasetsSnapshot = JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]);
  const contentNodes = buildEditorialContentNodes();
  const contentNodesSnapshot = JSON.stringify(contentNodes);
  const mappings = getEditorialMappings();
  const mappingsSnapshot = JSON.stringify(mappings);
  const report = analyzeClusterCoverage(pricingInput());

  assert(report.topicId === "topic:pricing", "Pricing must be analyzed.");
  assert(report.pillarCount === 1, "Pricing must have one pillar.");
  assert(report.supportingContentCount === 13, "Pricing supports must match the canonical mappings.");
  assert(
    report.countsByContentType.article === 10 &&
      report.countsByContentType.guide === 1 &&
      report.countsByContentType.tool === 6 &&
      report.countsByContentType.solution === 1 &&
      report.countsByContentType.ranking === 0 &&
      report.countsByContentType.report === 0,
    "Pricing content family counts are incorrect."
  );
  assert(JSON.stringify(report.platforms) === JSON.stringify(["platform:airbnb"]), "Pricing platform coverage is incorrect.");
  assert(report.metrics.length === 5, "Pricing must reuse five KPI metrics.");
  assert(
    JSON.stringify(report.commercialPaths) ===
      JSON.stringify(["content:solution:airbnb-pricing-optimization"]),
    "Pricing commercial paths are incorrect."
  );
  assert(
    JSON.stringify(report.gaps.map((gap) => gap.code)) === JSON.stringify(["no_report"]),
    "Pricing gaps must be deterministic and structural."
  );
  assert(report.status === "strong", "Pricing status must be derived as strong.");
  assert(getClusterMappings("topic:pricing").length > 0, "Existing cluster query helper must resolve Pricing.");

  const missing = analyzeClusterCoverage({
    topicId: "topic:pricing",
    contentNodes: [],
    mappings: [],
    editorialNodes: canonicalEditorialNodes,
  });
  assert(missing.status === "missing", "An unmapped cluster must be missing.");

  const noPillarContent: ContentNode = {
    id: "content:article:pricing-without-pillar",
    contentType: "article",
    slug: "pricing-without-pillar",
    path: "/articles/pricing-without-pillar",
    title: "Pricing Without Pillar",
    source: "data/articles",
    locale: "en",
  };
  const noPillar = analyzeClusterCoverage({
    topicId: "topic:pricing",
    contentNodes: [noPillarContent],
    mappings: [
      { type: "part_of_cluster", sourceId: noPillarContent.id, targetId: "topic:pricing" },
    ],
    editorialNodes: canonicalEditorialNodes,
  });
  assert(noPillar.status === "broken", "A mapped cluster without a pillar must be broken.");

  assert(overloadedFixture().contentNodes.length > 0, "Overloaded fixture must be populated.");
  assert(
    analyzeClusterCoverage(overloadedFixture()).status === "overloaded",
    "A cluster above the explicit support threshold must be overloaded."
  );

  assert(JSON.stringify(buildEditorialContentNodes()) === contentNodesSnapshot, "Analyzer must not mutate ContentNodes.");
  assert(JSON.stringify(getEditorialMappings()) === mappingsSnapshot, "Analyzer must not mutate mappings.");
  assert(
    JSON.stringify([articles, guides, tools, solutions, rankings, marketReports]) === datasetsSnapshot,
    "Analyzer must not mutate datasets."
  );

  console.log("Editorial Pricing coverage analyzer smoke passed.", report);
}
