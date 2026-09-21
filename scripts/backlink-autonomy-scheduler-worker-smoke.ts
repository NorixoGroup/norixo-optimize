import assert from "node:assert/strict";
import { runBacklinkAutonomyScheduler } from "@/lib/automation/backlink-autonomy-scheduler";
import { runOneBacklinkAutonomyWorkerTask, BACKLINK_AUTONOMY_TASK_KINDS } from "@/lib/automation/backlink-autonomy-worker";
import type { AutomationTask, CreateAutomationTaskInput } from "@/lib/automation/types";
import type { AppliedBacklinkPromotion } from "@/lib/automation/backlink-promotion-resolution-entry";

const x = { w: "00000000-0000-4000-8000-000000000001", r: "00000000-0000-4000-8000-000000000002", p: "00000000-0000-4000-8000-000000000003", d: "00000000-0000-4000-8000-000000000004", o: "00000000-0000-4000-8000-000000000005", a: "00000000-0000-4000-8000-000000000006" }; const at = "2026-09-21T00:00:00.000Z";
const control = { workspaceId: x.w, backlinksEnabled: true, backlinkAutonomyEnabled: true, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: false, disabledReason: null };
const promotion: AppliedBacklinkPromotion = { applicationId: "application", workspaceId: x.w, runId: x.r, promotionTaskId: x.p, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: x.d, opportunityId: x.o, actorUserId: x.a, applied: true };
function automationTask(input: CreateAutomationTaskInput, id = "00000000-0000-4000-8000-000000000007"): AutomationTask { return { id, workspaceId: input.workspaceId, runId: input.runId, dependsOnTaskId: input.dependsOnTaskId ?? null, system: "backlinks", taskKind: input.taskKind, taskKey: input.taskKey, status: "running", priority: input.priority, scheduledAt: input.scheduledAt, availableAt: input.availableAt, claimedAt: at, startedAt: at, heartbeatAt: at, leaseExpiresAt: at, completedAt: null, failedAt: null, cancelledAt: null, workerId: "fake", attemptCount: 1, maxAttempts: input.maxAttempts, backoffBaseSeconds: input.backoffBaseSeconds, input: input.input, output: null, errorCode: null, errorMessage: null, createdAt: at, updatedAt: at }; }

async function main() {
  let workspaceReads = 0, writes = 0, taskPersisted = false;
  const schedulerDeps: any = { runtimeConfig: () => ({ autonomyEnabled: false }), listWorkspaceControls: async () => { workspaceReads++; return [control]; }, listAppliedPromotions: async () => [promotion], getDomain: async () => ({ id: x.d, workspaceId: x.w }), getOpportunity: async () => ({ id: x.o, workspaceId: x.w, domainId: x.d }), createOrGetTask: async () => { if (taskPersisted) return { kind: "existing", task: { id: "task" } }; taskPersisted = true; writes++; return { kind: "created", task: { id: "task" } }; } };
  assert.equal((await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "apply", scheduledAt: at })).outcome, "disabled"); assert.equal(workspaceReads, 0); assert.equal(writes, 0);
  schedulerDeps.runtimeConfig = () => ({ autonomyEnabled: true });
  const preview = await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "preview", scheduledAt: at }); assert.equal(preview.proposed.length, 1); assert.equal(writes, 0);
  const apply = await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "apply", scheduledAt: at }); assert.equal(apply.created, 1); assert.equal(writes, 1);
  const replay = await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "apply", scheduledAt: at }); assert.equal(replay.existing, 1); assert.equal(writes, 1);
  schedulerDeps.listWorkspaceControls = async () => [{ ...control, backlinkAutonomyEnabled: false }]; assert.equal((await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "apply", scheduledAt: at })).created, 0);
  schedulerDeps.listWorkspaceControls = async () => [{ ...control, disabledReason: "paused" }]; assert.equal((await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "preview", scheduledAt: at })).proposed.length, 0);
  schedulerDeps.listWorkspaceControls = async () => [control]; schedulerDeps.listAppliedPromotions = async () => [{ ...promotion, applied: false }]; assert.equal((await runBacklinkAutonomyScheduler(schedulerDeps, { mode: "preview", scheduledAt: at })).proposed.length, 0);

  const seed = preview.proposed[0]!; const claimed = automationTask(seed); let claims = 0, handlers = 0, completions = 0, failures = 0, nextCreates = 0; const next = new Map<string, AutomationTask>();
  const workerDeps: any = {
    runtimeConfig: () => ({ autonomyEnabled: true }), getWorkspaceControl: async () => control,
    claimNextAllowedTask: async (input: any) => { claims++; assert.deepEqual(input.taskKinds, BACKLINK_AUTONOMY_TASK_KINDS); return claims === 1 ? claimed : null; },
    getDependencyOutput: async () => null, getActorUserId: async () => x.a,
    createOrGetTask: async (input: CreateAutomationTaskInput) => { const found = next.get(input.taskKey); if (found) return { kind: "existing", task: found }; const value = automationTask(input, "00000000-0000-4000-8000-000000000008"); next.set(input.taskKey, value); nextCreates++; return { kind: "created", task: value }; },
    completeTask: async () => { completions++; return claimed; }, failTask: async () => { failures++; return { ...claimed, status: "failed" }; }, heartbeatTask: async () => null, reclaimExpiredTasks: async () => [], cancelTask: async () => null,
    resolution: { getDomain: async () => ({ id: x.d, workspace_id: x.w, hostname: "example.test" }), getOpportunity: async () => ({ id: x.o, workspace_id: x.w, domain_id: x.d }), listContactsByDomain: async () => [{ id: "contact", contact_status: "verified", email_normalized: "editor@example.test", linkedin_url: null, contact_form_url: null }], allocateContactKey: async () => "unused", createContact: async () => ({ id: "unused" }), resolve: async () => { handlers++; return { status: "resolved", inspectedUrls: [], candidates: [{ email: "editor@example.test", linkedinUrl: null, contactFormUrl: null, evidence: [] }], reasons: [] }; } },
    validation: {}, campaign: {}, draft: {}, decision: {},
  };
  const worker = await runOneBacklinkAutonomyWorkerTask(workerDeps, { workspaceId: x.w, runId: x.r, workerId: "fake", at }); assert.equal(worker.kind, "completed"); assert.equal(nextCreates, 1); assert.equal(completions, 1); assert.equal(handlers, 1);
  const off = await runOneBacklinkAutonomyWorkerTask({ ...workerDeps, runtimeConfig: () => ({ autonomyEnabled: false }), claimNextAllowedTask: async () => { throw new Error("must not claim"); } }, { workspaceId: x.w, runId: x.r, workerId: "fake", at }); assert.equal(off.kind, "disabled");
  const disabled = await runOneBacklinkAutonomyWorkerTask({ ...workerDeps, getWorkspaceControl: async () => ({ ...control, backlinkAutonomyEnabled: false }), claimNextAllowedTask: async () => claimed }, { workspaceId: x.w, runId: x.r, workerId: "fake", at }); assert.equal(disabled.kind, "retried"); assert.equal(failures, 1);
  console.log("PASS — Backlink autonomy scheduler worker smoke");
}
void main();
