import { normalizeBacklinkRepositoryError, BacklinkRepositoryError } from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, WorkspaceId } from "./types";

export type BacklinkActivityRow = BacklinkRow<"backlink_activity">;
type BacklinkActivityInsert = BacklinkInsert<"backlink_activity">;

type BacklinkActivitySystemColumns =
  | "id"
  | "workspace_id"
  | "actor_user_id"
  | "occurred_at";

export type CreateBacklinkActivityInput = Omit<
  BacklinkActivityInsert,
  BacklinkActivitySystemColumns
> & {
  actorUserId: string;
};

export interface ListBacklinkActivityInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function throwNotFound(operation: string, activityId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_activity", resourceId: activityId },
  });
}

export async function getBacklinkActivityById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  activityId: string,
): Promise<BacklinkActivityRow> {
  const operation = "getBacklinkActivityById";
  const { data, error } = await client
    .from("backlink_activity")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", activityId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, activityId);
  }

  return data;
}

export async function listBacklinkActivity(
  client: BacklinkRepositoryClient,
  input: ListBacklinkActivityInput,
): Promise<RepositoryPage<BacklinkActivityRow>> {
  const operation = "listBacklinkActivity";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_activity")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("occurred_at", { ascending: false })
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

export async function createBacklinkActivity(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkActivityInput,
): Promise<BacklinkActivityRow> {
  const operation = "createBacklinkActivity";
  const { actorUserId, ...activity } = input;
  const payload: BacklinkActivityInsert = {
    ...activity,
    workspace_id: workspaceId,
    actor_user_id: actorUserId,
    occurred_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("backlink_activity")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}
