import type { ContentNodeId, ContentType, EditorialRelationType } from "./types";

export type EditorialLinkPlacement = "related_content" | "next_steps";

export interface EditorialResolvedLink {
  sourceId: ContentNodeId;
  targetId: ContentNodeId;
  relationType: Extract<EditorialRelationType, "supports" | "related_to" | "commercial_path_to" | "pillar_for">;
  title: string;
  path: string;
  contentType: ContentType;
  reason: string;
  required: boolean;
  placement: EditorialLinkPlacement;
}
