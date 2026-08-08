import {
  validateBacklinkCampaignEnginePreviewOutput,
} from "./backlink-campaign-engine-validation";
import type {
  BacklinkCampaignEnginePreviewOutputV1,
} from "./backlink-campaign-engine-types";
import {
  BacklinkCampaignMembershipApplyServiceError,
  type ApplyBacklinkCampaignPreviewMembershipsDependencies,
  type ApplyBacklinkCampaignPreviewMembershipsInput,
  type ApplyBacklinkCampaignPreviewMembershipsResult,
} from "./backlink-campaign-membership-apply-service-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInput(
  input: ApplyBacklinkCampaignPreviewMembershipsInput,
): void {
  if (
    !UUID_PATTERN.test(input.workspaceId) ||
    !UUID_PATTERN.test(input.actorUserId) ||
    !UUID_PATTERN.test(input.runId) ||
    !UUID_PATTERN.test(input.taskId) ||
    !UUID_PATTERN.test(input.campaignId)
  ) {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "INVALID_CAMPAIGN_MEMBERSHIP_APPLY_INPUT",
    );
  }
}

function readValidatedPreview(
  output: unknown,
): BacklinkCampaignEnginePreviewOutputV1 {
  try {
    validateBacklinkCampaignEnginePreviewOutput(output);
  } catch {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "CAMPAIGN_PREVIEW_OUTPUT_INVALID",
    );
  }

  return output as BacklinkCampaignEnginePreviewOutputV1;
}

export async function applyBacklinkCampaignPreviewMemberships(
  dependencies: ApplyBacklinkCampaignPreviewMembershipsDependencies,
  input: ApplyBacklinkCampaignPreviewMembershipsInput,
): Promise<ApplyBacklinkCampaignPreviewMembershipsResult> {
  validateInput(input);

  const task = await dependencies.getTaskByIdInRun({
    workspaceId: input.workspaceId,
    runId: input.runId,
    taskId: input.taskId,
  });

  if (task === null) {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "CAMPAIGN_PREVIEW_TASK_NOT_FOUND",
    );
  }

  if (
    task.id !== input.taskId ||
    task.workspaceId !== input.workspaceId ||
    task.runId !== input.runId ||
    task.taskKind !== "backlinks.campaign.preview"
  ) {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "CAMPAIGN_PREVIEW_TASK_SCOPE_MISMATCH",
    );
  }

  if (task.status !== "completed") {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "CAMPAIGN_PREVIEW_TASK_NOT_COMPLETED",
    );
  }

  if (task.output === null) {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "CAMPAIGN_PREVIEW_OUTPUT_MISSING",
    );
  }

  const preview = readValidatedPreview(task.output);

  if (
    preview.workspaceId !== input.workspaceId ||
    preview.runId !== input.runId ||
    preview.campaignId !== input.campaignId ||
    preview.mode !== "preview"
  ) {
    throw new BacklinkCampaignMembershipApplyServiceError(
      "CAMPAIGN_PREVIEW_CAMPAIGN_MISMATCH",
    );
  }

  const selectedResults = preview.results.filter(
    (result) => result.decision === "selected",
  );

  const memberships: ApplyBacklinkCampaignPreviewMembershipsResult["memberships"] =
    [];

  for (const result of selectedResults) {
    if (
      result.proposedMembershipStatus !== "planned" ||
      result.proposedPriority === null
    ) {
      throw new BacklinkCampaignMembershipApplyServiceError(
        "CAMPAIGN_PREVIEW_SELECTED_RESULT_INVALID",
      );
    }

    const applied = await dependencies.applyMembership({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      campaignId: input.campaignId,
      opportunityId: result.opportunityId,
      proposedMembershipStatus: result.proposedMembershipStatus,
      proposedPriority: result.proposedPriority,
    });

    memberships.push({
      opportunityId: result.opportunityId,
      disposition: applied.disposition,
      membership: applied.membership,
    });
  }

  const created = memberships.filter(
    (membership) => membership.disposition === "created",
  ).length;
  const existing = memberships.filter(
    (membership) => membership.disposition === "existing",
  ).length;
  const reactivated = memberships.filter(
    (membership) => membership.disposition === "reactivated",
  ).length;

  return {
    campaignId: input.campaignId,
    runId: input.runId,
    taskId: input.taskId,
    preview,
    summary: {
      selected: selectedResults.length,
      created,
      existing,
      reactivated,
    },
    memberships,
  };
}
