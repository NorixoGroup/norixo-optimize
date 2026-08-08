import {
  prepareBacklinksAutomationRun,
  type AutomationRun,
  type AutomationTask,
  type CreateAutomationTaskInput,
  type PrepareBacklinksAutomationRunDependencies,
  type PrepareBacklinksAutomationRunInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(action: () => Promise<unknown>, expected: Error, message: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error === expected, message);
    return;
  }
  throw new Error(message);
}

const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  run: "00000000-0000-4000-8000-000000000002",
  discovery: "00000000-0000-4000-8000-000000000003",
  qualification: "00000000-0000-4000-8000-000000000004",
  promotion: "00000000-0000-4000-8000-000000000005",
};
const input: PrepareBacklinksAutomationRunInput = {
  workspaceId: ids.workspace,
  requestedBy: null,
  idempotencyKey: "preview:2026-08-04",
  triggerSource: "manual",
  scheduledAt: "2026-08-04T10:00:00.000Z",
  discoveryInput: { sources: ["a"] },
  qualificationInput: { candidates: ["b"] },
  promotionInput: { source: "automation_qualification", requestedScope: "preview" },
};
const run: AutomationRun = { id: ids.run, workspaceId: ids.workspace, system: "backlinks", runKind: "backlinks.daily_preview", idempotencyKey: input.idempotencyKey, status: "queued", mode: "dry_run", triggerSource: "manual", requestedBy: null, scheduledAt: input.scheduledAt, startedAt: null, completedAt: null, failedAt: null, cancelledAt: null, heartbeatAt: null, leaseExpiresAt: null, workerId: null, attemptCount: 0, maxAttempts: 1, input: {}, summary: null, errorCode: null, errorMessage: null, createdAt: input.scheduledAt, updatedAt: input.scheduledAt };

function task(id: string): AutomationTask {
  return { id, workspaceId: ids.workspace, runId: ids.run, dependsOnTaskId: null, system: "backlinks", taskKind: "noop", taskKey: id, status: "queued", priority: 1, scheduledAt: input.scheduledAt, availableAt: input.scheduledAt, claimedAt: null, startedAt: null, heartbeatAt: null, leaseExpiresAt: null, completedAt: null, failedAt: null, cancelledAt: null, workerId: null, attemptCount: 0, maxAttempts: 3, backoffBaseSeconds: 60, input: {}, output: null, errorCode: null, errorMessage: null, createdAt: input.scheduledAt, updatedAt: input.scheduledAt };
}

const discovery = task(ids.discovery);
const qualification = task(ids.qualification);
const promotion = task(ids.promotion);

function dependencies(
  dispositions: readonly ["created" | "existing", "created" | "existing", "created" | "existing"] = ["created", "created", "created"],
): { dependencies: PrepareBacklinksAutomationRunDependencies; taskInputs: CreateAutomationTaskInput[] } {
  const taskInputs: CreateAutomationTaskInput[] = [];
  return {
    dependencies: {
      createRun: async (createRunInput) => {
        assert(
          typeof createRunInput.input === "object" && createRunInput.input !== null && !Array.isArray(createRunInput.input) &&
            createRunInput.input.discovery === input.discoveryInput &&
            createRunInput.input.qualification === input.qualificationInput &&
            createRunInput.input.promotion === input.promotionInput,
          "Run must retain all three input references",
        );
        return { kind: "created", run };
      },
      createTask: async (taskInput) => {
        taskInputs.push(taskInput);
        const index = taskInputs.length - 1;
        const tasks = [discovery, qualification, promotion] as const;
        return { kind: dispositions[index] ?? "created", task: tasks[index] ?? promotion };
      },
    },
    taskInputs,
  };
}

function assertTaskInputs(taskInputs: readonly CreateAutomationTaskInput[]): void {
  assert(taskInputs.length === 3, "Exactly three tasks must be created");
  const [discoveryInput, qualificationInput, promotionInput] = taskInputs;
  assert(discoveryInput?.taskKind === "backlinks.discovery.preview" && discoveryInput.dependsOnTaskId === null && discoveryInput.input === input.discoveryInput, "Discovery input");
  assert(qualificationInput?.taskKind === "backlinks.qualification.preview" && qualificationInput.dependsOnTaskId === discovery.id && qualificationInput.input === input.qualificationInput, "Qualification must use real Discovery ID");
  assert(promotionInput?.taskKind === "backlinks.promotion.preview" && promotionInput.dependsOnTaskId === qualification.id && promotionInput.input === input.promotionInput && promotionInput.priority === 30, "Promotion must use real Qualification ID");
}

async function main(): Promise<void> {
  const snapshot = JSON.stringify({ input, discovery, qualification, promotion });
  const nominalDependencies = dependencies();
  const nominal = await prepareBacklinksAutomationRun(nominalDependencies.dependencies, input);
  assert(nominal.kind === "prepared" && nominal.tasks.length === 3 && nominal.tasks[0].task === discovery && nominal.tasks[1].task === qualification && nominal.tasks[2].task === promotion, "Nominal result references and order");
  assertTaskInputs(nominalDependencies.taskInputs);

  for (const dispositions of [["existing", "created", "created"], ["existing", "existing", "created"], ["created", "existing", "existing"], ["existing", "existing", "existing"]] as const) {
    const scenario = dependencies(dispositions);
    const result = await prepareBacklinksAutomationRun(scenario.dependencies, input);
    assert(result.kind === "prepared" && result.tasks[0].disposition === dispositions[0] && result.tasks[1].disposition === dispositions[1] && result.tasks[2].disposition === dispositions[2], "Created/existing dispositions");
    assertTaskInputs(scenario.taskInputs);
  }

  let rejectedCalls = 0;
  const rejected = await prepareBacklinksAutomationRun({ createRun: async () => ({ kind: "rejected", reason: "automation_disabled" }), createTask: async () => { rejectedCalls += 1; return { kind: "created", task: discovery }; } }, input);
  assert(rejected.kind === "rejected" && rejectedCalls === 0, "Rejected run must create no tasks");

  const qualificationError = new Error("qualification creation failed");
  let qualificationCalls = 0;
  await assertRejects(() => prepareBacklinksAutomationRun({ createRun: async () => ({ kind: "created", run }), createTask: async () => { qualificationCalls += 1; if (qualificationCalls === 1) return { kind: "created", task: discovery }; throw qualificationError; } }, input), qualificationError, "Qualification error propagation");
  assert(qualificationCalls === 2, "Promotion must not run after qualification error");

  const promotionError = new Error("AUTOMATION_TASK_DEPENDENCY_MISMATCH");
  let promotionCalls = 0;
  await assertRejects(() => prepareBacklinksAutomationRun({ createRun: async () => ({ kind: "created", run }), createTask: async () => { promotionCalls += 1; if (promotionCalls === 1) return { kind: "created", task: discovery }; if (promotionCalls === 2) return { kind: "existing", task: qualification }; throw promotionError; } }, input), promotionError, "Promotion mismatch must propagate without compensation");
  assert(promotionCalls === 3, "Promotion is called after Discovery and Qualification");

  assert(JSON.stringify({ input, discovery, qualification, promotion }) === snapshot, "Inputs and fixtures remain immutable");
  console.log("PASS — Automation preparation service smoke");
}

void main();
