import { buildBacklinkCampaignRunPlan } from "../lib/automation/backlink-campaign-run-plan";
import type { BuildBacklinkCampaignRunPlanInput } from "../lib/automation/backlink-campaign-run-plan-types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      // @ts-expect-error runtime check
      deepFreeze(value[key]);
    }
  }
  return value;
}

function isJsonAssignable(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonAssignable);
  if (typeof value === "object") return Object.values(value).every(isJsonAssignable);
  return false;
}

async function main(): Promise<void> {
  const input: BuildBacklinkCampaignRunPlanInput = {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    scheduledAt: "2026-08-05T10:00:00.000Z",
    campaignTaskInput: {
      version: 1,
      campaignId: "00000000-0000-4000-8000-000000000010",
      source: "automation_campaign",
      opportunityIds: ["00000000-0000-4000-8000-000000000011"],
      requestedLimits: {
        maxSelectedOpportunities: 5,
        maxPerDomain: 2,
      },
    },
  };

  const plan = buildBacklinkCampaignRunPlan(input);

  assert(Array.isArray(plan.tasks), "Plan tasks must be an array");
  assert(plan.tasks.length === 1, "Plan must contain exactly one task");

  const task = plan.tasks[0];
  assert(task.workspaceId === input.workspaceId, "workspaceId must match");
  assert(task.runId === input.runId, "runId must match");
  assert(task.taskKind === "backlinks.campaign.preview", "taskKind must be backlinks.campaign.preview");
  assert(task.taskKey === "campaign-preview", "taskKey must be campaign-preview");
  assert(task.priority === 100, "priority must be 100");
  assert(task.scheduledAt === input.scheduledAt, "scheduledAt must match input");
  assert(task.availableAt === input.scheduledAt, "availableAt must equal scheduledAt");
  assert(task.dependsOnTaskKey === null, "dependsOnTaskKey must be null");
  assert(task.input === input.campaignTaskInput, "input must be exact campaignTaskInput reference");
  assert(isJsonAssignable(task.input), "task input must be JSON-assignable");

  const firstPlan = deepFreeze(plan);
  const secondPlan = buildBacklinkCampaignRunPlan(input);

  assert(JSON.stringify(firstPlan) === JSON.stringify(secondPlan), "Plan must be deterministic");

  try {
    (firstPlan as any).tasks = [];
  } catch {
    // Expected on frozen objects
  }

  assert(firstPlan.tasks.length === 1, "Frozen plan must still contain one task");

  console.log("PASS — Automation backlink campaign run plan smoke");
}

void main();
