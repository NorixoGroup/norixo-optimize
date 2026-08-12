import { getKnowledgeObject } from "../registry";
import { canonicalEditorialNodes } from "./taxonomy";
import { buildEditorialContentNodes } from "./content-adapter";
import { validateEditorialRelation } from "./relations";
import { photosEditorialMappings, pricingEditorialMappings, revenueEditorialMappings, seoRankingEditorialMappings } from "./mappings";
import type {
  ContentNodeId,
  EditorialGraphNodeId,
  EditorialRelation,
  EditorialValidationIssue,
  EditorialValidationResult,
} from "./types";

export type KpiKnowledgeObjectId =
  | `domains.${string}`
  | `metrics.${string}`
  | `inventory.${string}`
  | `revenue.${string}`;

/**
 * `uses_metric` targets the existing KPI registry rather than duplicating its
 * metrics as editorial nodes. All other mappings retain the Phase 1A relation contract.
 */
export type EditorialMapping =
  | EditorialRelation
  | {
      type: "uses_metric";
      sourceId: ContentNodeId;
      targetId: KpiKnowledgeObjectId;
    };

export type EditorialMappingNodeId = EditorialGraphNodeId | KpiKnowledgeObjectId;

function issue(path: string, message: string): EditorialValidationIssue {
  return { path, message };
}

function isKpiKnowledgeObjectId(id: string): id is KpiKnowledgeObjectId {
  return /^(domains|metrics|inventory|revenue)\.[^\s.]+$/.test(id);
}

function isKpiMetricMapping(mapping: EditorialMapping): mapping is Extract<EditorialMapping, {
  type: "uses_metric";
}> {
  return mapping.type === "uses_metric" && isKpiKnowledgeObjectId(mapping.targetId);
}

export function getEditorialMappings(): EditorialMapping[] {
  return [...pricingEditorialMappings, ...revenueEditorialMappings, ...photosEditorialMappings, ...seoRankingEditorialMappings];
}

export function getMappingsFrom(nodeId: EditorialMappingNodeId): EditorialMapping[] {
  return getEditorialMappings().filter((mapping) => mapping.sourceId === nodeId);
}

export function getMappingsTo(nodeId: EditorialMappingNodeId): EditorialMapping[] {
  return getEditorialMappings().filter((mapping) => mapping.targetId === nodeId);
}

export function getClusterMappings(topicId: "topic:pricing" | "topic:revenue" | "topic:photos" | "topic:seo-ranking"): EditorialMapping[] {
  return getEditorialMappings().filter(
    (mapping) =>
      (mapping.type === "part_of_cluster" || mapping.type === "pillar_for") &&
      mapping.targetId === topicId
  );
}

export function validateEditorialMappingRegistry(
  mappings: readonly EditorialMapping[] = getEditorialMappings()
): EditorialValidationResult {
  const issues: EditorialValidationIssue[] = [];
  const editorialNodes = [...canonicalEditorialNodes, ...buildEditorialContentNodes()];
  const seenMappings = new Set<string>();
  const pricingPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:pricing"
  );
  const revenuePillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:revenue"
  );
  const photosPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:photos"
  );
  const seoRankingPillars = mappings.filter(
    (mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:seo-ranking"
  );

  mappings.forEach((mapping, index) => {
    const key = `${mapping.type}:${mapping.sourceId}:${mapping.targetId}`;

    if (seenMappings.has(key)) {
      issues.push(issue(`mappings[${index}]`, `Duplicate mapping: ${key}.`));
    }

    seenMappings.add(key);

    if (isKpiMetricMapping(mapping)) {
      if (!editorialNodes.some((node) => node.id === mapping.sourceId)) {
        issues.push(issue(`mappings[${index}].sourceId`, "Metric mapping source does not exist."));
      }

      if (!getKnowledgeObject(mapping.targetId)) {
        issues.push(issue(`mappings[${index}].targetId`, "KPI metric target does not exist."));
      }

      return;
    }

    const relationValidation = validateEditorialRelation(mapping, editorialNodes);
    relationValidation.issues.forEach((relationIssue) => {
      issues.push(issue(`mappings[${index}].${relationIssue.path}`, relationIssue.message));
    });

    if (mapping.type === "part_of_cluster" || mapping.type === "pillar_for") {
      if (mapping.targetId !== "topic:pricing" && mapping.targetId !== "topic:revenue" && mapping.targetId !== "topic:photos" && mapping.targetId !== "topic:seo-ranking") {
        issues.push(issue(`mappings[${index}].targetId`, "Only Pricing, Revenue, Photos, and SEO / Ranking clusters are allowed."));
      }
    }
  });

  if (pricingPillars.length !== 1) {
    issues.push(issue("mappings", "The Pricing cluster requires exactly one pillar."));
  } else if (pricingPillars[0].sourceId !== "content:guide:airbnb-pricing-optimization") {
    issues.push(issue("mappings", "The Pricing pillar must be the Airbnb Pricing Optimization guide."));
  }

  if (revenuePillars.length !== 1) {
    issues.push(issue("mappings", "The Revenue cluster requires exactly one pillar."));
  } else if (revenuePillars[0].sourceId !== "content:guide:airbnb-revenue-optimization") {
    issues.push(issue("mappings", "The Revenue pillar must be the Airbnb Revenue Optimization guide."));
  }

  if (photosPillars.length !== 1) {
    issues.push(issue("mappings", "The Photos cluster requires exactly one pillar."));
  } else if (photosPillars[0].sourceId !== "content:guide:airbnb-photo-optimization") {
    issues.push(issue("mappings", "The Photos pillar must be the Airbnb Photo Optimization guide."));
  }

  if (seoRankingPillars.length !== 1) {
    issues.push(issue("mappings", "The SEO / Ranking cluster requires exactly one pillar."));
  } else if (seoRankingPillars[0].sourceId !== "content:guide:airbnb-seo") {
    issues.push(issue("mappings", "The SEO / Ranking pillar must be the Airbnb SEO guide."));
  }

  return { valid: issues.length === 0, issues };
}
