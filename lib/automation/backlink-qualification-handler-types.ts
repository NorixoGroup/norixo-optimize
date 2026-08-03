import type {
  BuildBacklinkQualificationInputFromDependencyDependencies,
} from "./backlink-qualification-input-builder-types";
import type { BacklinkQualificationPolicy, BacklinkQualificationPreviewOutputV1 } from "./backlink-qualification-types";
import type { AutomationTask } from "./types";

export type ExecuteBacklinkQualificationPreviewHandlerInput = {
  task: AutomationTask;
};

export type ExecuteBacklinkQualificationPreviewHandlerDependencies = {
  getTaskByIdInRun: BuildBacklinkQualificationInputFromDependencyDependencies["getTaskByIdInRun"];
  policy: BacklinkQualificationPolicy;
};

export type ExecuteBacklinkQualificationPreviewHandlerResult =
  BacklinkQualificationPreviewOutputV1;
