import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkCampaignRow = BacklinkRow<"backlink_campaigns">;
type BacklinkCampaignInsert = BacklinkInsert<"backlink_campaigns">;
type BacklinkCampaignUpdate = BacklinkUpdate<"backlink_campaigns">;

type BacklinkCampaignSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkCampaignInput = Omit<
  BacklinkCampaignInsert,
  BacklinkCampaignSystemColumns
> & {
  createdBy: string;
};

export type UpdateBacklinkCampaignInput = Omit<
  BacklinkCampaignUpdate,
  BacklinkCampaignSystemColumns
>;

export interface ListBacklinkCampaignsInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateBacklinkCampaignInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, campaignId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_campaign", resourceId: campaignId },
  });
}

export async function getBacklinkCampaignById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
): Promise<BacklinkCampaignRow> {
  const operation = "getBacklinkCampaignById";
  const { data, error } = await client
    .from("backlink_campaigns")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, campaignId);
  }

  return data;
}

export async function listBacklinkCampaigns(
  client: BacklinkRepositoryClient,
  input: ListBacklinkCampaignsInput,
): Promise<RepositoryPage<BacklinkCampaignRow>> {
  const operation = "listBacklinkCampaigns";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_campaigns")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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

export async function createBacklinkCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkCampaignInput,
): Promise<BacklinkCampaignRow> {
  const operation = "createBacklinkCampaign";
  const { createdBy, ...campaign } = input;
  const payload: BacklinkCampaignInsert = {
    ...campaign,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_campaigns")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkCampaign(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  campaignId: string,
  input: UpdateBacklinkCampaignInput,
): Promise<BacklinkCampaignRow> {
  const operation = "updateBacklinkCampaign";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_campaigns")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, campaignId);
  }

  return data;
}
