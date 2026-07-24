import type { EditorialProjection, EditorialProjectionType, KnowledgeObject } from "./types";

export function getEditorialProjections(
  object: KnowledgeObject,
  type?: EditorialProjectionType
): EditorialProjection[] {
  return type
    ? object.editorialProjections.filter((projection) => projection.type === type)
    : object.editorialProjections;
}

export function getCanonicalProjectionUrl(
  object: KnowledgeObject,
  type: EditorialProjectionType
): string | undefined {
  return getEditorialProjections(object, type).find(
    (projection) => projection.status === "published" && projection.canonicalUrl
  )?.canonicalUrl;
}
