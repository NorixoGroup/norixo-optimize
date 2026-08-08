import { createAutomationTaskHandlerRegistry } from "./handler-registry";
import { executeBacklinkDiscoveryPreview } from "./backlink-discovery-handler";
import type { ExecuteBacklinkDiscoveryPreviewDependencies } from "./backlink-discovery-handler-types";
import { executeBacklinkQualificationPreviewHandler } from "./backlink-qualification-handler";
import type { ExecuteBacklinkQualificationPreviewHandlerDependencies } from "./backlink-qualification-handler-types";
import { executeBacklinkPromotionPreviewHandler } from "./backlink-promotion-handler";
import type { ExecuteBacklinkPromotionPreviewHandlerDependencies } from "./backlink-promotion-handler-types";
import { executeBacklinkCampaignEngineTaskHandler } from "./backlink-campaign-engine-task-handler";
import type { BacklinkCampaignEngineTaskHandlerDependencies } from "./backlink-campaign-engine-task-types";

type DryRunAutomationTaskHandlerDependencies =
  ExecuteBacklinkDiscoveryPreviewDependencies &
  Partial<Pick<ExecuteBacklinkQualificationPreviewHandlerDependencies, "getTaskByIdInRun">> & {
    qualificationPolicy?: ExecuteBacklinkQualificationPreviewHandlerDependencies["policy"];
    promotionPolicy?: ExecuteBacklinkPromotionPreviewHandlerDependencies["policy"];
    buildCampaignPreviewInput?: BacklinkCampaignEngineTaskHandlerDependencies["buildPreviewInput"];
    campaignPolicy?: BacklinkCampaignEngineTaskHandlerDependencies["policy"];
  };

export function createDryRunAutomationTaskHandlers(
  dependencies: DryRunAutomationTaskHandlerDependencies,
) {
  return createAutomationTaskHandlerRegistry({
    noop: async () => ({ output: { kind: "noop", dryRun: true } }),
    "backlinks.discovery.preview": async (input) =>
      executeBacklinkDiscoveryPreview(dependencies, input),
    "backlinks.qualification.preview": async (input) => {
      if (
        input.task === undefined ||
        dependencies.getTaskByIdInRun === undefined ||
        dependencies.qualificationPolicy === undefined
      ) {
        return {
          output: {
            kind: "backlinks.qualification.preview",
            dryRun: true,
            evaluatedCount: Array.isArray(input.input.candidates)
              ? input.input.candidates.length
              : Object.keys(input.input).length,
            qualifiedCount: 0,
          },
        };
      }
      return {
        output: await executeBacklinkQualificationPreviewHandler(
          { task: input.task },
          {
            getTaskByIdInRun: dependencies.getTaskByIdInRun,
            policy: dependencies.qualificationPolicy,
          },
        ),
      };
    },
    "backlinks.promotion.preview": async (input) => {
      if (
        input.task === undefined ||
        dependencies.getTaskByIdInRun === undefined ||
        dependencies.promotionPolicy === undefined
      ) {
        throw new Error("BACKLINK_PROMOTION_HANDLER_NOT_CONFIGURED");
      }
      return {
        output: await executeBacklinkPromotionPreviewHandler(
          { task: input.task },
          {
            getTaskByIdInRun: dependencies.getTaskByIdInRun,
            policy: dependencies.promotionPolicy,
          },
        ),
      };
    },
    "backlinks.campaign.preview": async (input) => {
      if (
        input.task === undefined ||
        dependencies.buildCampaignPreviewInput === undefined ||
        dependencies.campaignPolicy === undefined
      ) {
        throw new Error("BACKLINK_CAMPAIGN_ENGINE_HANDLER_NOT_CONFIGURED");
      }

      return {
        output: await executeBacklinkCampaignEngineTaskHandler(
          {
            workspaceId: input.workspaceId,
            runId: input.runId,
            task: input.task,
          },
          {
            buildPreviewInput: dependencies.buildCampaignPreviewInput,
            policy: dependencies.campaignPolicy,
          },
        ),
      };
    },
  });
}

export const dryRunAutomationTaskHandlers = createDryRunAutomationTaskHandlers({
  providers: {},
});
