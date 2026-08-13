import type { MarketReport } from "@/data/marketReports";
import type { Ranking } from "@/data/rankings";
import type { ContentNode, ContentNodeId } from "../types";
import {
  auditProgrammaticMarketDescriptors,
  type ProgrammaticMarketAuditInput,
  type ProgrammaticMarketAuditIssueCode,
} from "./market-audit";

export interface ProgrammaticMarketGovernanceEntry {
  readonly contentNodeId: ContentNodeId;
  readonly governed: boolean;
  readonly reasons: readonly ProgrammaticMarketAuditIssueCode[];
}

export interface ProgrammaticMarketGovernanceSummary {
  readonly total: number;
  readonly governed: number;
  readonly notGoverned: number;
}

export interface ProgrammaticMarketGovernanceResult {
  readonly entries: readonly ProgrammaticMarketGovernanceEntry[];
  readonly summary: ProgrammaticMarketGovernanceSummary;
}

function contentNodeIdFor(contentType: "ranking" | "report", slug: string): ContentNodeId {
  return `content:${contentType}:${slug}`;
}

function isProgrammaticMarketContentType(contentType: string): contentType is "ranking" | "report" {
  return contentType === "ranking" || contentType === "report";
}

function contentNodeBySourceSlug(
  contentNodes: readonly ContentNode[],
  contentType: "ranking" | "report",
  slug: string
): ContentNodeId {
  const contentNode = contentNodes.find((node) => node.contentType === contentType && node.slug === slug);

  return contentNode?.id ?? contentNodeIdFor(contentType, slug);
}

function expectedLeafIds(
  contentNodes: readonly ContentNode[],
  rankings: readonly Pick<Ranking, "slug">[],
  reports: readonly Pick<MarketReport, "slug">[]
): ContentNodeId[] {
  return [
    ...rankings.map((ranking) => contentNodeBySourceSlug(contentNodes, "ranking", ranking.slug)),
    ...reports.map((report) => contentNodeBySourceSlug(contentNodes, "report", report.slug)),
  ];
}

export function evaluateProgrammaticMarketGovernance(
  input: ProgrammaticMarketAuditInput
): ProgrammaticMarketGovernanceResult {
  const audit = auditProgrammaticMarketDescriptors(input);
  const issueCodesByContentNodeId = new Map<ContentNodeId, Set<ProgrammaticMarketAuditIssueCode>>();

  audit.issues.forEach((issue) => {
    if (!issue.contentNodeId) {
      return;
    }

    const issueCodes = issueCodesByContentNodeId.get(issue.contentNodeId) ?? new Set<ProgrammaticMarketAuditIssueCode>();
    issueCodes.add(issue.code);
    issueCodesByContentNodeId.set(issue.contentNodeId, issueCodes);
  });

  audit.issues.forEach((issue) => {
    if (
      issue.contentNodeId ||
      issue.code !== "missing_content_node" ||
      !issue.contentType ||
      !isProgrammaticMarketContentType(issue.contentType) ||
      !issue.slug
    ) {
      return;
    }

    const expectedId = contentNodeIdFor(issue.contentType, issue.slug);
    const issueCodes = issueCodesByContentNodeId.get(expectedId) ?? new Set<ProgrammaticMarketAuditIssueCode>();
    issueCodes.add(issue.code);
    issueCodesByContentNodeId.set(expectedId, issueCodes);
  });

  const entries = expectedLeafIds(input.contentNodes, input.rankings, input.reports).map((contentNodeId) => {
    const reasons = [...(issueCodesByContentNodeId.get(contentNodeId) ?? [])];

    return {
      contentNodeId,
      governed: reasons.length === 0,
      reasons,
    };
  });

  const governed = entries.filter((entry) => entry.governed).length;

  return {
    entries,
    summary: {
      total: entries.length,
      governed,
      notGoverned: entries.length - governed,
    },
  };
}
