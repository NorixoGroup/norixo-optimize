import { listBacklinkOutreachExpiredResponseDeadlines as listBacklinkOutreachExpiredResponseDeadlinesRepository, type BacklinkOutreachExpiredResponseDeadlineRow } from "../repositories/outreachRepository";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";
import type { WorkspaceId } from "../repositories/types";

export type BacklinkOutreachExpiredResponseDeadlineSelectorInput = {
  workspaceId: WorkspaceId;
  now?: string;
  limit?: number;
};

export type BacklinkOutreachExpiredResponseDeadlineSelectorResult = {
  items: BacklinkOutreachExpiredResponseDeadlineRow[];
};

function normalizeLimit(limit: number | undefined): number {
  if (limit == null) return 50;
  if (!Number.isInteger(limit) || limit < 1) return 50;
  return Math.min(limit, 200);
}

export function listBacklinkOutreachExpiredResponseDeadlines(
  client: Pick<BacklinkRepositoryClient, "rpc">,
  dependencies: {
    now?: () => string;
  } = {},
) {
  return async (input: BacklinkOutreachExpiredResponseDeadlineSelectorInput): Promise<BacklinkOutreachExpiredResponseDeadlineSelectorResult> => {
    const now = input.now ?? dependencies.now?.() ?? new Date().toISOString();
    const items = await listBacklinkOutreachExpiredResponseDeadlinesRepository(client, {
      workspaceId: input.workspaceId,
      now,
      limit: normalizeLimit(input.limit),
    });
    return { items };
  };
}
