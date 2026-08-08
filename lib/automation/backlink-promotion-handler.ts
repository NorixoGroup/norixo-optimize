import { buildBacklinkPromotionInputFromDependencies } from "./backlink-promotion-input-builder";
import { executeBacklinkPromotionPreview } from "./backlink-promotion-preview";
import type {
  ExecuteBacklinkPromotionPreviewHandlerDependencies,
  ExecuteBacklinkPromotionPreviewHandlerInput,
  ExecuteBacklinkPromotionPreviewHandlerResult,
} from "./backlink-promotion-handler-types";

export async function executeBacklinkPromotionPreviewHandler(
  input: ExecuteBacklinkPromotionPreviewHandlerInput,
  dependencies: ExecuteBacklinkPromotionPreviewHandlerDependencies,
): Promise<ExecuteBacklinkPromotionPreviewHandlerResult> {
  const built = await buildBacklinkPromotionInputFromDependencies(
    { promotionTask: input.task },
    { getTaskByIdInRun: dependencies.getTaskByIdInRun },
  );
  return executeBacklinkPromotionPreview({
    input: built.promotionInput,
    policy: dependencies.policy,
  });
}
