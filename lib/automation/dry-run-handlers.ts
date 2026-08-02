import { createAutomationTaskHandlerRegistry } from "./handler-registry";
import { executeBacklinkDiscoveryPreview } from "./backlink-discovery-handler";
import type { ExecuteBacklinkDiscoveryPreviewDependencies } from "./backlink-discovery-handler-types";

export function createDryRunAutomationTaskHandlers(
  dependencies: ExecuteBacklinkDiscoveryPreviewDependencies,
) {
  return createAutomationTaskHandlerRegistry({
    noop: async () => ({ output: { kind: "noop", dryRun: true } }),
    "backlinks.discovery.preview": async (input) =>
      executeBacklinkDiscoveryPreview(dependencies, input),
    "backlinks.qualification.preview": async (input) => ({
      output: {
        kind: "backlinks.qualification.preview",
        dryRun: true,
        evaluatedCount: Array.isArray(input.input.candidates)
          ? input.input.candidates.length
          : Object.keys(input.input).length,
        qualifiedCount: 0,
      },
    }),
  });
}

export const dryRunAutomationTaskHandlers = createDryRunAutomationTaskHandlers({
  providers: {},
});
