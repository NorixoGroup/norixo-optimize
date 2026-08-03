import { buildBacklinkQualificationInputFromDependency } from "./backlink-qualification-input-builder";
import { executeBacklinkQualificationPreview } from "./backlink-qualification-preview";
import type {
  ExecuteBacklinkQualificationPreviewHandlerDependencies,
  ExecuteBacklinkQualificationPreviewHandlerInput,
  ExecuteBacklinkQualificationPreviewHandlerResult,
} from "./backlink-qualification-handler-types";

export async function executeBacklinkQualificationPreviewHandler(
  input: ExecuteBacklinkQualificationPreviewHandlerInput,
  dependencies: ExecuteBacklinkQualificationPreviewHandlerDependencies,
): Promise<ExecuteBacklinkQualificationPreviewHandlerResult> {
  const built = await buildBacklinkQualificationInputFromDependency(
    { qualificationTask: input.task },
    { getTaskByIdInRun: dependencies.getTaskByIdInRun },
  );
  return executeBacklinkQualificationPreview({
    input: built.qualificationInput,
    policy: dependencies.policy,
  });
}
