import { createAutomationRun, type AutomationRun, type CreateAutomationRunDependencies, type CreateAutomationRunInput } from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
async function assertRejects(operation: () => Promise<unknown>, message: string): Promise<void> { try { await operation(); } catch (error) { assert(error instanceof Error && error.message.includes(message), `Expected ${message}`); return; } throw new Error("Expected rejection."); }
const input: CreateAutomationRunInput = { workspaceId: "00000000-0000-4000-8000-000000000001", system: "backlinks", runKind: "manual_check", idempotencyKey: "manual:2026-08-03", mode: "dry_run", triggerSource: "manual", requestedBy: null, scheduledAt: "2026-08-03T10:00:00.000Z", input: {} };
const run: AutomationRun = { id: "00000000-0000-4000-8000-000000000002", workspaceId: input.workspaceId, system: "backlinks", runKind: input.runKind, idempotencyKey: input.idempotencyKey, status: "queued", mode: "dry_run", triggerSource: "manual", requestedBy: null, scheduledAt: input.scheduledAt, startedAt: null, completedAt: null, failedAt: null, cancelledAt: null, heartbeatAt: null, leaseExpiresAt: null, workerId: null, attemptCount: 0, maxAttempts: 1, input: {}, summary: null, errorCode: null, errorMessage: null, createdAt: input.scheduledAt, updatedAt: input.scheduledAt };
function dependencies(control: { backlinksEnabled: boolean; dryRunOnly: boolean } | null, outcome: "created" | "existing" = "created"): CreateAutomationRunDependencies { return { getWorkspaceControl: async () => control == null ? null : { workspaceId: input.workspaceId, disabledReason: null, ...control }, createOrGetRun: async received => { assert(received === input, "Repository must receive the original input."); return { kind: outcome, run }; } }; }
async function main(): Promise<void> {
  const original = { ...input };
  const created = await createAutomationRun(input, dependencies({ backlinksEnabled: true, dryRunOnly: true }));
  assert(created.kind === "created" && created.run === run, "Expected created run by reference.");
  assert(JSON.stringify(input) === JSON.stringify(original), "Input must not be mutated.");
  const existing = await createAutomationRun(input, dependencies({ backlinksEnabled: true, dryRunOnly: true }, "existing"));
  assert(existing.kind === "existing" && existing.run === run, "Expected existing run by reference.");
  const disabled = await createAutomationRun(input, dependencies(null)); assert(disabled.kind === "rejected" && disabled.reason === "automation_disabled", "Missing control must reject.");
  const dryRun = await createAutomationRun(input, dependencies({ backlinksEnabled: true, dryRunOnly: false })); assert(dryRun.kind === "rejected" && dryRun.reason === "dry_run_required", "Non dry-run control must reject.");
  const repositoryError = new Error("repository failure"); let repositoryCalls = 0;
  await assertRejects(() => createAutomationRun(input, { getWorkspaceControl: async () => ({ workspaceId: input.workspaceId, backlinksEnabled: true, dryRunOnly: true, disabledReason: null }), createOrGetRun: async () => { repositoryCalls += 1; throw repositoryError; } }), "repository failure"); assert(repositoryCalls === 1, "Repository error must propagate.");
  const invalidCases: Array<[CreateAutomationRunInput, string]> = [[{ ...input, workspaceId: "" }, "workspaceId must not be empty"], [{ ...input, workspaceId: "bad" }, "workspaceId must be a valid UUID"], [{ ...input, system: "other" as "backlinks" }, "system must be backlinks"], [{ ...input, runKind: "" }, "runKind must not be empty"], [{ ...input, idempotencyKey: "" }, "idempotencyKey must not be empty"], [{ ...input, mode: "live" as "dry_run" }, "mode must be dry_run"], [{ ...input, triggerSource: "other" as "manual" }, "triggerSource must be valid"], [{ ...input, scheduledAt: "bad" }, "scheduledAt must be a valid date"], [{ ...input, requestedBy: "bad" }, "requestedBy must be a valid UUID"], [{ ...input, input: [] }, "input must be a JSON object"]];
  for (const [invalid, message] of invalidCases) { let calls = 0; await assertRejects(() => createAutomationRun(invalid, { getWorkspaceControl: async () => { calls += 1; return null; }, createOrGetRun: async () => { calls += 1; return { kind: "created", run }; } }), message); assert(calls === 0, "Invalid input must not call dependencies."); }
  console.log("PASS — Automation run service smoke");
}
void main();
