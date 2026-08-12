import { listBacklinkOutreachDueFollowUps as listBacklinkOutreachDueFollowUpsRepository, type BacklinkOutreachDueFollowUpRow } from "../repositories/outreachRepository";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { WorkspaceId } from "../repositories/types";

export type BacklinkOutreachDueFollowUpSelectorInput = {
  workspaceId: WorkspaceId;
  now?: string;
  limit?: number;
};

export type BacklinkOutreachDueFollowUpSelectorResult = {
  items: BacklinkOutreachDueFollowUpRow[];
};

function normalizeLimit(limit: number | undefined): number {
  if (limit == null) return 50;
  if (!Number.isInteger(limit) || limit < 1) return 50;
  return Math.min(limit, 200);
}

export function listBacklinkOutreachDueFollowUps(
  client: Pick<BacklinkRepositoryClient, "rpc">,
  dependencies: {
    now?: () => string;
  } = {},
) {
  return async (input: BacklinkOutreachDueFollowUpSelectorInput): Promise<BacklinkOutreachDueFollowUpSelectorResult> => {
    const now = input.now ?? dependencies.now?.() ?? new Date().toISOString();
    const items = await listBacklinkOutreachDueFollowUpsRepository(client, {
      workspaceId: input.workspaceId,
      now,
      limit: normalizeLimit(input.limit),
    });
    return { items };
  };
}
