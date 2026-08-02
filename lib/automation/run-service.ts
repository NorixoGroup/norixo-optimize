import type { CreateAutomationRunDependencies, CreateAutomationRunInput, CreateAutomationRunResult } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) throw new Error(`${fieldName} must not be empty`);
}
function assertUuid(value: string | null, fieldName: string): void {
  if (value != null && !UUID_PATTERN.test(value)) throw new Error(`${fieldName} must be a valid UUID`);
}
function assertJsonObject(value: CreateAutomationRunInput["input"]): void {
  if (typeof value !== "object" || value == null || Array.isArray(value)) throw new Error("input must be a JSON object");
}
function validate(input: CreateAutomationRunInput): void {
  assertNonEmpty(input.workspaceId, "workspaceId"); assertUuid(input.workspaceId, "workspaceId");
  if (input.system !== "backlinks") throw new Error("system must be backlinks");
  assertNonEmpty(input.runKind, "runKind"); assertNonEmpty(input.idempotencyKey, "idempotencyKey");
  if (input.idempotencyKey !== input.idempotencyKey.trim() || input.idempotencyKey.length > 255) throw new Error("idempotencyKey must be trimmed and at most 255 characters");
  if (input.mode !== "dry_run") throw new Error("mode must be dry_run");
  if (!(["manual", "scheduled", "internal"] as const).includes(input.triggerSource)) throw new Error("triggerSource must be valid");
  if (!Number.isFinite(Date.parse(input.scheduledAt))) throw new Error("scheduledAt must be a valid date");
  assertUuid(input.requestedBy, "requestedBy"); assertJsonObject(input.input);
}

export async function createAutomationRun(input: CreateAutomationRunInput, dependencies: CreateAutomationRunDependencies): Promise<CreateAutomationRunResult> {
  validate(input);
  const control = await dependencies.getWorkspaceControl(input.workspaceId);
  if (control == null || !control.backlinksEnabled) return { kind: "rejected", reason: "automation_disabled" };
  if (!control.dryRunOnly) return { kind: "rejected", reason: "dry_run_required" };
  return dependencies.createOrGetRun(input);
}
