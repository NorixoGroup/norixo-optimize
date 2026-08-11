import type { ContentNodeId, SearchIntent } from "./types";

export type PhotoSemanticGroupId =
  | "general-photography"
  | "cover-gallery"
  | "room-photography"
  | "technical-preparation"
  | "property-type-photography";

export interface PhotoAuditContent {
  id: ContentNodeId;
  slug: string;
  title: string;
  description: string;
  cluster: string;
  relatedGuides: string[];
  relatedRankings: string[];
  intent: SearchIntent;
  semanticGroup: PhotoSemanticGroupId;
  specificity: "general" | "functional" | "room" | "technical" | "property_type";
}

export interface PhotoSemanticGroup {
  id: PhotoSemanticGroupId;
  members: ContentNodeId[];
}

export type PhotoCannibalizationSeverity = "low" | "medium" | "high";
export type PhotoGovernanceAction =
  | "keep_distinct"
  | "needs_review"
  | "candidate_merge"
  | "candidate_reposition"
  | "candidate_primary_secondary";

export interface PhotoCannibalizationGroup {
  id: string;
  members: ContentNodeId[];
  reasons: string[];
  severity: PhotoCannibalizationSeverity;
  recommendedGovernanceAction: PhotoGovernanceAction;
}

export interface PhotosAuditReport {
  contents: PhotoAuditContent[];
  semanticGroups: PhotoSemanticGroup[];
  cannibalizationGroups: PhotoCannibalizationGroup[];
  futureSubtopicCandidates: string[];
}
