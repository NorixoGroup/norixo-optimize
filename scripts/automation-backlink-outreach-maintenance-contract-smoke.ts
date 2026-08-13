import { readFile } from "node:fs/promises";

import {
  BACKLINK_OUTREACH_FOLLOW_UP_DUE_TASK_KIND,
  BACKLINK_OUTREACH_FINAL_RESPONSE_EXPIRED_TASK_KIND,
  BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND,
  buildBacklinkOutreachFinalResponseExpiredTaskKey,
  buildBacklinkOutreachFollowUpDueTaskKey,
  validateBacklinkOutreachFinalResponseExpiredTaskInput,
  validateBacklinkOutreachFollowUpDueTaskInput,
  validateBacklinkOutreachMaintenanceRunInput,
} from "../lib/automation/backlink-outreach-maintenance";
import { createAutomationRun, type CreateAutomationRunDependencies } from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [
    automationRunsMigration,
    automationTasksMigration,
    automationTasksRepository,
    handlerTypes,
    dryRunHandlers,
  ] = await Promise.all([
    readFile("supabase/migrations/20260803010000_create_automation_runs.sql", "utf8"),
    readFile("supabase/migrations/20260803020000_create_automation_tasks.sql", "utf8"),
    readFile("lib/automation/repositories/automationTasksRepository.ts", "utf8"),
    readFile("lib/automation/handler-types.ts", "utf8"),
    readFile("lib/automation/dry-run-handlers.ts", "utf8"),
  ]);

  assert(
    BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND === "backlinks.outreach.maintenance",
    "Run kind must be canonical.",
  );
  assert(
    BACKLINK_OUTREACH_FOLLOW_UP_DUE_TASK_KIND === "backlinks.outreach.follow_up_due",
    "Follow-up due task kind must be canonical.",
  );
  assert(
    BACKLINK_OUTREACH_FINAL_RESPONSE_EXPIRED_TASK_KIND === "backlinks.outreach.final_response_expired",
    "Final response expired task kind must be canonical.",
  );

  for (const value of [
    "automation_runs_workspace_system_kind_key_unique",
    "constraint automation_runs_mode_check check (mode = 'dry_run')",
    "constraint automation_runs_trigger_source_check check (trigger_source in ('manual', 'scheduled', 'internal'))",
    "requested_by uuid references auth.users(id) on delete set null",
    "mode text not null default 'dry_run'",
  ]) {
    assert(automationRunsMigration.includes(value), `Missing automation run invariant: ${value}`);
  }

  for (const value of [
    "automation_tasks_unique unique(workspace_id,run_id,task_kind,task_key)",
    "constraint automation_tasks_status check(status in ('queued','running','completed','failed','cancelled','dead_letter'))",
    "create index automation_tasks_workspace_run_status_idx on public.automation_tasks(workspace_id,run_id,status)",
    "claim_next_automation_task",
    "heartbeat_automation_task",
    "complete_automation_task",
    "fail_automation_task",
    "reclaim_expired_automation_tasks",
    "cancel_automation_task",
  ]) {
    assert(automationTasksMigration.includes(value), `Missing automation task invariant: ${value}`);
  }

  for (const value of [
    "createOrGetAutomationTask",
    ".insert(",
    "error.code !== \"CONFLICT\"",
    ".eq(\"workspace_id\", input.workspaceId).eq(\"run_id\", input.runId).eq(\"task_kind\", input.taskKind).eq(\"task_key\", input.taskKey).maybeSingle()",
    "claim_next_automation_task",
    "heartbeat_automation_task",
    "complete_automation_task",
    "fail_automation_task",
    "reclaim_expired_automation_tasks",
    "cancel_automation_task",
  ]) {
    assert(automationTasksRepository.includes(value), `Missing automation task repository invariant: ${value}`);
  }

  for (const value of [
    "backlinks.discovery.preview",
    "backlinks.qualification.preview",
    "backlinks.promotion.preview",
    "backlinks.campaign.preview",
    "backlinks.outreach.follow_up_due",
    "backlinks.outreach.final_response_expired",
  ]) {
    assert(handlerTypes.includes(value), `Preview task kind must remain supported: ${value}`);
    assert(dryRunHandlers.includes(value), `Dry-run handlers must support outreach maintenance signals: ${value}`);
  }

  const validRun = validateBacklinkOutreachMaintenanceRunInput({
    workspaceId: "00000000-0000-4000-8000-000000000001",
    requestedBy: null,
    idempotencyKey: "maintenance:2026-08-13",
    scheduledAt: "2026-08-13T08:00:00.000Z",
    operation: "signal_detection",
    limit: 100,
  });
  assert(validRun.requestedBy === null, "requestedBy must remain nullable.");
  assert(validRun.operation === "signal_detection", "operation must be preserved.");
  assert(validRun.limit === 100, "limit must be preserved.");

  const runDependencies: CreateAutomationRunDependencies = {
    getWorkspaceControl: async () => ({
      workspaceId: validRun.workspaceId,
      backlinksEnabled: true,
      backlinkOutreachScheduleApplyEnabled: false,
      dryRunOnly: true,
      disabledReason: null,
    }),
    createOrGetRun: async (input) => ({
      kind: "created",
      run: {
        id: "00000000-0000-4000-8000-000000000002",
        workspaceId: input.workspaceId,
        system: input.system,
        runKind: input.runKind,
        idempotencyKey: input.idempotencyKey,
        status: "queued",
        mode: "dry_run",
        triggerSource: input.triggerSource,
        requestedBy: input.requestedBy,
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
        input: input.input,
        summary: null,
        errorCode: null,
        errorMessage: null,
        createdAt: input.scheduledAt,
        updatedAt: input.scheduledAt,
      },
    }),
  };
  const createdRun = await createAutomationRun(
    {
      workspaceId: validRun.workspaceId,
      system: "backlinks",
      runKind: BACKLINK_OUTREACH_MAINTENANCE_RUN_KIND,
      idempotencyKey: validRun.idempotencyKey,
      mode: "dry_run",
      triggerSource: "internal",
      requestedBy: validRun.requestedBy,
      scheduledAt: validRun.scheduledAt,
      input: { operation: validRun.operation, limit: validRun.limit },
    },
    runDependencies,
  );
  assert(createdRun.kind === "created", "Backlink outreach maintenance run must be accepted by the generic automation run service.");

  const dueTask = validateBacklinkOutreachFollowUpDueTaskInput({
    outreachId: "00000000-0000-4000-8000-000000000010",
    nextFollowUpAt: "2026-08-13T09:00:00.000Z",
    currentAttempt: 1,
    maxAttempts: 3,
  });
  const expiredTask = validateBacklinkOutreachFinalResponseExpiredTaskInput({
    outreachId: "00000000-0000-4000-8000-000000000011",
    responseDeadlineAt: "2026-08-13T10:00:00.000Z",
    currentAttempt: 3,
    maxAttempts: 3,
  });

  assert(
    buildBacklinkOutreachFollowUpDueTaskKey(dueTask) === "outreach-follow-up-due:00000000-0000-4000-8000-000000000010:2026-08-13T09:00:00.000Z:1",
    "Follow-up due key must be deterministic and normalized.",
  );
  assert(
    buildBacklinkOutreachFollowUpDueTaskKey({ ...dueTask, nextFollowUpAt: "2026-08-13T11:00:00+02:00" }) === buildBacklinkOutreachFollowUpDueTaskKey(dueTask),
    "Equivalent follow-up timestamps must normalize to the same key.",
  );
  assert(
    buildBacklinkOutreachFinalResponseExpiredTaskKey(expiredTask) === "outreach-final-response-expired:00000000-0000-4000-8000-000000000011:2026-08-13T10:00:00.000Z:3",
    "Expired key must be deterministic and normalized.",
  );
  assert(
    buildBacklinkOutreachFinalResponseExpiredTaskKey({ ...expiredTask, responseDeadlineAt: "2026-08-13T12:00:00+02:00" }) === buildBacklinkOutreachFinalResponseExpiredTaskKey(expiredTask),
    "Equivalent response deadline timestamps must normalize to the same key.",
  );
  assert(
    buildBacklinkOutreachFollowUpDueTaskKey(dueTask) !== buildBacklinkOutreachFollowUpDueTaskKey({ ...dueTask, currentAttempt: 2 }),
    "Follow-up due key must change with attempt count.",
  );
  assert(
    buildBacklinkOutreachFinalResponseExpiredTaskKey(expiredTask) !== buildBacklinkOutreachFinalResponseExpiredTaskKey({ ...expiredTask, currentAttempt: 2 }),
    "Expired key must change with attempt count.",
  );

  for (const invalid of [
    () => validateBacklinkOutreachMaintenanceRunInput({}),
    () => validateBacklinkOutreachFollowUpDueTaskInput({ outreachId: "bad", nextFollowUpAt: "2026-08-13T09:00:00.000Z", currentAttempt: 1, maxAttempts: 3 }),
    () => validateBacklinkOutreachFollowUpDueTaskInput({ outreachId: "00000000-0000-4000-8000-000000000010", nextFollowUpAt: "bad", currentAttempt: 1, maxAttempts: 3 }),
    () => validateBacklinkOutreachFollowUpDueTaskInput({ outreachId: "00000000-0000-4000-8000-000000000010", nextFollowUpAt: "2026-08-13T09:00:00.000Z", currentAttempt: -1, maxAttempts: 3 }),
    () => validateBacklinkOutreachFollowUpDueTaskInput({ outreachId: "00000000-0000-4000-8000-000000000010", nextFollowUpAt: "2026-08-13T09:00:00.000Z", currentAttempt: 1, maxAttempts: 0 }),
    () => validateBacklinkOutreachFollowUpDueTaskInput({ outreachId: "00000000-0000-4000-8000-000000000010", nextFollowUpAt: "2026-08-13T09:00:00.000Z", currentAttempt: 4, maxAttempts: 3 }),
    () => validateBacklinkOutreachFinalResponseExpiredTaskInput({ outreachId: "00000000-0000-4000-8000-000000000011", responseDeadlineAt: "bad", currentAttempt: 1, maxAttempts: 1 }),
    () => validateBacklinkOutreachFinalResponseExpiredTaskInput({ outreachId: "00000000-0000-4000-8000-000000000011", responseDeadlineAt: "2026-08-13T10:00:00.000Z", currentAttempt: -1, maxAttempts: 1 }),
    () => validateBacklinkOutreachFinalResponseExpiredTaskInput({ outreachId: "00000000-0000-4000-8000-000000000011", responseDeadlineAt: "2026-08-13T10:00:00.000Z", currentAttempt: 1, maxAttempts: 0 }),
    () => validateBacklinkOutreachFinalResponseExpiredTaskInput({ outreachId: "00000000-0000-4000-8000-000000000011", responseDeadlineAt: "2026-08-13T10:00:00.000Z", currentAttempt: 2, maxAttempts: 1 }),
  ]) {
    try {
      invalid();
      throw new Error("Expected validation rejection");
    } catch (error) {
      assert(error instanceof Error, "Invalid contracts must reject with an error.");
    }
  }

  for (const forbidden of [
    "email",
    "subject",
    "body",
    "replyToken",
    "replyTokenHash",
    "providerMessageId",
    "inbound content",
  ]) {
    assert(
      !JSON.stringify(validRun).includes(forbidden),
      `Run contract must not include sensitive field: ${forbidden}`,
    );
  }

  console.log("PASS — Automation outreach maintenance contract smoke");
}

void main();
