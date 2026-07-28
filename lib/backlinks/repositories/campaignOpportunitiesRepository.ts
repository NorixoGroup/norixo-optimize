import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkCampaignOpportunityRow = BacklinkRow<"backlink_campaign_opportunities">;
type BacklinkCampaignOpportunityInsert = BacklinkInsert<"backlink_campaign_opportunities">;
type BacklinkCampaignOpportunityUpdate = BacklinkUpdate<"backlink_campaign_opportunities">;

type BacklinkCampaignOpportunitySystemColumns =
  | "workspace_id"
  | "campaign_id"
  | "opportunity_id"
  | "added_at"
  | "added_by"
  | "removed_at";

export type AddOpportunityToCampaignInput = Omit<
  BacklinkCampaignOpportunityInsert,
  BacklinkCampaignOpportunitySystemColumns
> & {
  addedBy: string;
};

export type UpdateCampaignOpportunityInput = Omit<
  BacklinkCampaignOpportunityUpdate,
  BacklinkCampaignOpportunitySystemColumns
>;

export interface RemoveOpportunityFromCampaignInput {
  removalReason: string;
}

export interface ListCampaignOpportunitiesInput {
  workspaceId: WorkspaceId;
  campaignId: string;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateCampaignOpportunityInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(
  operation: string,
  campaignId: string,
  opportunityId: string,
): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: {
      entity: "backlink_campaign_opportunity",
      campaignId,
      opportunityId,
    },
  });
}

export async function getCampaignOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  opportunityId: string,
): Promise<BacklinkCampaignOpportunityRow> {
  const operation = "getCampaignOpportunity";
  const { data, error } = await client
    .from("backlink_campaign_opportunities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, campaignId, opportunityId);
  }

  return data;
}

export async function listCampaignOpportunities(
  client: BacklinkRepositoryClient,
  input: ListCampaignOpportunitiesInput,
): Promise<RepositoryPage<BacklinkCampaignOpportunityRow>> {
  const operation = "listCampaignOpportunities";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_campaign_opportunities")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .order("campaign_priority", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false })
    .order("opportunity_id", { ascending: true })
    .range(page.from, page.to);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  const total = count ?? 0;
  return {
    items: data ?? [],
    page: page.page,
    pageSize: page.pageSize,
    total,
    hasNextPage: page.to + 1 < total,
  };
}

export async function addOpportunityToCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  opportunityId: string,
  input: AddOpportunityToCampaignInput,
): Promise<BacklinkCampaignOpportunityRow> {
  const operation = "addOpportunityToCampaign";
  const { addedBy, ...membership } = input;
  const payload: BacklinkCampaignOpportunityInsert = {
    ...membership,
    workspace_id: workspaceId,
    campaign_id: campaignId,
    opportunity_id: opportunityId,
    added_by: addedBy,
  };
  const { data, error } = await client
    .from("backlink_campaign_opportunities")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateCampaignOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  opportunityId: string,
  input: UpdateCampaignOpportunityInput,
): Promise<BacklinkCampaignOpportunityRow> {
  const operation = "updateCampaignOpportunity";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_campaign_opportunities")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .eq("opportunity_id", opportunityId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, campaignId, opportunityId);
  }

  return data;
}

export async function removeOpportunityFromCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  opportunityId: string,
  input: RemoveOpportunityFromCampaignInput,
): Promise<BacklinkCampaignOpportunityRow> {
  const operation = "removeOpportunityFromCampaign";
  const { data, error } = await client
    .from("backlink_campaign_opportunities")
    .update({
      membership_status: "removed",
      removed_at: new Date().toISOString(),
      removal_reason: input.removalReason,
    })
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .eq("opportunity_id", opportunityId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, campaignId, opportunityId);
  }

  return data;
}
