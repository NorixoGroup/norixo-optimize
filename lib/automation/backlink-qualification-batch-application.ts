import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import { getOpportunityRow, readCompletedQualificationTask, updateOpportunityQualificationStatusRow } from "./repositories/backlinkQualificationApplicationRepository";
import { listBacklinkDiscoveryIntakeApplications } from "./repositories/backlinkDiscoveryIntakeApplicationRepository";
import { applyBacklinkQualificationBatch } from "./backlink-qualification-batch-apply-service";
import type { ApplyQualificationBatchInput, ApplyQualificationBatchResult } from "./backlink-qualification-batch-application-types";

export async function applyBacklinkQualificationBatchTransaction(
  client: BacklinkRepositoryClient,
  input: ApplyQualificationBatchInput,
): Promise<ApplyQualificationBatchResult> {
  return applyBacklinkQualificationBatch(
    {
      readQualificationTask: ({ workspaceId, runId, taskId }) =>
        readCompletedQualificationTask(client, { workspaceId, runId, taskId }),
      listDiscoveryIntakeApplications: (value) =>
        listBacklinkDiscoveryIntakeApplications(client, value),
      getOpportunityById: (workspaceId, opportunityId) =>
        getOpportunityRow(client, workspaceId, opportunityId),
      updateOpportunityQualificationStatus: (workspaceId, opportunityId, qualificationStatus) =>
        updateOpportunityQualificationStatusRow(client, workspaceId, opportunityId, qualificationStatus),
    },
    input,
  );
}
