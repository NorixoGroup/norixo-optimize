import type { KnowledgeObject } from "./types";
import type { KnowledgeRegistry } from "./registry";

function resolve(
  registry: KnowledgeRegistry,
  canonicalIds: string[]
): KnowledgeObject[] {
  return canonicalIds.flatMap((canonicalId) => {
    const object = registry.getKnowledgeObject(canonicalId);
    return object ? [object] : [];
  });
}

export function getParents(
  registry: KnowledgeRegistry,
  object: KnowledgeObject
): KnowledgeObject[] {
  return resolve(
    registry,
    object.identity.parentConcepts.map((reference) => reference.canonicalId)
  );
}

export function getChildren(
  registry: KnowledgeRegistry,
  object: KnowledgeObject
): KnowledgeObject[] {
  const explicitChildren = resolve(
    registry,
    object.identity.childConcepts.map((reference) => reference.canonicalId)
  );
  const inferredChildren = registry.listKnowledgeObjects().filter((candidate) =>
    candidate.identity.parentConcepts.some(
      (reference) => reference.canonicalId === object.identity.canonicalId
    )
  );

  return Array.from(
    new Map(
      [...explicitChildren, ...inferredChildren].map((child) => [child.identity.canonicalId, child])
    ).values()
  );
}

export function getAncestors(
  registry: KnowledgeRegistry,
  object: KnowledgeObject
): KnowledgeObject[] {
  const ancestors: KnowledgeObject[] = [];
  const visited = new Set([object.identity.canonicalId]);
  let currentLevel = getParents(registry, object);

  while (currentLevel.length > 0) {
    const nextLevel: KnowledgeObject[] = [];

    currentLevel.forEach((ancestor) => {
      const canonicalId = ancestor.identity.canonicalId;
      if (visited.has(canonicalId)) {
        return;
      }

      visited.add(canonicalId);
      ancestors.push(ancestor);
      nextLevel.push(...getParents(registry, ancestor));
    });

    currentLevel = nextLevel;
  }

  return ancestors;
}

export function getRelated(
  registry: KnowledgeRegistry,
  object: KnowledgeObject
): KnowledgeObject[] {
  return resolve(
    registry,
    [...object.identity.relatedConcepts, ...object.relationships.relatedTo].map(
      (reference) => reference.canonicalId
    )
  );
}

export function getRequires(
  registry: KnowledgeRegistry,
  object: KnowledgeObject
): KnowledgeObject[] {
  return resolve(
    registry,
    object.relationships.requires.map((reference) => reference.canonicalId)
  );
}
