import { buildBacklinksDryRunPlan, type BuildBacklinksDryRunPlanInput } from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(operation: () => void, message: string): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(message), message);
    return;
  }
  throw new Error("Expected throw");
}

const input: BuildBacklinksDryRunPlanInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  scheduledAt: "2026-08-04T10:00:00.000Z",
  discoveryInput: { sources: ["seed"] },
  qualificationInput: { candidates: ["candidate"] },
  promotionInput: { source: "automation_qualification", requestedScope: "preview" },
};

function main(): void {
  const before = JSON.stringify(input);
  const first = buildBacklinksDryRunPlan(input);
  const second = buildBacklinksDryRunPlan(input);
  assert(first.tasks.length === 3, "Plan must contain exactly three tasks");
  const [discovery, qualification, promotion] = first.tasks;
  assert(
    discovery.taskKind === "backlinks.discovery.preview" &&
      discovery.taskKey === "discovery-preview" &&
      discovery.priority === 10 &&
      discovery.input === input.discoveryInput,
    "Discovery task must be first",
  );
  assert(
    qualification.taskKind === "backlinks.qualification.preview" &&
      qualification.taskKey === "qualification-preview" &&
      qualification.priority === 20 &&
      qualification.input === input.qualificationInput,
    "Qualification task must be second",
  );
  assert(
    promotion.taskKind === "backlinks.promotion.preview" &&
      promotion.taskKey === "promotion-preview" &&
      promotion.priority === 30 &&
      promotion.input === input.promotionInput,
    "Promotion task must be third",
  );
  for (const task of first.tasks) {
    assert(task.workspaceId === input.workspaceId && task.runId === input.runId, "Plan scope must be exact");
    assert(task.system === "backlinks" && task.scheduledAt === input.scheduledAt && task.availableAt === input.scheduledAt, "Plan dates must be preserved");
    assert(!Object.hasOwn(task, "dependsOnTaskId"), "Pure plan must not contain concrete dependencies");
  }
  assert(first.tasks[0].dependsOnTaskKey === null, "Discovery must not depend on another task");
  assert(first.tasks[1].dependsOnTaskKey === "discovery-preview", "Qualification must depend on Discovery by key");
  assert(first.tasks[2].dependsOnTaskKey === "qualification-preview", "Promotion must depend on Qualification by key");
  assert(
    JSON.stringify(first) === JSON.stringify(second) &&
      second.tasks[0].input === input.discoveryInput &&
      second.tasks[1].input === input.qualificationInput &&
      second.tasks[2].input === input.promotionInput,
    "Plans must be deterministic and retain input references",
  );
  assert(JSON.stringify(input) === before, "Plan input must remain immutable");
  assertThrows(() => buildBacklinksDryRunPlan({ ...input, workspaceId: "bad" }), "workspaceId must be a valid UUID");
  const other = buildBacklinksDryRunPlan({
    ...input,
    workspaceId: "00000000-0000-4000-8000-000000000003",
    runId: "00000000-0000-4000-8000-000000000004",
    discoveryInput: {},
    qualificationInput: {},
    promotionInput: {},
  });
  assert(other.tasks[0].workspaceId !== discovery.workspaceId && other.tasks[2].input !== promotion.input, "Plans must remain independent");
  console.log("PASS — Automation Backlinks dry-run plan smoke");
}

main();
