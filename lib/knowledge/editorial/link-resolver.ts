import { buildEditorialContentNodes } from "./content-adapter";
import { getEditorialMappings } from "./mapping-registry";
import type { EditorialResolvedLink } from "./linking-types";
import type { ContentNodeId } from "./types";

const allowedRelations = ["pillar_for", "supports", "related_to", "commercial_path_to"] as const;
const priority: Record<(typeof allowedRelations)[number], number> = {
  pillar_for: 0,
  supports: 1,
  related_to: 2,
  commercial_path_to: 3,
};
export const editorialLinkResolverMaxLinks = 6;

function isAllowedRelation(type: string): type is (typeof allowedRelations)[number] {
  return (allowedRelations as readonly string[]).includes(type);
}

export function resolveEditorialLinks(sourceId: ContentNodeId, options: { maxLinks?: number } = {}): EditorialResolvedLink[] {
  const maxLinks = options.maxLinks ?? editorialLinkResolverMaxLinks;
  const contentById = new Map(buildEditorialContentNodes().map((node) => [node.id, node]));
  if (!contentById.has(sourceId)) return [];

  const seen = new Set<ContentNodeId>();
  return getEditorialMappings()
    .filter((mapping) => mapping.sourceId === sourceId && isAllowedRelation(mapping.type))
    .sort((left, right) => priority[left.type as keyof typeof priority] - priority[right.type as keyof typeof priority] || left.targetId.localeCompare(right.targetId))
    .flatMap((mapping) => {
      const target = contentById.get(mapping.targetId as ContentNodeId);
      if (!target || target.id === sourceId || seen.has(target.id) || !target.path) return [];
      seen.add(target.id);
      return [{
        sourceId,
        targetId: target.id,
        relationType: mapping.type as EditorialResolvedLink["relationType"],
        title: target.title,
        path: target.path,
        contentType: target.contentType,
        reason: mapping.type === "supports" ? "Supports the canonical guide" : "Related editorial resource",
        required: false,
        placement: (mapping.type === "commercial_path_to" ? "next_steps" : "related_content") as EditorialResolvedLink["placement"],
      }];
    })
    .slice(0, Math.max(0, maxLinks));
}
