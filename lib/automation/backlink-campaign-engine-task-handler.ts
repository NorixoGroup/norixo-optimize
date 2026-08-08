import { executeBacklinkCampaignEnginePreviewHandler } from "./backlink-campaign-engine-handler";
import { validateBacklinkCampaignEngineTaskInput } from "./backlink-campaign-engine-task-validation";
import type {
  BacklinkCampaignEngineTaskHandlerDependencies,
  BacklinkCampaignEngineTaskHandlerInput,
  BacklinkCampaignEngineTaskHandlerResult,
} from "./backlink-campaign-engine-task-types";

export async function executeBacklinkCampaignEngineTaskHandler(
  input: BacklinkCampaignEngineTaskHandlerInput,
  dependencies: BacklinkCampaignEngineTaskHandlerDependencies,
): Promise<BacklinkCampaignEngineTaskHandlerResult> {
  const taskInput = validateBacklinkCampaignEngineTaskInput(input.task.input);

  return executeBacklinkCampaignEnginePreviewHandler(
    {
      workspaceId: input.workspaceId,
      runId: input.runId,
      campaignId: taskInput.campaignId,
      source: taskInput.source,
      opportunityIds: taskInput.opportunityIds,
      requestedLimits: taskInput.requestedLimits,
    },
    dependencies,
  );
}
