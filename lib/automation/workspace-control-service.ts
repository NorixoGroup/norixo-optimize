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

function assertDryRunOnly(control: AutomationWorkspaceControl): void {
  if (control.dryRunOnly !== true) {
    throw new Error("AUTOMATION_WORKSPACE_CONTROL_DRY_RUN_REQUIRED");
  }
}

export async function getOrCreateAutomationWorkspaceControl(
  dependencies: AutomationWorkspaceControlDependencies,
  input: GetOrCreateAutomationWorkspaceControlInput,
): Promise<GetOrCreateAutomationWorkspaceControlResult> {
  validateWorkspaceId(input.workspaceId);

  const result = await dependencies.getOrCreateControl(input);
  assertDryRunOnly(result.control);
  return result;
}

export async function updateAutomationWorkspaceControl(
  dependencies: AutomationWorkspaceControlDependencies,
  input: UpdateAutomationWorkspaceControlInput,
): Promise<UpdateAutomationWorkspaceControlResult> {
  validateWorkspaceId(input.workspaceId);
  if (typeof input.backlinksEnabled !== "boolean") {
    throw new Error("backlinksEnabled must be a boolean");
  }

  const control = await dependencies.updateControl(input);
  assertDryRunOnly(control);
  return { kind: "updated", control };
}
