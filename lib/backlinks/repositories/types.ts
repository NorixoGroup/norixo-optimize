import type { Database } from "@/types/database.types";

type BacklinkTables = Database["public"]["Tables"];

export type WorkspaceId = string;

export interface WorkspaceScopedQuery {
  workspaceId: WorkspaceId;
}

export type SortDirection = "asc" | "desc";

export type BacklinkTableName =
  | "backlink_assets"
  | "backlink_domains"
  | "backlink_tags"
  | "backlink_opportunities"
  | "backlink_domain_tags"
  | "backlink_opportunity_tags"
  | "backlink_contacts"
  | "backlink_campaigns"
  | "backlink_campaign_opportunities"
  | "backlink_outreach"
  | "backlink_links"
  | "backlink_verification_attempts"
  | "backlink_verification_jobs"
  | "backlink_notes"
  | "backlink_activity";

export type BacklinkRow<TTableName extends BacklinkTableName> = BacklinkTables[TTableName]["Row"];

export type BacklinkInsert<TTableName extends BacklinkTableName> =
  BacklinkTables[TTableName]["Insert"];

export type BacklinkUpdate<TTableName extends BacklinkTableName> =
  BacklinkTables[TTableName]["Update"];
