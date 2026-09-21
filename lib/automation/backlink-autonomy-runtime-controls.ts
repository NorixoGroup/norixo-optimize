import type { AutomationWorkspaceControl } from "./types";
import type { BacklinkAutonomyRuntimeConfig } from "./backlink-autonomy-runtime-config";

export type BacklinkAutonomyRuntimeControl = {
  backlinksEnabled: boolean;
  disabledReason: string | null;
  backlinkAutonomyEnabled: boolean;
  campaignApplyAuthorized: boolean;
  /** G1Y intentionally has no configuration path capable of setting this true. */
  liveExecutionAuthorized: false;
  dryRunOnly: boolean;
};

/**
 * Campaign authorization is a per-operation human confirmation fact. It is
 * deliberately not inferred from the legacy schedule capability or dry-run.
 */
export function normalizeBacklinkAutonomyRuntimeControl(input: {
  runtime: BacklinkAutonomyRuntimeConfig;
  workspace: AutomationWorkspaceControl | null | undefined;
  campaignApplyAuthorized?: boolean;
}): BacklinkAutonomyRuntimeControl {
  const workspace = input.workspace;
  const disabledReason = workspace?.disabledReason === null
    ? null
    : workspace?.disabledReason ?? "AUTONOMY_CONTROL_MISSING_OR_DISABLED";
  const autonomyEnabled = input.runtime.autonomyEnabled === true &&
    workspace?.backlinksEnabled === true &&
    workspace?.backlinkAutonomyEnabled === true &&
    workspace?.disabledReason === null;
  return {
    backlinksEnabled: workspace?.backlinksEnabled === true,
    disabledReason,
    backlinkAutonomyEnabled: autonomyEnabled,
    campaignApplyAuthorized: input.campaignApplyAuthorized === true,
    liveExecutionAuthorized: false,
    dryRunOnly: workspace?.dryRunOnly === true,
  };
}
