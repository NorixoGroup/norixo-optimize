import type { BacklinkQualificationPreviewInputV1 } from "./backlink-qualification-types";
import type { AutomationTask } from "./types";

export type BuildBacklinkQualificationInputFromDependencyInput = {
  qualificationTask: AutomationTask;
};

export type BuildBacklinkQualificationInputFromDependencyDependencies = {
  getTaskByIdInRun(input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }): Promise<AutomationTask | null>;
};

export type BuildBacklinkQualificationInputFromDependencyResult = {
  discoveryTask: AutomationTask;
  qualificationInput: BacklinkQualificationPreviewInputV1;
};

export type BacklinkQualificationDependencyErrorCode =
  | "BACKLINK_QUALIFICATION_TASK_INVALID"
  | "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND"
  | "BACKLINK_QUALIFICATION_DEPENDENCY_SCOPE_MISMATCH"
  | "BACKLINK_QUALIFICATION_DEPENDENCY_NOT_COMPLETED"
  | "BACKLINK_QUALIFICATION_DEPENDENCY_KIND_INVALID"
  | "BACKLINK_QUALIFICATION_DEPENDENCY_OUTPUT_INVALID"
  | "BACKLINK_QUALIFICATION_DISCOVERY_INPUT_INVALID"
  | "BACKLINK_QUALIFICATION_INTERNAL_INVARIANT";

export class BacklinkQualificationDependencyError extends Error {
  readonly code: BacklinkQualificationDependencyErrorCode;

  constructor(code: BacklinkQualificationDependencyErrorCode, message: string) {
    super(message);
    this.name = "BacklinkQualificationDependencyError";
    this.code = code;
  }
}
