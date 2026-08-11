import {
  editorialRelationDefinitions,
  validateEditorialNodes,
  validateEditorialRelation,
  validateGraphNodeId,
} from "./relations";
import {
  canonicalEditorialNodes,
  schemaVersion,
  source,
  taxonomyVersion,
} from "./taxonomy";
import type { ContentNode, EditorialRelation } from "./types";

const EXAMPLE_ARTICLE: ContentNode = {
  id: "content:article:airbnb-seo",
  contentType: "article",
  slug: "airbnb-seo",
  path: "/articles/airbnb-seo",
  title: "Airbnb SEO",
  source: "data/articles",
  locale: "en",
};

function expectInvalid(validation: { valid: boolean }, message: string): void {
  if (validation.valid) {
    throw new Error(message);
  }
}

export function runEditorialKnowledgeGraphSmokeTest(): void {
  // Canonical, non-empty IDs and namespace parsing.
  if (
    !validateGraphNodeId(EXAMPLE_ARTICLE.id).valid ||
    !validateGraphNodeId("topic:airbnb-seo").valid ||
    !validateGraphNodeId("platform:booking").valid
  ) {
    throw new Error("Canonical editorial IDs must be valid.");
  }

  // Duplicate IDs are rejected.
  expectInvalid(
    validateEditorialNodes([EXAMPLE_ARTICLE, { ...EXAMPLE_ARTICLE }]),
    "Duplicate editorial IDs must be rejected."
  );

  // A content node cannot claim a namespace for another content type.
  expectInvalid(
    validateEditorialNodes([{ ...EXAMPLE_ARTICLE, id: "content:guide:airbnb-seo" }]),
    "Incoherent content namespaces must be rejected."
  );

  const registry = [...canonicalEditorialNodes, EXAMPLE_ARTICLE];
  const validRelation: EditorialRelation = {
    type: "part_of_cluster",
    sourceId: EXAMPLE_ARTICLE.id,
    targetId: "topic:seo-ranking",
  };

  if (!validateEditorialRelation(validRelation, registry).valid) {
    throw new Error("A valid editorial relation was rejected.");
  }

  // Runtime input may be untyped; unknown relations are rejected by validation.
  expectInvalid(
    validateEditorialRelation({ ...validRelation, type: "unknown" as EditorialRelation["type"] }, registry),
    "Unknown editorial relations must be rejected."
  );

  expectInvalid(
    validateEditorialRelation(
      { ...validRelation, targetId: "topic:missing" },
      registry
    ),
    "Relations to unknown nodes must be rejected."
  );

  if (!validateEditorialNodes(canonicalEditorialNodes).valid) {
    throw new Error("The canonical taxonomy must not contain duplicate or malformed nodes.");
  }

  if (
    schemaVersion !== "1" ||
    taxonomyVersion !== "1" ||
    source !== "manual-canonical-registry" ||
    Object.keys(editorialRelationDefinitions).length !== 8
  ) {
    throw new Error("Editorial graph versions or canonical relation definitions are invalid.");
  }
}
