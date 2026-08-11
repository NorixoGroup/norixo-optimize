import { articles, type Article } from "@/data/articles";
import { defaultLocale, isLocale } from "@/data/i18n";
import { guides, type Guide } from "@/data/guides";
import { marketReports, type MarketReport } from "@/data/marketReports";
import { rankings, type Ranking } from "@/data/rankings";
import { solutions, type Solution } from "@/data/solutions";
import { tools, type Tool } from "@/data/tools";
import { validateEditorialNodes } from "./relations";
import type {
  ContentNode,
  ContentNodeId,
  ContentRole,
  ContentSource,
  ContentType,
  EditorialValidationIssue,
  EditorialValidationResult,
  SearchIntent,
} from "./types";

type SourceContent = Pick<Article | Guide | Tool | Solution | Ranking | MarketReport, "slug" | "title">;

const supportedContentSources = new Set<ContentSource>([
  "data/articles",
  "data/guides",
  "data/tools",
  "data/solutions",
  "data/rankings",
  "data/marketReports",
]);

/**
 * Phase 1 only identified guide candidates. No pillar decision is encoded until
 * editorial governance explicitly approves individual guide roles.
 */
const explicitGuideRoles: Readonly<Partial<Record<string, ContentRole>>> = {};

function createContentNode(
  contentType: ContentType,
  item: SourceContent,
  basePath: string,
  source: ContentSource,
  intent: SearchIntent,
  role?: ContentRole
): ContentNode {
  return {
    id: `content:${contentType}:${item.slug}` as ContentNodeId,
    contentType,
    slug: item.slug,
    path: `${basePath}/${item.slug}`,
    title: item.title,
    source,
    locale: defaultLocale,
    intent,
    ...(role ? { role } : {}),
  };
}

export function adaptArticlesToContentNodes(source: readonly Article[] = articles): ContentNode[] {
  return source.map((article) =>
    createContentNode("article", article, "/articles", "data/articles", "informational")
  );
}

export function adaptGuidesToContentNodes(source: readonly Guide[] = guides): ContentNode[] {
  return source.map((guide) =>
    createContentNode(
      "guide",
      guide,
      "/guides",
      "data/guides",
      "informational",
      explicitGuideRoles[guide.slug]
    )
  );
}

export function adaptToolsToContentNodes(source: readonly Tool[] = tools): ContentNode[] {
  return source.map((tool) =>
    createContentNode("tool", tool, "/tools", "data/tools", "transactional", "tool")
  );
}

export function adaptSolutionsToContentNodes(source: readonly Solution[] = solutions): ContentNode[] {
  return source.map((solution) =>
    createContentNode("solution", solution, "/solutions", "data/solutions", "commercial", "solution")
  );
}

export function adaptRankingsToContentNodes(source: readonly Ranking[] = rankings): ContentNode[] {
  return source.map((ranking) =>
    createContentNode("ranking", ranking, "/rankings", "data/rankings", "informational")
  );
}

export function adaptReportsToContentNodes(source: readonly MarketReport[] = marketReports): ContentNode[] {
  return source.map((report) =>
    createContentNode("report", report, "/reports", "data/marketReports", "informational", "report")
  );
}

/** Returns the source-dataset order: articles, guides, tools, solutions, rankings, reports. */
export function buildEditorialContentNodes(): ContentNode[] {
  return [
    ...adaptArticlesToContentNodes(),
    ...adaptGuidesToContentNodes(),
    ...adaptToolsToContentNodes(),
    ...adaptSolutionsToContentNodes(),
    ...adaptRankingsToContentNodes(),
    ...adaptReportsToContentNodes(),
  ];
}

function issue(path: string, message: string): EditorialValidationIssue {
  return { path, message };
}

/** Adds adapter-specific checks while retaining the Phase 1A node validation contract. */
export function validateEditorialContentNodes(
  nodes: readonly ContentNode[]
): EditorialValidationResult {
  const issues = [...validateEditorialNodes(nodes).issues];

  nodes.forEach((node, index) => {
    if (!isLocale(node.locale)) {
      issues.push(issue(`nodes[${index}].locale`, "Content locale must be a configured locale."));
    }

    if (!supportedContentSources.has(node.source)) {
      issues.push(issue(`nodes[${index}].source`, "Content source must be a supported editorial dataset."));
    }
  });

  return { valid: issues.length === 0, issues };
}
