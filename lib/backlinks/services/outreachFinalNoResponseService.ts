import { applyBacklinkOutreachFinalNoResponse as applyBacklinkOutreachFinalNoResponseRepository, type ApplyBacklinkOutreachFinalNoResponseResult } from "../repositories/outreachRepository";
import type { BacklinkRepositoryClient } from "../repositories/repositoryClient";

export type ApplyBacklinkOutreachFinalNoResponseInput = {
  workspaceId: string;
  actorUserId: string;
  outreachId: string;
  appliedAt?: string;
};

export type ApplyBacklinkOutreachFinalNoResponseDisposition = ApplyBacklinkOutreachFinalNoResponseResult["disposition"];

export function applyBacklinkOutreachFinalNoResponse(
  client: Pick<BacklinkRepositoryClient, "rpc">,
) {
  return async (input: ApplyBacklinkOutreachFinalNoResponseInput): Promise<ApplyBacklinkOutreachFinalNoResponseResult> => {
    const appliedAt = input.appliedAt ?? new Date().toISOString();
    return applyBacklinkOutreachFinalNoResponseRepository(client, input.workspaceId, input.outreachId, appliedAt);
  };
}
