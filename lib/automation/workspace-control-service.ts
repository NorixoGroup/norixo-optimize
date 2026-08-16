import type {
  AutomationWorkspaceControl,
  GetOrCreateAutomationWorkspaceControlInput,
  GetOrCreateAutomationWorkspaceControlResult,
  UpdateAutomationWorkspaceControlInput,
  UpdateAutomationWorkspaceControlResult,
} from "./workspace-control-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AutomationWorkspaceControlDependencies = {
  getOrCreateControl: (
    input: GetOrCreateAutomationWorkspaceControlInput,
  ) => Promise<{
    kind: "created" | "existing";
    control: AutomationWorkspaceControl;
  }>;
  updateControl: (
    input: UpdateAutomationWorkspaceControlInput,
  ) => Promise<AutomationWorkspaceControl>;
};

function validateWorkspaceId(workspaceId: string): void {
  if (!UUID_PATTERN.test(workspaceId)) {
    throw new Error("workspaceId must be a valid UUID");
  }
}

export function canApplyBacklinkOutreachScheduling(
  control: Pick<AutomationWorkspaceControl, "backlinkOutreachScheduleApplyEnabled"> | null | undefined,
): boolean {
  return control?.backlinkOutreachScheduleApplyEnabled === true;
}

export async function getOrCreateAutomationWorkspaceControl(
  dependencies: AutomationWorkspaceControlDependencies,
  input: GetOrCreateAutomationWorkspaceControlInput,
): Promise<GetOrCreateAutomationWorkspaceControlResult> {
  validateWorkspaceId(input.workspaceId);

  const result = await dependencies.getOrCreateControl(input);
  return result;
}

export async function updateAutomationWorkspaceControl(
  dependencies: AutomationWorkspaceControlDependencies,
  input: UpdateAutomationWorkspaceControlInput,
): Promise<UpdateAutomationWorkspaceControlResult> {
  validateWorkspaceId(input.workspaceId);
  if (
    typeof input.backlinksEnabled !== "boolean" &&
    typeof input.backlinkOutreachScheduleApplyEnabled !== "boolean" &&
    typeof input.dryRunOnly !== "boolean"
  ) {
    throw new Error("At least one automation workspace control flag must be a boolean");
  }

  const control = await dependencies.updateControl(input);
  return { kind: "updated", control };
}
