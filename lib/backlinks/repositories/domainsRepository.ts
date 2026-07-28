import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkDomainRow = BacklinkRow<"backlink_domains">;
type BacklinkDomainInsert = BacklinkInsert<"backlink_domains">;
type BacklinkDomainUpdate = BacklinkUpdate<"backlink_domains">;

type BacklinkDomainSystemColumns =
  | "id"
  | "workspace_id"
  | "created_by"
  | "created_at"
  | "updated_at";

export type CreateBacklinkDomainInput = Omit<BacklinkDomainInsert, BacklinkDomainSystemColumns> & {
  createdBy: string;
};

export type UpdateBacklinkDomainInput = Omit<BacklinkDomainUpdate, BacklinkDomainSystemColumns>;

export interface ListBacklinkDomainsInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(
  operation: string,
  input: UpdateBacklinkDomainInput,
): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, domainId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_domain", resourceId: domainId },
  });
}

export async function getBacklinkDomainById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  domainId: string,
): Promise<BacklinkDomainRow> {
  const operation = "getBacklinkDomainById";
  const { data, error } = await client
    .from("backlink_domains")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", domainId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, domainId);
  }

  return data;
}

export async function listBacklinkDomains(
  client: BacklinkRepositoryClient,
  input: ListBacklinkDomainsInput,
): Promise<RepositoryPage<BacklinkDomainRow>> {
  const operation = "listBacklinkDomains";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_domains")
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

export async function createBacklinkDomain(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkDomainInput,
): Promise<BacklinkDomainRow> {
  const operation = "createBacklinkDomain";
  const { createdBy, ...domain } = input;
  const payload: BacklinkDomainInsert = {
    ...domain,
    workspace_id: workspaceId,
    created_by: createdBy,
  };
  const { data, error } = await client
    .from("backlink_domains")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkDomain(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  domainId: string,
  input: UpdateBacklinkDomainInput,
): Promise<BacklinkDomainRow> {
  const operation = "updateBacklinkDomain";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_domains")
    .update(input)
    .eq("workspace_id", workspaceId)
    .eq("id", domainId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, domainId);
  }

  return data;
}
