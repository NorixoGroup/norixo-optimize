import type { Json } from "@/types/database.types";
import { buildBacklinksDryRunPlan } from "./backlinks-plan";
import type {
  PrepareBacklinksAutomationRunDependencies,
  PrepareBacklinksAutomationRunInput,
  PrepareBacklinksAutomationRunResult,
  PreparedBacklinksAutomationTask,
} from "./preparation-types";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(i:PrepareBacklinksAutomationRunInput){if(!UUID.test(i.workspaceId))throw new Error("workspaceId must be a valid UUID");if(i.requestedBy!==null&&!UUID.test(i.requestedBy))throw new Error("requestedBy must be a valid UUID");if(!i.idempotencyKey.trim()||i.idempotencyKey!==i.idempotencyKey.trim()||i.idempotencyKey.length>255)throw new Error("idempotencyKey must be trimmed and at most 255 characters");if(!["manual","scheduled","internal"].includes(i.triggerSource))throw new Error("triggerSource must be valid");if(!Number.isFinite(Date.parse(i.scheduledAt)))throw new Error("scheduledAt must be a valid date");for(const [v,n] of [[i.discoveryInput,"discoveryInput"],[i.qualificationInput,"qualificationInput"],[i.promotionInput,"promotionInput"]] as const)if(typeof v!=="object"||v==null||Array.isArray(v))throw new Error(`${n} must be a JSON object`)}
function assertPlainPlan(plan: { tasks: readonly { taskKey: string; taskKind: string; workspaceId: string; runId: string; scheduledAt: string; availableAt: string; priority: number; input: Record<string, Json>; dependsOnTaskKey: string | null }[] }): void {
  const seen = new Set<string>();
  let previousKeys = new Set<string>();
  for (const task of plan.tasks) {
    if (!task.taskKey.trim()) throw new Error("BACKLINKS_AUTOMATION_PLAN_INVALID");
    if (seen.has(task.taskKey)) throw new Error("BACKLINKS_AUTOMATION_PLAN_INVALID");
    if (task.taskKey === task.dependsOnTaskKey) throw new Error("BACKLINKS_AUTOMATION_PLAN_INVALID");
    if (task.dependsOnTaskKey !== null && !previousKeys.has(task.dependsOnTaskKey)) {
      throw new Error("BACKLINKS_AUTOMATION_PLAN_INVALID");
    }
    seen.add(task.taskKey);
    previousKeys.add(task.taskKey);
  }
}

export async function prepareBacklinksAutomationRun(
  d: PrepareBacklinksAutomationRunDependencies,
  i: PrepareBacklinksAutomationRunInput,
): Promise<PrepareBacklinksAutomationRunResult> {
  validate(i);
  const created = await d.createRun({
    workspaceId: i.workspaceId,
    system: "backlinks",
    runKind: "backlinks.daily_preview",
    idempotencyKey: i.idempotencyKey,
    mode: "dry_run",
    triggerSource: i.triggerSource,
    requestedBy: i.requestedBy,
    scheduledAt: i.scheduledAt,
    input: { discovery: i.discoveryInput, qualification: i.qualificationInput, promotion: i.promotionInput },
  });
  if (created.kind === "rejected") return created;

  const plan = buildBacklinksDryRunPlan({
    workspaceId: i.workspaceId,
    runId: created.run.id,
    scheduledAt: i.scheduledAt,
    discoveryInput: i.discoveryInput,
    qualificationInput: i.qualificationInput,
    promotionInput: i.promotionInput,
  });

  assertPlainPlan(plan);

  const createdTasks = new Map<string, PreparedBacklinksAutomationTask>();
  const results: PreparedBacklinksAutomationTask[] = [];

  for (const plannedTask of plan.tasks) {
    const dependsOnTaskId = plannedTask.dependsOnTaskKey === null
      ? null
      : (() => {
          const dependency = createdTasks.get(plannedTask.dependsOnTaskKey);
          if (!dependency) {
            throw new Error("BACKLINKS_AUTOMATION_PLAN_INVALID");
          }
          return dependency.task.id;
        })();

    const createdTask = await d.createTask({
      ...plannedTask,
      dependsOnTaskId,
      maxAttempts: 3,
      backoffBaseSeconds: 60,
    });

    const preparedTask: PreparedBacklinksAutomationTask = {
      disposition: createdTask.kind,
      task: createdTask.task,
    };

    createdTasks.set(plannedTask.taskKey, preparedTask);
    results.push(preparedTask);
  }

  return {
    kind: "prepared",
    run: created.run,
    runDisposition: created.kind,
    tasks: results,
  };
}
