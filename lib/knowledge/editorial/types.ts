/** Stable identifier for a page or generated editorial resource. */
export type ContentType =
  | "article"
  | "guide"
  | "tool"
  | "solution"
  | "ranking"
  | "report"
  | "local"
  | "landing";

export type ContentNodeId = `content:${ContentType}:${string}`;

export type EditorialNodeKind = "topic" | "entity" | "platform" | "audience" | "geo";

export type EditorialNodeId =
  | `topic:${string}`
  | `entity:${string}`
  | `platform:${string}`
  | `audience:${string}`
  | `geo:${string}`;

export type EditorialGraphNodeId = ContentNodeId | EditorialNodeId;

export type SearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational";

export type ContentRole =
  | "pillar"
  | "supporting"
  | "tool"
  | "solution"
  | "report"
  | "local"
  | "comparison";

export type ContentSource =
  | "data/articles"
  | "data/guides"
  | "data/tools"
  | "data/solutions"
  | "data/rankings"
  | "data/marketReports"
  | "data/localSeo"
  | "app";

export interface ContentNode {
  id: ContentNodeId;
  contentType: ContentType;
  slug: string;
  path: string;
  title: string;
  source: ContentSource;
  locale: string;
  role?: ContentRole;
  intent?: SearchIntent;
}

export type EditorialNodeStatus = "active" | "planned" | "deprecated";

export interface EditorialNode {
  id: EditorialNodeId;
  kind: EditorialNodeKind;
  label: string;
  status: EditorialNodeStatus;
}

export type EditorialGraphNode = ContentNode | EditorialNode;

export type EditorialRelationType =
  | "is_about"
  | "part_of_cluster"
  | "pillar_for"
  | "supports"
  | "applies_to"
  | "uses_metric"
  | "commercial_path_to"
  | "related_to";

export interface EditorialRelation {
  type: EditorialRelationType;
  sourceId: EditorialGraphNodeId;
  targetId: EditorialGraphNodeId;
}

export interface EditorialValidationIssue {
  path: string;
  message: string;
}

export interface EditorialValidationResult {
  valid: boolean;
  issues: EditorialValidationIssue[];
}
