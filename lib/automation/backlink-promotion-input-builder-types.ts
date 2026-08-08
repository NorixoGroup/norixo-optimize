import type { BacklinkPromotionPreviewInputV1 } from "./backlink-promotion-types";
import type { AutomationTask } from "./types";

export type BuildBacklinkPromotionInputFromDependenciesInput = {
  promotionTask: AutomationTask;
};

export type BuildBacklinkPromotionInputFromDependenciesDependencies = {
  getTaskByIdInRun(input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }): Promise<AutomationTask | null>;
};

export type BuildBacklinkPromotionInputFromDependenciesResult = {
  qualificationTask: AutomationTask;
  discoveryTask: AutomationTask;
  promotionInput: BacklinkPromotionPreviewInputV1;
};

export type BacklinkPromotionDependencyErrorCode =
  | "BACKLINK_PROMOTION_TASK_INVALID"
  | "BACKLINK_PROMOTION_QUALIFICATION_DEPENDENCY_NOT_FOUND"
  | "BACKLINK_PROMOTION_QUALIFICATION_SCOPE_MISMATCH"
  | "BACKLINK_PROMOTION_QUALIFICATION_KIND_INVALID"
  | "BACKLINK_PROMOTION_QUALIFICATION_NOT_COMPLETED"
  | "BACKLINK_PROMOTION_QUALIFICATION_OUTPUT_INVALID"
  | "BACKLINK_PROMOTION_DISCOVERY_REFERENCE_MISSING"
  | "BACKLINK_PROMOTION_DISCOVERY_DEPENDENCY_NOT_FOUND"
  | "BACKLINK_PROMOTION_DISCOVERY_SCOPE_MISMATCH"
  | "BACKLINK_PROMOTION_DISCOVERY_KIND_INVALID"
  | "BACKLINK_PROMOTION_DISCOVERY_NOT_COMPLETED"
  | "BACKLINK_PROMOTION_DISCOVERY_OUTPUT_INVALID";

export class BacklinkPromotionDependencyError extends Error {
  readonly code: BacklinkPromotionDependencyErrorCode;

  constructor(code: BacklinkPromotionDependencyErrorCode, message: string) {
    super(message);
    this.name = "BacklinkPromotionDependencyError";
    this.code = code;
  }
}
