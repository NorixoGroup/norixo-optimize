import type { KnowledgeObject } from "./types";
import { validateKnowledgeObject } from "./validators";

export interface KnowledgeRegistry {
  registerKnowledgeObject(object: KnowledgeObject): KnowledgeObject;
  getKnowledgeObject(canonicalId: string): KnowledgeObject | undefined;
  listKnowledgeObjects(): KnowledgeObject[];
  findKnowledgeObject(predicate: (object: KnowledgeObject) => boolean): KnowledgeObject | undefined;
}

export function createKnowledgeRegistry(
  initialObjects: KnowledgeObject[] = []
): KnowledgeRegistry {
  const objects = new Map<string, KnowledgeObject>();

  const registerKnowledgeObject = (object: KnowledgeObject): KnowledgeObject => {
    const validation = validateKnowledgeObject(object);

    if (!validation.valid) {
      throw new Error(
        `Cannot register knowledge object ${object.identity.canonicalId}: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(" ")}`
      );
    }

    if (objects.has(object.identity.canonicalId)) {
      throw new Error(`Knowledge object already registered: ${object.identity.canonicalId}`);
    }

    objects.set(object.identity.canonicalId, object);
    return object;
  };

  initialObjects.forEach(registerKnowledgeObject);

  return {
    registerKnowledgeObject,
    getKnowledgeObject: (canonicalId) => objects.get(canonicalId),
    listKnowledgeObjects: () => Array.from(objects.values()),
    findKnowledgeObject: (predicate) => Array.from(objects.values()).find(predicate),
  };
}
