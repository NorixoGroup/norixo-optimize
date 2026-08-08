import { executeBacklinkCampaignEnginePreview } from "./backlink-campaign-engine-preview";
import {
  BacklinkCampaignEngineHandlerError,
  type ExecuteBacklinkCampaignEnginePreviewHandlerDependencies,
  type ExecuteBacklinkCampaignEnginePreviewHandlerInput,
  type ExecuteBacklinkCampaignEnginePreviewHandlerResult,
} from "./backlink-campaign-engine-handler-types";

export async function executeBacklinkCampaignEnginePreviewHandler(
  input: ExecuteBacklinkCampaignEnginePreviewHandlerInput,
  dependencies: ExecuteBacklinkCampaignEnginePreviewHandlerDependencies,
): Promise<ExecuteBacklinkCampaignEnginePreviewHandlerResult> {
  assertDependencies(dependencies);
  const built = await dependencies.buildPreviewInput(input);
  return executeBacklinkCampaignEnginePreview({
    input: built.previewInput,
    policy: dependencies.policy,
  });
}

function assertDependencies(
  dependencies: ExecuteBacklinkCampaignEnginePreviewHandlerDependencies,
): void {
  if (
    typeof dependencies.buildPreviewInput !== "function" ||
    typeof dependencies.policy !== "object" ||
    dependencies.policy === null ||
    Array.isArray(dependencies.policy)
  ) {
    throw new BacklinkCampaignEngineHandlerError();
  }
}
