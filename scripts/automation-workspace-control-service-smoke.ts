import {
  canApplyBacklinkOutreachScheduling,
  getOrCreateAutomationWorkspaceControl,
  updateAutomationWorkspaceControl,
  type AutomationWorkspaceControl,
  type GetOrCreateAutomationWorkspaceControlInput,
  type UpdateAutomationWorkspaceControlInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(
  run: () => Promise<unknown>,
  expected: string | Error,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (expected instanceof Error) {
      assert(error === expected, "Expected the same error instance");
    } else {
      assert(error instanceof Error, "Expected an Error");
      assert(error.message === expected, `Expected ${expected}`);
    }
    return;
  }

  throw new Error("Expected rejection");
}

const workspaceA = "00000000-0000-4000-8000-000000000001";
const workspaceB = "00000000-0000-4000-8000-000000000002";
const createdAt = "2026-08-04T10:00:00.000Z";

function control(
  workspaceId: string,
  backlinksEnabled: boolean,
  backlinkOutreachScheduleApplyEnabled = false,
): AutomationWorkspaceControl {
  return {
    workspaceId,
    backlinksEnabled,
    backlinkOutreachScheduleApplyEnabled,
    dryRunOnly: true,
    lastScheduleApplyAttemptAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

async function main(): Promise<void> {
  const createInput: GetOrCreateAutomationWorkspaceControlInput = {
    workspaceId: workspaceA,
  };
  const createdControl = control(workspaceA, false);
  let createCalls = 0;
  const created = await getOrCreateAutomationWorkspaceControl(
    {
      getOrCreateControl: async (input) => {
        createCalls += 1;
        assert(input === createInput, "Get-or-create input reference changed");
        assert(input.workspaceId === workspaceA, "Get-or-create workspace changed");
        return { kind: "created", control: createdControl };
      },
      updateControl: async () => createdControl,
    },
    createInput,
  );
  assert(createCalls === 1, "Get-or-create must be called once");
  assert(created.kind === "created", "Expected created result");
  assert(created.control === createdControl, "Created control reference changed");
  assert(createInput.workspaceId === workspaceA, "Create input mutated");
  assert(createdControl.backlinksEnabled === false, "Created control mutated");

  const existingControl = control(workspaceA, true);
  const existing = await getOrCreateAutomationWorkspaceControl(
    {
      getOrCreateControl: async () => ({ kind: "existing", control: existingControl }),
      updateControl: async () => existingControl,
    },
    createInput,
  );
  assert(existing.kind === "existing", "Expected existing result");
  assert(existing.control === existingControl, "Existing control reference changed");

  for (const backlinksEnabled of [true, false]) {
    const updateInput: UpdateAutomationWorkspaceControlInput = {
      workspaceId: workspaceA,
      backlinksEnabled,
    };
    const updatedControl = control(workspaceA, backlinksEnabled);
    let updateCalls = 0;
    const updated = await updateAutomationWorkspaceControl(
      {
        getOrCreateControl: async () => ({ kind: "existing", control: updatedControl }),
        updateControl: async (input) => {
          updateCalls += 1;
          assert(input === updateInput, "Update input reference changed");
          assert(input.workspaceId === workspaceA, "Update workspace changed");
          assert(input.backlinksEnabled === backlinksEnabled, "Update flag changed");
          return updatedControl;
        },
      },
      updateInput,
    );
    assert(updateCalls === 1, "Update must be called once");
    assert(updated.kind === "updated", "Expected updated result");
    assert(updated.control === updatedControl, "Updated control reference changed");
    assert(updateInput.backlinksEnabled === backlinksEnabled, "Update input mutated");
  }

  const capabilityEnabledInput: UpdateAutomationWorkspaceControlInput = {
    workspaceId: workspaceA,
    backlinkOutreachScheduleApplyEnabled: true,
  };
  const capabilityEnabledControl = control(workspaceA, true, true);
  const capabilityEnabled = await updateAutomationWorkspaceControl(
    {
      getOrCreateControl: async () => ({ kind: "existing", control: capabilityEnabledControl }),
      updateControl: async (input) => {
        assert(input.workspaceId === workspaceA, "Capability update workspace changed");
        assert(input.backlinkOutreachScheduleApplyEnabled === true, "Capability flag changed");
        assert(input.backlinksEnabled === undefined, "Capability-only update must not force backlinksEnabled");
        return capabilityEnabledControl;
      },
    },
    capabilityEnabledInput,
  );
  assert(capabilityEnabled.kind === "updated", "Expected capability update result");
  assert(
    capabilityEnabled.control.backlinkOutreachScheduleApplyEnabled === true,
    "Capability update must persist the flag",
  );
  assert(
    canApplyBacklinkOutreachScheduling(capabilityEnabled.control) === true,
    "Capability helper must detect enabled apply support",
  );

  assert(
    canApplyBacklinkOutreachScheduling(control(workspaceA, true, false)) === false,
    "Capability helper must remain false by default",
  );

  const invalidCreatedControl = control(workspaceA, false);
  Reflect.set(invalidCreatedControl, "dryRunOnly", false);
  await assertRejects(
    () =>
      getOrCreateAutomationWorkspaceControl(
        {
          getOrCreateControl: async () => ({
            kind: "created",
            control: invalidCreatedControl,
          }),
          updateControl: async () => invalidCreatedControl,
        },
        createInput,
      ),
    "AUTOMATION_WORKSPACE_CONTROL_DRY_RUN_REQUIRED",
  );

  const invalidUpdatedControl = control(workspaceA, false);
  Reflect.set(invalidUpdatedControl, "dryRunOnly", false);
  await assertRejects(
    () =>
      updateAutomationWorkspaceControl(
        {
          getOrCreateControl: async () => ({
            kind: "existing",
            control: invalidUpdatedControl,
          }),
          updateControl: async () => invalidUpdatedControl,
        },
        { workspaceId: workspaceA, backlinksEnabled: false },
      ),
    "AUTOMATION_WORKSPACE_CONTROL_DRY_RUN_REQUIRED",
  );

  const getError = new Error("get-or-create failure");
  await assertRejects(
    () =>
      getOrCreateAutomationWorkspaceControl(
        {
          getOrCreateControl: async () => {
            throw getError;
          },
          updateControl: async () => createdControl,
        },
        createInput,
      ),
    getError,
  );
  const updateError = new Error("update failure");
  await assertRejects(
    () =>
      updateAutomationWorkspaceControl(
        {
          getOrCreateControl: async () => ({ kind: "existing", control: createdControl }),
          updateControl: async () => {
            throw updateError;
          },
        },
        { workspaceId: workspaceA, backlinksEnabled: true },
      ),
    updateError,
  );

  for (const workspaceId of ["", "   ", "not-a-uuid"]) {
    let calls = 0;
    await assertRejects(
      () =>
        getOrCreateAutomationWorkspaceControl(
          {
            getOrCreateControl: async () => {
              calls += 1;
              return { kind: "created", control: createdControl };
            },
            updateControl: async () => createdControl,
          },
          { workspaceId },
        ),
      "workspaceId must be a valid UUID",
    );
    assert(calls === 0, "Invalid workspace must not call get-or-create");
  }

  const controls = [control(workspaceA, true), control(workspaceB, false)];
  let independentCalls = 0;
  const independentDependencies = {
    getOrCreateControl: async (input: GetOrCreateAutomationWorkspaceControlInput) => {
      const next = controls[independentCalls];
      independentCalls += 1;
      assert(input.workspaceId === next.workspaceId, "Workspace state leaked");
      return { kind: "existing" as const, control: next };
    },
    updateControl: async () => controls[0],
  };
  const first = await getOrCreateAutomationWorkspaceControl(
    independentDependencies,
    { workspaceId: workspaceA },
  );
  const second = await getOrCreateAutomationWorkspaceControl(
    independentDependencies,
    { workspaceId: workspaceB },
  );
  assert(first.control === controls[0], "First independent control changed");
  assert(second.control === controls[1], "Second independent control changed");
  assert(independentCalls === 2, "Independent calls mismatch");

  console.log("PASS — Automation workspace control service smoke");
}

void main();
