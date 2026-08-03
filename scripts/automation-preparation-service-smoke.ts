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

async function assertRejects(
  action: () => Promise<unknown>,
  expected: Error,
  message: string,
): Promise<void> {
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
};
const input: PrepareBacklinksAutomationRunInput = {
  workspaceId: ids.workspace,
  requestedBy: null,
  idempotencyKey: "preview:2026-08-04",
  triggerSource: "manual",
  scheduledAt: "2026-08-04T10:00:00.000Z",
  discoveryInput: { sources: ["a"] },
  qualificationInput: { candidates: ["b"] },
};
const run: AutomationRun = {
  id: ids.run,
  workspaceId: ids.workspace,
  system: "backlinks",
  runKind: "backlinks.daily_preview",
  idempotencyKey: input.idempotencyKey,
  status: "queued",
  mode: "dry_run",
  triggerSource: "manual",
  requestedBy: null,
  scheduledAt: input.scheduledAt,
  startedAt: null,
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
  heartbeatAt: null,
  leaseExpiresAt: null,
  workerId: null,
  attemptCount: 0,
  maxAttempts: 1,
  input: {},
  summary: null,
  errorCode: null,
  errorMessage: null,
  createdAt: input.scheduledAt,
  updatedAt: input.scheduledAt,
};

function task(id: string): AutomationTask {
  return {
    id,
    workspaceId: ids.workspace,
    runId: ids.run,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "noop",
    taskKey: id,
    status: "queued",
    priority: 1,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    claimedAt: null,
    startedAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    workerId: null,
    attemptCount: 0,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: null,
    errorCode: null,
    errorMessage: null,
    createdAt: input.scheduledAt,
    updatedAt: input.scheduledAt,
  };
}

const discovery = task(ids.discovery);
const qualification = task(ids.qualification);

function dependencies(
  runResult: "created" | "existing" = "created",
  discoveryResult: "created" | "existing" = "created",
  qualificationResult: "created" | "existing" = "created",
): {
  dependencies: PrepareBacklinksAutomationRunDependencies;
  taskInputs: CreateAutomationTaskInput[];
  getRunCalls: () => number;
} {
  const taskInputs: CreateAutomationTaskInput[] = [];
  let runCalls = 0;
  return {
    dependencies: {
      createRun: async (createRunInput) => {
        runCalls += 1;
        const runInput = createRunInput.input;
        assert(
          typeof runInput === "object" &&
            runInput !== null &&
            !Array.isArray(runInput) &&
            runInput.discovery === input.discoveryInput &&
            runInput.qualification === input.qualificationInput,
          "run input must preserve plan input references",
        );
        return { kind: runResult, run };
      },
      createTask: async (createTaskInput) => {
        taskInputs.push(createTaskInput);
        return taskInputs.length === 1
          ? { kind: discoveryResult, task: discovery }
          : { kind: qualificationResult, task: qualification };
      },
    },
    taskInputs,
    getRunCalls: () => runCalls,
  };
}

function assertTaskInputs(inputs: readonly CreateAutomationTaskInput[]): void {
  assert(inputs.length === 2, "exactly two task creates are required");
  const [discoveryInput, qualificationInput] = inputs;
  assert(
    discoveryInput?.taskKind === "backlinks.discovery.preview" &&
      discoveryInput.taskKey === "discovery-preview" &&
      discoveryInput.priority === 10 &&
      discoveryInput.dependsOnTaskId === null &&
      discoveryInput.input === input.discoveryInput,
    "discovery task input must remain unchanged except for explicit null dependency",
  );
  assert(
    qualificationInput?.taskKind === "backlinks.qualification.preview" &&
      qualificationInput.taskKey === "qualification-preview" &&
      qualificationInput.priority === 20 &&
      qualificationInput.dependsOnTaskId === discovery.id &&
      qualificationInput.input === input.qualificationInput,
    "qualification must depend on the real discovery task id",
  );
}

async function main(): Promise<void> {
  const inputSnapshot = JSON.stringify(input);
  const discoverySnapshot = JSON.stringify(discovery);
  const qualificationSnapshot = JSON.stringify(qualification);
  const nominalDependencies = dependencies();
  const nominal = await prepareBacklinksAutomationRun(
    nominalDependencies.dependencies,
    input,
  );
  assert(
    nominal.kind === "prepared" &&
      nominal.run === run &&
      nominal.runDisposition === "created" &&
      nominal.tasks[0].disposition === "created" &&
      nominal.tasks[1].disposition === "created" &&
      nominal.tasks[0].task === discovery &&
      nominal.tasks[1].task === qualification,
    "created run and tasks must retain historical result references",
  );
  assert(nominalDependencies.getRunCalls() === 1, "run must be created exactly once");
  assertTaskInputs(nominalDependencies.taskInputs);

  for (const [discoveryDisposition, qualificationDisposition] of [
    ["existing", "existing"],
    ["existing", "created"],
    ["created", "existing"],
  ] as const) {
    const scenario = dependencies(
      "existing",
      discoveryDisposition,
      qualificationDisposition,
    );
    const result = await prepareBacklinksAutomationRun(scenario.dependencies, input);
    assert(
      result.kind === "prepared" &&
        result.runDisposition === "existing" &&
        result.tasks[0].disposition === discoveryDisposition &&
        result.tasks[1].disposition === qualificationDisposition,
      "created and existing dispositions must remain exact",
    );
    assertTaskInputs(scenario.taskInputs);
  }

  let rejectedTaskCalls = 0;
  const rejected = await prepareBacklinksAutomationRun(
    {
      createRun: async () => ({ kind: "rejected", reason: "automation_disabled" }),
      createTask: async () => {
        rejectedTaskCalls += 1;
        return { kind: "created", task: discovery };
      },
    },
    input,
  );
  assert(rejected.kind === "rejected" && rejectedTaskCalls === 0, "rejected run creates no task");

  const discoveryError = new Error("discovery creation failed");
  let discoveryErrorTaskCalls = 0;
  await assertRejects(
    () =>
      prepareBacklinksAutomationRun(
        {
          createRun: async () => ({ kind: "created", run }),
          createTask: async () => {
            discoveryErrorTaskCalls += 1;
            throw discoveryError;
          },
        },
        input,
      ),
    discoveryError,
    "discovery error must propagate by identity",
  );
  assert(discoveryErrorTaskCalls === 1, "qualification must not be called after discovery failure");

  const qualificationError = new Error("qualification creation failed");
  let qualificationErrorTaskCalls = 0;
  await assertRejects(
    () =>
      prepareBacklinksAutomationRun(
        {
          createRun: async () => ({ kind: "created", run }),
          createTask: async () => {
            qualificationErrorTaskCalls += 1;
            if (qualificationErrorTaskCalls === 1) return { kind: "created", task: discovery };
            throw qualificationError;
          },
        },
        input,
      ),
    qualificationError,
    "qualification error must propagate by identity without compensation",
  );
  assert(qualificationErrorTaskCalls === 2, "qualification must be called once after discovery");

  const mismatchError = new Error("AUTOMATION_TASK_DEPENDENCY_MISMATCH");
  await assertRejects(
    () =>
      prepareBacklinksAutomationRun(
        {
          createRun: async () => ({ kind: "created", run }),
          createTask: async (createTaskInput) => {
            if (createTaskInput.dependsOnTaskId === null) {
              return { kind: "created", task: discovery };
            }
            throw mismatchError;
          },
        },
        input,
      ),
    mismatchError,
    "repository dependency mismatch must propagate unchanged",
  );

  assert(JSON.stringify(input) === inputSnapshot, "preparation input must remain immutable");
  assert(JSON.stringify(discovery) === discoverySnapshot, "discovery fixture must remain immutable");
  assert(
    JSON.stringify(qualification) === qualificationSnapshot,
    "qualification fixture must remain immutable",
  );
  console.log("PASS — Automation preparation service smoke");
}

void main();
