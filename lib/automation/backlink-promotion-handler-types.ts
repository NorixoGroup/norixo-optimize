import type {
  BuildBacklinkPromotionInputFromDependenciesDependencies,
} from "./backlink-promotion-input-builder-types";
import type { BacklinkPromotionPolicy } from "./backlink-promotion-policy-types";
import type { BacklinkPromotionPreviewOutputV1 } from "./backlink-promotion-types";
import type { AutomationTask } from "./types";

export type ExecuteBacklinkPromotionPreviewHandlerInput = {
  task: AutomationTask;
};

export type ExecuteBacklinkPromotionPreviewHandlerDependencies = {
  getTaskByIdInRun: BuildBacklinkPromotionInputFromDependenciesDependencies["getTaskByIdInRun"];
  policy: BacklinkPromotionPolicy;
};

export type ExecuteBacklinkPromotionPreviewHandlerResult = BacklinkPromotionPreviewOutputV1;
