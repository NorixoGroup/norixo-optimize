import { createAutomationTaskHandlerRegistry } from "./handler-registry";
import { executeBacklinkDiscoveryPreview } from "./backlink-discovery-handler";
import type { ExecuteBacklinkDiscoveryPreviewDependencies } from "./backlink-discovery-handler-types";
import { executeBacklinkQualificationPreviewHandler } from "./backlink-qualification-handler";
import type { ExecuteBacklinkQualificationPreviewHandlerDependencies } from "./backlink-qualification-handler-types";

type DryRunAutomationTaskHandlerDependencies =
  ExecuteBacklinkDiscoveryPreviewDependencies &
  Partial<Pick<ExecuteBacklinkQualificationPreviewHandlerDependencies, "getTaskByIdInRun">> & {
    qualificationPolicy?: ExecuteBacklinkQualificationPreviewHandlerDependencies["policy"];
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
  });
}

export const dryRunAutomationTaskHandlers = createDryRunAutomationTaskHandlers({
  providers: {},
});
