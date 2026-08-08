import type { BuildBacklinksDryRunPlanInput, BacklinksDryRunPlan } from "./backlinks-plan-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, name: string): void { if (!UUID_PATTERN.test(value)) throw new Error(`${name} must be a valid UUID`); }
function assertInput(value: unknown, name: string): void { if (typeof value !== "object" || value == null || Array.isArray(value)) throw new Error(`${name} must be a JSON object`); }

export function buildBacklinksDryRunPlan(input: BuildBacklinksDryRunPlanInput): BacklinksDryRunPlan {
  assertUuid(input.workspaceId, "workspaceId");
  assertUuid(input.runId, "runId");
  if (!Number.isFinite(Date.parse(input.scheduledAt))) throw new Error("scheduledAt must be a valid date");
  assertInput(input.discoveryInput, "discoveryInput");
  assertInput(input.qualificationInput, "qualificationInput");
  assertInput(input.promotionInput, "promotionInput");
  return {
    tasks: [
      {
        workspaceId: input.workspaceId,
        runId: input.runId,
        system: "backlinks",
        taskKind: "backlinks.discovery.preview",
        taskKey: "discovery-preview",
        priority: 10,
        scheduledAt: input.scheduledAt,
        availableAt: input.scheduledAt,
        input: input.discoveryInput,
        dependsOnTaskKey: null,
      },
      {
        workspaceId: input.workspaceId,
        runId: input.runId,
        system: "backlinks",
        taskKind: "backlinks.qualification.preview",
        taskKey: "qualification-preview",
        priority: 20,
        scheduledAt: input.scheduledAt,
        availableAt: input.scheduledAt,
        input: input.qualificationInput,
        dependsOnTaskKey: "discovery-preview",
      },
      {
        workspaceId: input.workspaceId,
        runId: input.runId,
        system: "backlinks",
        taskKind: "backlinks.promotion.preview",
        taskKey: "promotion-preview",
        priority: 30,
        scheduledAt: input.scheduledAt,
        availableAt: input.scheduledAt,
        input: input.promotionInput,
        dependsOnTaskKey: "qualification-preview",
      },
    ],
  };
}
