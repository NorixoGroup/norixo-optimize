import type { City } from "@/data/cities";
import type { Country } from "@/data/countries";
import type { MarketReport } from "@/data/marketReports";
import type { Ranking } from "@/data/rankings";
import type { ContentNode, ContentNodeId, ContentType } from "../types";

export type ProgrammaticMarketAuditStatus = "pass" | "fail";

export type ProgrammaticMarketAuditIssueCode =
  | "missing_content_node"
  | "content_type_mismatch"
  | "invalid_family"
  | "duplicate_descriptor"
  | "missing_descriptor"
  | "unexpected_descriptor"
  | "editorial_hub_included"
  | "missing_entity_ref"
  | "invalid_entity_kind"
  | "entity_ref_mismatch"
  | "missing_geo_entity"
  | "missing_ranking_scope"
  | "invalid_ranking_scope"
  | "ranking_scope_mismatch"
  | "missing_scope_entity"
  | "missing_target_entities"
  | "missing_target_entity"
  | "invalid_target_entity_kind"
  | "target_entity_mismatch"
  | "duplicate_target_entity";

export interface ProgrammaticMarketAuditDescriptorInput {
  contentNodeId: ContentNodeId;
  contentType: ContentType;
  family: string;
  scope?: {
    readonly kind: string;
    readonly slug?: string;
    readonly entityRef?: {
      readonly kind: string;
      readonly slug: string;
    };
  };
  targetEntities?: readonly {
    readonly kind: string;
    readonly slug: string;
  }[];
  entityRef?: {
    readonly kind: string;
    readonly slug: string;
  };
}

export interface ProgrammaticMarketAuditIssue {
  code: ProgrammaticMarketAuditIssueCode;
  contentNodeId?: ContentNodeId;
  contentType?: ContentType;
  slug?: string;
  message: string;
}

export interface ProgrammaticMarketAuditSummary {
  totalDescriptors: number;
  rankingDescriptors: number;
  reportDescriptors: number;
  expectedDescriptors: number;
}

export interface ProgrammaticMarketAuditResult {
  status: ProgrammaticMarketAuditStatus;
  summary: ProgrammaticMarketAuditSummary;
  issues: ProgrammaticMarketAuditIssue[];
}

export interface ProgrammaticMarketAuditInput {
  descriptors: readonly ProgrammaticMarketAuditDescriptorInput[];
  contentNodes: readonly ContentNode[];
  rankings: readonly Pick<Ranking, "slug" | "scope" | "items">[];
  reports: readonly Pick<MarketReport, "slug" | "citySlug">[];
  cities: readonly Pick<City, "slug">[];
  countries: readonly Pick<Country, "slug">[];
}

const marketIntelligenceFamily = "market_intelligence";
const marketIntelligenceHubId = "content:guide:airbnb-market-intelligence";

function expectedContentNodeIds(
  contentNodeByTypeSlug: ReadonlyMap<string, ContentNode>,
  contentType: Extract<ContentType, "ranking" | "report">,
  sourceItems: readonly { slug: string }[]
): { ids: ContentNodeId[]; issues: ProgrammaticMarketAuditIssue[] } {
  const issues: ProgrammaticMarketAuditIssue[] = [];
  const ids = sourceItems.flatMap((item) => {
    const contentNode = contentNodeByTypeSlug.get(`${contentType}:${item.slug}`);

    if (!contentNode) {
      issues.push({
        code: "missing_content_node",
        contentType,
        slug: item.slug,
        message: `Expected ${contentType} ContentNode is missing for slug: ${item.slug}.`,
      });
      return [];
    }

    return [contentNode.id];
  });

  return { ids, issues };
}

function compareIssues(
  left: ProgrammaticMarketAuditIssue,
  right: ProgrammaticMarketAuditIssue
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.contentNodeId ?? "").localeCompare(right.contentNodeId ?? "") ||
    (left.contentType ?? "").localeCompare(right.contentType ?? "") ||
    (left.slug ?? "").localeCompare(right.slug ?? "")
  );
}

function expectedTargetEntityFor(
  rankingSlug: string,
  itemIndex: number,
  item: Pick<Ranking["items"][number], "citySlug" | "countrySlug">
): { kind: "city" | "country"; slug: string } | ProgrammaticMarketAuditIssue {
  if (item.citySlug && item.countrySlug) {
    return {
      code: "target_entity_mismatch",
      slug: item.citySlug,
      message: `Programmatic Market ranking item has ambiguous target entity: ${rankingSlug} item ${itemIndex}.`,
    };
  }

  if (item.citySlug) {
    return { kind: "city", slug: item.citySlug };
  }

  if (item.countrySlug) {
    return { kind: "country", slug: item.countrySlug };
  }

  return {
    code: "missing_target_entity",
    message: `Programmatic Market ranking item is missing a target entity: ${rankingSlug} item ${itemIndex}.`,
  };
}

export function auditProgrammaticMarketDescriptors(
  input: ProgrammaticMarketAuditInput
): ProgrammaticMarketAuditResult {
  const contentNodeById = new Map(input.contentNodes.map((node) => [node.id, node]));
  const contentNodeByTypeSlug = new Map(
    input.contentNodes.map((node) => [`${node.contentType}:${node.slug}`, node])
  );
  const citySlugs = new Set(input.cities.map((city) => city.slug));
  const countrySlugs = new Set(input.countries.map((country) => country.slug));
  const expectedRanking = expectedContentNodeIds(contentNodeByTypeSlug, "ranking", input.rankings);
  const expectedReport = expectedContentNodeIds(contentNodeByTypeSlug, "report", input.reports);
  const expectedIds = new Set([...expectedRanking.ids, ...expectedReport.ids]);
  const rankingByContentNodeId = new Map(
    input.rankings.flatMap((ranking) => {
      const contentNode = contentNodeByTypeSlug.get(`ranking:${ranking.slug}`);

      return contentNode ? [[contentNode.id, ranking] as const] : [];
    })
  );
  const reportByContentNodeId = new Map(
    input.reports.flatMap((report) => {
      const contentNode = contentNodeByTypeSlug.get(`report:${report.slug}`);

      return contentNode ? [[contentNode.id, report] as const] : [];
    })
  );
  const descriptorIds = new Set<ContentNodeId>();
  const issues: ProgrammaticMarketAuditIssue[] = [...expectedRanking.issues, ...expectedReport.issues];

  input.descriptors.forEach((descriptor) => {
    if (descriptorIds.has(descriptor.contentNodeId)) {
      issues.push({
        code: "duplicate_descriptor",
        contentNodeId: descriptor.contentNodeId,
        message: `Duplicate Programmatic Market descriptor: ${descriptor.contentNodeId}.`,
      });
    }
    descriptorIds.add(descriptor.contentNodeId);

    if (descriptor.contentNodeId === marketIntelligenceHubId) {
      issues.push({
        code: "editorial_hub_included",
        contentNodeId: descriptor.contentNodeId,
        message: "The Market Intelligence editorial hub must not be a programmatic leaf.",
      });
    }

    if (descriptor.family !== marketIntelligenceFamily) {
      issues.push({
        code: "invalid_family",
        contentNodeId: descriptor.contentNodeId,
        message: `Invalid Programmatic Market family for descriptor: ${descriptor.contentNodeId}.`,
      });
    }

    const contentNode = contentNodeById.get(descriptor.contentNodeId);
    if (!contentNode) {
      issues.push({
        code: "missing_content_node",
        contentNodeId: descriptor.contentNodeId,
        message: `Programmatic Market descriptor references a missing ContentNode: ${descriptor.contentNodeId}.`,
      });
      return;
    }

    if (contentNode.contentType !== descriptor.contentType) {
      issues.push({
        code: "content_type_mismatch",
        contentNodeId: descriptor.contentNodeId,
        contentType: descriptor.contentType,
        message: `Programmatic Market descriptor content type does not match its ContentNode: ${descriptor.contentNodeId}.`,
      });
    }

    if (!expectedIds.has(descriptor.contentNodeId)) {
      issues.push({
        code: "unexpected_descriptor",
        contentNodeId: descriptor.contentNodeId,
        message: `Unexpected Programmatic Market descriptor: ${descriptor.contentNodeId}.`,
      });
    }

    if (descriptor.contentType === "report") {
      const expectedReportSource = reportByContentNodeId.get(descriptor.contentNodeId);

      if (!descriptor.entityRef) {
        issues.push({
          code: "missing_entity_ref",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market report descriptor is missing an entityRef: ${descriptor.contentNodeId}.`,
        });
        return;
      }

      if (descriptor.entityRef.kind !== "city") {
        issues.push({
          code: "invalid_entity_kind",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market report descriptor entityRef must be a city: ${descriptor.contentNodeId}.`,
        });
      }

      if (!citySlugs.has(descriptor.entityRef.slug)) {
        issues.push({
          code: "missing_geo_entity",
          contentNodeId: descriptor.contentNodeId,
          slug: descriptor.entityRef.slug,
          message: `Programmatic Market report descriptor references a missing city: ${descriptor.entityRef.slug}.`,
        });
      }

      if (expectedReportSource && descriptor.entityRef.slug !== expectedReportSource.citySlug) {
        issues.push({
          code: "entity_ref_mismatch",
          contentNodeId: descriptor.contentNodeId,
          slug: descriptor.entityRef.slug,
          message: `Programmatic Market report descriptor entityRef does not match report.citySlug: ${descriptor.contentNodeId}.`,
        });
      }
    }

    if (descriptor.contentType === "ranking") {
      const expectedRankingSource = rankingByContentNodeId.get(descriptor.contentNodeId);

      if (!descriptor.scope) {
        issues.push({
          code: "missing_ranking_scope",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market ranking descriptor is missing a scope: ${descriptor.contentNodeId}.`,
        });
        return;
      }

      if (!expectedRankingSource) {
        return;
      }

      if (descriptor.scope.kind !== expectedRankingSource.scope.kind) {
        issues.push({
          code: "ranking_scope_mismatch",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market ranking descriptor scope kind does not match ranking.scope: ${descriptor.contentNodeId}.`,
        });
        return;
      }

      if (descriptor.scope.kind === "global") {
        if (descriptor.scope.entityRef || descriptor.scope.slug) {
          issues.push({
            code: "invalid_ranking_scope",
            contentNodeId: descriptor.contentNodeId,
            message: `Programmatic Market global ranking scope must not include extra identity fields: ${descriptor.contentNodeId}.`,
          });
        }
      } else if (descriptor.scope.kind === "country" && expectedRankingSource.scope.kind === "country") {
        if (!descriptor.scope.entityRef) {
          issues.push({
            code: "invalid_ranking_scope",
            contentNodeId: descriptor.contentNodeId,
            message: `Programmatic Market country ranking scope is missing an entityRef: ${descriptor.contentNodeId}.`,
          });
        } else {
          if (descriptor.scope.entityRef.kind !== "country") {
            issues.push({
              code: "invalid_ranking_scope",
              contentNodeId: descriptor.contentNodeId,
              message: `Programmatic Market country ranking scope entityRef must be a country: ${descriptor.contentNodeId}.`,
            });
          }

          if (!countrySlugs.has(descriptor.scope.entityRef.slug)) {
            issues.push({
              code: "missing_scope_entity",
              contentNodeId: descriptor.contentNodeId,
              slug: descriptor.scope.entityRef.slug,
              message: `Programmatic Market country ranking scope references a missing country: ${descriptor.scope.entityRef.slug}.`,
            });
          }

          if (descriptor.scope.entityRef.slug !== expectedRankingSource.scope.countrySlug) {
            issues.push({
              code: "ranking_scope_mismatch",
              contentNodeId: descriptor.contentNodeId,
              slug: descriptor.scope.entityRef.slug,
              message: `Programmatic Market country ranking scope does not match ranking.scope.countrySlug: ${descriptor.contentNodeId}.`,
            });
          }
        }
      } else if (descriptor.scope.kind === "region" && expectedRankingSource.scope.kind === "region") {
        if (!descriptor.scope.slug) {
          issues.push({
            code: "invalid_ranking_scope",
            contentNodeId: descriptor.contentNodeId,
            message: `Programmatic Market region ranking scope must include a non-empty slug: ${descriptor.contentNodeId}.`,
          });
        } else if (descriptor.scope.slug !== expectedRankingSource.scope.slug) {
          issues.push({
            code: "ranking_scope_mismatch",
            contentNodeId: descriptor.contentNodeId,
            slug: descriptor.scope.slug,
            message: `Programmatic Market region ranking scope does not match ranking.scope.slug: ${descriptor.contentNodeId}.`,
          });
        }
      } else if (descriptor.scope.kind === "audience" && expectedRankingSource.scope.kind === "audience") {
        if (!descriptor.scope.slug) {
          issues.push({
            code: "invalid_ranking_scope",
            contentNodeId: descriptor.contentNodeId,
            message: `Programmatic Market audience ranking scope must include a non-empty slug: ${descriptor.contentNodeId}.`,
          });
        } else if (descriptor.scope.slug !== expectedRankingSource.scope.slug) {
          issues.push({
            code: "ranking_scope_mismatch",
            contentNodeId: descriptor.contentNodeId,
            slug: descriptor.scope.slug,
            message: `Programmatic Market audience ranking scope does not match ranking.scope.slug: ${descriptor.contentNodeId}.`,
          });
        }
      } else {
        issues.push({
          code: "invalid_ranking_scope",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market ranking scope kind is invalid: ${descriptor.contentNodeId}.`,
        });
      }

      if (!descriptor.targetEntities) {
        issues.push({
          code: "missing_target_entities",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market ranking descriptor is missing targetEntities: ${descriptor.contentNodeId}.`,
        });
        return;
      }

      if (descriptor.targetEntities.length !== expectedRankingSource.items.length) {
        issues.push({
          code: "target_entity_mismatch",
          contentNodeId: descriptor.contentNodeId,
          message: `Programmatic Market ranking descriptor target count does not match ranking.items: ${descriptor.contentNodeId}.`,
        });
      }

      const targetEntityKeys = new Set<string>();

      descriptor.targetEntities.forEach((targetEntity, targetIndex) => {
        const targetEntityKey = `${targetEntity.kind}:${targetEntity.slug}`;

        if (targetEntityKeys.has(targetEntityKey)) {
          issues.push({
            code: "duplicate_target_entity",
            contentNodeId: descriptor.contentNodeId,
            slug: targetEntityKey,
            message: `Programmatic Market ranking descriptor contains a duplicate target entity: ${descriptor.contentNodeId} -> ${targetEntityKey}.`,
          });
        }
        targetEntityKeys.add(targetEntityKey);

        const sourceItem = expectedRankingSource.items[targetIndex];

        if (!sourceItem) {
          return;
        }

        const expectedTargetEntity = expectedTargetEntityFor(expectedRankingSource.slug, targetIndex, sourceItem);

        if ("code" in expectedTargetEntity) {
          issues.push({
            ...expectedTargetEntity,
            contentNodeId: descriptor.contentNodeId,
          });
          return;
        }

        if (targetEntity.kind !== expectedTargetEntity.kind) {
          issues.push({
            code: "invalid_target_entity_kind",
            contentNodeId: descriptor.contentNodeId,
            slug: targetEntityKey,
            message: `Programmatic Market ranking target entity kind does not match ranking.items: ${descriptor.contentNodeId}.`,
          });
        }

        if (targetEntity.slug !== expectedTargetEntity.slug) {
          issues.push({
            code: "target_entity_mismatch",
            contentNodeId: descriptor.contentNodeId,
            slug: targetEntity.slug,
            message: `Programmatic Market ranking target entity slug does not match ranking.items: ${descriptor.contentNodeId}.`,
          });
        }

        if (targetEntity.kind === "city") {
          if (!citySlugs.has(targetEntity.slug)) {
            issues.push({
              code: "missing_target_entity",
              contentNodeId: descriptor.contentNodeId,
              slug: targetEntity.slug,
              message: `Programmatic Market ranking target city is missing: ${targetEntity.slug}.`,
            });
          }
        } else if (targetEntity.kind === "country") {
          if (!countrySlugs.has(targetEntity.slug)) {
            issues.push({
              code: "missing_target_entity",
              contentNodeId: descriptor.contentNodeId,
              slug: targetEntity.slug,
              message: `Programmatic Market ranking target country is missing: ${targetEntity.slug}.`,
            });
          }
        } else {
          issues.push({
            code: "invalid_target_entity_kind",
            contentNodeId: descriptor.contentNodeId,
            slug: targetEntityKey,
            message: `Programmatic Market ranking target entity kind is invalid: ${descriptor.contentNodeId}.`,
          });
        }
      });
    }
  });

  expectedIds.forEach((expectedId) => {
    if (!descriptorIds.has(expectedId)) {
      issues.push({
        code: "missing_descriptor",
        contentNodeId: expectedId,
        message: `Expected Programmatic Market descriptor is missing: ${expectedId}.`,
      });
    }
  });

  const sortedIssues = [...issues].sort(compareIssues);
  const summary: ProgrammaticMarketAuditSummary = {
    totalDescriptors: input.descriptors.length,
    rankingDescriptors: input.descriptors.filter((descriptor) => descriptor.contentType === "ranking").length,
    reportDescriptors: input.descriptors.filter((descriptor) => descriptor.contentType === "report").length,
    expectedDescriptors: expectedIds.size,
  };

  return {
    status: sortedIssues.length === 0 ? "pass" : "fail",
    summary,
    issues: sortedIssues,
  };
}
