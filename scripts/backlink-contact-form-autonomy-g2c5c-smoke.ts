import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { executeBacklinkContactFormPrepareTask } from "../lib/automation/backlink-contact-form-prepare-task-handler";
import { runBacklinkAutonomyOrchestrator } from "../lib/automation/backlink-master-autonomy-orchestrator";

const ids = { workspace: "00000000-0000-4000-8000-000000000001", run: "00000000-0000-4000-8000-000000000002", domain: "00000000-0000-4000-8000-000000000003", opportunity: "00000000-0000-4000-8000-000000000004", contact: "00000000-0000-4000-8000-000000000005", outreach: "00000000-0000-4000-8000-000000000006" };
const at = "2026-09-26T00:00:00.000Z";
const control = { backlinksEnabled: true, disabledReason: null, dryRunOnly: true, backlinkAutonomyEnabled: true, campaignApplyAuthorized: true };

async function orchestrate(progress: Parameters<typeof runBacklinkAutonomyOrchestrator>[1]["progress"]) {
  const tasks = new Map<string, { id: string }>();
  return runBacklinkAutonomyOrchestrator({ createOrGetTask: async (input) => {
    const existing = tasks.get(input.taskKey);
    if (existing != null) return { kind: "existing" as const, task: existing };
    const created = { id: `task-${tasks.size + 1}` }; tasks.set(input.taskKey, created);
    return { kind: "created" as const, task: created };
  } }, { workspaceId: ids.workspace, runId: ids.run, domainId: ids.domain, opportunityId: ids.opportunity, scheduledAt: at, mode: "apply", control, progress });
}

async function main() {
  const contactFormDecision = { outcome: "execution_eligible" as const, reasons: [], execution: { kind: "contact_form_worker" as const, workspaceId: ids.workspace, outreachId: ids.outreach } };
  const preparedTask = await orchestrate({ stage: "outreach_decision", completedTaskId: "decision", completedTaskKind: "backlinks.outreach_decision", contactIds: [ids.contact], decision: contactFormDecision });
  assert.equal(preparedTask.task?.taskKind, "backlinks.contact_form_prepare", "T1 contact form reaches closed prepare task");
  assert.equal(preparedTask.task?.input && (preparedTask.task.input as Record<string, unknown>).outreachId, ids.outreach);

  const email = await orchestrate({ stage: "outreach_decision", completedTaskId: "email-decision", completedTaskKind: "backlinks.outreach_decision", contactIds: [ids.contact], decision: { outcome: "execution_eligible", reasons: [], execution: { kind: "email_sender", workspaceId: ids.workspace, outreachId: ids.outreach } } });
  assert.equal(email.outcome, "execution_pending", "T2 email remains unchanged");
  const linkedin = await orchestrate({ stage: "outreach_decision", completedTaskId: "linkedin-decision", completedTaskKind: "backlinks.outreach_decision", contactIds: [ids.contact], decision: { outcome: "manual_action_required", reasons: ["LINKEDIN_MANUAL_ACTION_REQUIRED"], execution: { kind: "linkedin_manual_action", workspaceId: ids.workspace, outreachId: ids.outreach } } });
  assert.equal(linkedin.outcome, "manual_review", "T3 LinkedIn stays manual");

  const result = await executeBacklinkContactFormPrepareTask(
    {
      getLatestApprovalCandidate: async () => null,
      queueExistingApproval: async () => {
        throw new Error("must not queue contact form without an existing approval");
      },
    },
    { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, outreachId: ids.outreach, executionKind: "contact_form_worker" },
  );
  assert.deepEqual(result, { outcome: "manual_review", outreachId: ids.outreach, reason: "CONTACT_FORM_APPROVAL_REQUIRED", queuedRunId: null }, "T4/T5 no approval is fabricated or queued");
  const terminal = await orchestrate({ stage: "contact_form_prepare", completedTaskId: "prepare", completedTaskKind: "backlinks.contact_form_prepare", contactIds: [ids.contact], contactFormPrepare: result });
  assert.equal(terminal.outcome, "manual_review"); assert.deepEqual(terminal.reasonCodes, ["CONTACT_FORM_APPROVAL_REQUIRED"]); assert.equal(terminal.readyTransitionRequired, true);

  const approvalRoute = await readFile("app/api/backlinks/outreach/[id]/contact-form/approval/route.ts", "utf8");
  const queueRoute = await readFile("app/api/backlinks/outreach/[id]/contact-form/queue/route.ts", "utf8");
  const readyMigration = await readFile("supabase/migrations/20260830180000_fix_backlink_first_approval_digest_schema.sql", "utf8");
  const handler = await readFile("lib/automation/backlink-contact-form-prepare-task-handler.ts", "utf8");
  const dispatcher = await readFile("lib/automation/backlink-autonomy-dispatcher.ts", "utf8");
  const orchestrator = await readFile("lib/automation/backlink-master-autonomy-orchestrator.ts", "utf8");
  const migration = await readFile("supabase/migrations/20260926000000_add_contact_form_prepare_autonomy_task.sql", "utf8");
  assert.match(approvalRoute, /isAdminPrivateEmail/); assert.match(approvalRoute, /approvedByUserId: auth\.user\.id/);
  assert.match(queueRoute, /queueContactFormRun/); assert.match(readyMigration, /o\.channel <> 'email'/);
  assert.doesNotMatch(handler, /queueContactFormRun|markBacklinkOutreachReady|executeContactFormControlledSubmission|playwright|CONTACT_FORM_REAL_SUBMISSION_ENABLED/);
  assert.doesNotMatch(dispatcher, /executeContactFormControlledSubmission|playwright/); assert.doesNotMatch(orchestrator, /executeContactFormControlledSubmission|playwright/);
  assert.equal((migration.match(/'backlinks\.contact_form_prepare'/g) ?? []).length, 2, "T20 claim/reclaim allowlists include exactly the closed task");
  assert.doesNotMatch(`${handler}\n${dispatcher}\n${orchestrator}`, /resend|zerobounce|hostfully|linkedin.*(?:execute|send)/i);
  console.log("PASS — Backlink contact-form autonomy G2C.5-C smoke");
}

void main();
