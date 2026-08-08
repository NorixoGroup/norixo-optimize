import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import type { ApplyQualificationInput, ApplyQualificationResult } from "./backlink-qualification-application-types";
import { applyBacklinkQualificationFromTask } from "./backlink-qualification-apply-service";
import {
  readCompletedQualificationTask,
  getOpportunityRow,
  updateOpportunityQualificationStatusRow,
} from "./repositories/backlinkQualificationApplicationRepository";

export async function applyBacklinkQualificationTransaction(
  client: BacklinkRepositoryClient,
  input: ApplyQualificationInput,
): Promise<ApplyQualificationResult> {
  const deps = {
    readQualificationTask: ({ workspaceId, runId, taskId }: { workspaceId: string; runId: string; taskId: string }) =>
      readCompletedQualificationTask(client, { workspaceId, runId, taskId }),
    getOpportunityById: (workspaceId: string, opportunityId: string) => getOpportunityRow(client, workspaceId, opportunityId),
    updateOpportunityQualificationStatus: (workspaceId: string, opportunityId: string, qualificationStatus: string) =>
      updateOpportunityQualificationStatusRow(client, workspaceId, opportunityId, qualificationStatus),
  };

  return applyBacklinkQualificationFromTask(deps, input);
}
