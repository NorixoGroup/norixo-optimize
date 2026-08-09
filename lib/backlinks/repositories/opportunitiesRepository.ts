import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkOpportunityRow = BacklinkRow<"backlink_opportunities">;
type BacklinkOpportunityInsert = BacklinkInsert<"backlink_opportunities">;
type BacklinkOpportunityUpdate = BacklinkUpdate<"backlink_opportunities">;

type BacklinkOpportunitySystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkOpportunityInput = Omit<
  BacklinkOpportunityInsert,
  BacklinkOpportunitySystemColumns
> & {
  createdBy: string;
};

export type UpdateBacklinkOpportunityInput = Omit<
  BacklinkOpportunityUpdate,
  BacklinkOpportunitySystemColumns
>;

export interface ListBacklinkOpportunitiesInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

export interface GetBacklinkOpportunityByIdentityInput {
  workspaceId: WorkspaceId;
  domainId: string;
  targetPageUrl: string;
  opportunityType: string;
  assetId: string;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateBacklinkOpportunityInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, opportunityId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_opportunity", resourceId: opportunityId },
  });
}

export async function getBacklinkOpportunityById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
): Promise<BacklinkOpportunityRow> {
  const operation = "getBacklinkOpportunityById";
  const { data, error } = await client
    .from("backlink_opportunities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, opportunityId);
  }

  return data;
}

export async function getBacklinkOpportunityByIdentity(
  client: BacklinkRepositoryClient,
  input: GetBacklinkOpportunityByIdentityInput,
): Promise<BacklinkOpportunityRow | null> {
  const operation = "getBacklinkOpportunityByIdentity";
  const { data, error } = await client
    .from("backlink_opportunities")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("domain_id", input.domainId)
    .eq("target_page_url", input.targetPageUrl)
    .eq("opportunity_type", input.opportunityType)
    .eq("asset_id", input.assetId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function listBacklinkOpportunities(
  client: BacklinkRepositoryClient,
  input: ListBacklinkOpportunitiesInput,
): Promise<RepositoryPage<BacklinkOpportunityRow>> {
  const operation = "listBacklinkOpportunities";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_opportunities")
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

export async function createBacklinkOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkOpportunityInput,
): Promise<BacklinkOpportunityRow> {
  const operation = "createBacklinkOpportunity";
  const { createdBy, ...opportunity } = input;
  const payload: BacklinkOpportunityInsert = {
    ...opportunity,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_opportunities")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkOpportunity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  opportunityId: string,
  input: UpdateBacklinkOpportunityInput,
): Promise<BacklinkOpportunityRow> {
  const operation = "updateBacklinkOpportunity";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_opportunities")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", opportunityId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, opportunityId);
  }

  return data;
}
