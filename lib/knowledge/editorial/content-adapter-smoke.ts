import { articles } from "@/data/articles";
import { guides } from "@/data/guides";
import { marketReports } from "@/data/marketReports";
import { rankings } from "@/data/rankings";
import { solutions } from "@/data/solutions";
import { tools } from "@/data/tools";
import {
  adaptArticlesToContentNodes,
  adaptGuidesToContentNodes,
  adaptRankingsToContentNodes,
  adaptReportsToContentNodes,
  adaptSolutionsToContentNodes,
  adaptToolsToContentNodes,
  buildEditorialContentNodes,
  validateEditorialContentNodes,
} from "./content-adapter";

export interface ContentAdapterSmokeCounts {
  articles: number;
  guides: number;
  tools: number;
  solutions: number;
  rankings: number;
  reports: number;
  total: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFamily(
  expectedCount: number,
  nodes: { id: string; path: string }[],
  type: string,
  pathPrefix: string
): void {
  assert(nodes.length === expectedCount, `${type} adapter count does not match its source dataset.`);
  assert(
    nodes.every((node) => node.id.startsWith(`content:${type}:`)),
    `${type} adapter produced an invalid ID namespace.`
  );
  assert(
    nodes.every((node) => node.path.startsWith(`${pathPrefix}/`)),
    `${type} adapter produced an invalid path.`
  );
}

export function runContentAdapterSmokeTest(): ContentAdapterSmokeCounts {
  const sourceSnapshots = [articles, guides, tools, solutions, rankings, marketReports].map((source) =>
    JSON.stringify(source)
  );
  const articleNodes = adaptArticlesToContentNodes();
  const guideNodes = adaptGuidesToContentNodes();
  const toolNodes = adaptToolsToContentNodes();
  const solutionNodes = adaptSolutionsToContentNodes();
  const rankingNodes = adaptRankingsToContentNodes();
  const reportNodes = adaptReportsToContentNodes();
  const nodes = buildEditorialContentNodes();

  assertFamily(articles.length, articleNodes, "article", "/articles");
  assertFamily(guides.length, guideNodes, "guide", "/guides");
  assertFamily(tools.length, toolNodes, "tool", "/tools");
  assertFamily(solutions.length, solutionNodes, "solution", "/solutions");
  assertFamily(rankings.length, rankingNodes, "ranking", "/rankings");
  assertFamily(marketReports.length, reportNodes, "report", "/reports");

  assert(
    validateEditorialContentNodes(nodes).valid,
    "Adapted content nodes must satisfy the editorial validation contract."
  );
  assert(new Set(nodes.map((node) => node.id)).size === nodes.length, "Adapted node IDs must be unique.");

  const repeatedNodes = buildEditorialContentNodes();
  assert(
    JSON.stringify(nodes) === JSON.stringify(repeatedNodes),
    "Content adapter output must be deterministic."
  );

  const sourceSnapshotsAfter = [articles, guides, tools, solutions, rankings, marketReports].map(
    (source) => JSON.stringify(source)
  );
  assert(
    JSON.stringify(sourceSnapshots) === JSON.stringify(sourceSnapshotsAfter),
    "Content adapter must not mutate source datasets."
  );

  const counts: ContentAdapterSmokeCounts = {
    articles: articleNodes.length,
    guides: guideNodes.length,
    tools: toolNodes.length,
    solutions: solutionNodes.length,
    rankings: rankingNodes.length,
    reports: reportNodes.length,
    total: nodes.length,
  };

  console.log("Editorial content adapter smoke passed.", counts);
  return counts;
}
