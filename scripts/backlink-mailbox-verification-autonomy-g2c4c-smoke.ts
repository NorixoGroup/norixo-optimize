import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildMailboxVerificationTask } from "../lib/automation/backlink-autonomy-foundation";
import { executeBacklinkMailboxVerificationTask } from "../lib/automation/backlink-mailbox-verification-task-handler";
import { runBacklinkAutonomyOrchestrator } from "../lib/automation/backlink-master-autonomy-orchestrator";
import type { BacklinkContactValidationTaskResult } from "../lib/automation/backlink-contact-validation-task-handler";
import type { MailboxVerificationStatus } from "../lib/backlinks/services/mailboxVerificationService";

const ids = { workspace: "00000000-0000-4000-8000-000000000001", run: "00000000-0000-4000-8000-000000000002", domain: "00000000-0000-4000-8000-000000000003", opportunity: "00000000-0000-4000-8000-000000000004", contact: "00000000-0000-4000-8000-000000000005" };
const at = "2026-09-25T00:00:00.000Z";
const control = { backlinksEnabled: true, disabledReason: null, dryRunOnly: true, backlinkAutonomyEnabled: true, campaignApplyAuthorized: true };

function validation(overrides: Partial<BacklinkContactValidationTaskResult> = {}): BacklinkContactValidationTaskResult {
  return {
    status: "unverified", domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact,
    contactStatus: "unverified", currentNormalizedEmail: "editor@example.test", suppressed: false, email: "unverified",
    contactForm: null, linkedin: null, statusTransition: "none", manualReviewRequired: false,
    reasons: ["EMAIL_MAILBOX_PROOF_UNAVAILABLE"], ...overrides,
  };
}

function taskFor(email = "editor@example.test") {
  return buildMailboxVerificationTask({ workspaceId: ids.workspace, runId: ids.run, dependsOnTaskId: "validation-task", domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: email, scheduledAt: at });
}

async function nextFor(progress: Parameters<typeof runBacklinkAutonomyOrchestrator>[1]["progress"]) {
  const tasks = new Map<string, { id: string }>();
  return runBacklinkAutonomyOrchestrator({ createOrGetTask: async (input) => {
    const existing = tasks.get(input.taskKey);
    if (existing != null) return { kind: "existing" as const, task: existing };
    const created = { id: `task-${tasks.size + 1}` }; tasks.set(input.taskKey, created);
    return { kind: "created" as const, task: created };
  } }, { workspaceId: ids.workspace, runId: ids.run, domainId: ids.domain, opportunityId: ids.opportunity, scheduledAt: at, mode: "apply", control, progress });
}

function handlerFixture(input: { status?: MailboxVerificationStatus; contactStatus?: string; email?: string; workspaceId?: string; configured?: boolean; recordError?: string } = {}) {
  let providerCalls = 0;
  let recordCalls = 0;
  const contact = {
    id: ids.contact,
    workspace_id: input.workspaceId ?? ids.workspace,
    contact_status: input.contactStatus ?? "unverified",
    email_normalized: input.email ?? "editor@example.test",
    do_not_contact_at: input.contactStatus === "do_not_contact" ? at : null,
    archived_at: input.contactStatus === "archived" ? at : null,
  };
  return {
    counters: () => ({ providerCalls, recordCalls }),
    dependencies: {
      getProvider: () => input.configured === false ? null : { verify: async () => { providerCalls += 1; return { status: input.status ?? "deliverable", provider: "test-provider", safeReason: "TEST" }; } },
      getContact: async () => contact,
      record: async () => {
        recordCalls += 1;
        if (input.recordError != null) throw new Error(input.recordError);
        if ((input.status ?? "deliverable") === "deliverable") contact.contact_status = "verified";
        return { verificationId: "verification", disposition: "created" as const, contactStatus: contact.contact_status, verifiedAt: contact.contact_status === "verified" ? at : null };
      },
      now: () => new Date(at),
    },
  };
}

async function main() {
  // T1/T2: eligible unverified email only creates the mailbox task, never campaign directly.
  const validationProgress = { stage: "contact_validation" as const, completedTaskId: "validation-task", completedTaskKind: "backlinks.contact_validation", contactIds: [ids.contact], validation: validation() };
  const first = await nextFor(validationProgress);
  assert.equal(first.task?.taskKind, "backlinks.mailbox_verification");
  assert.notEqual(first.task?.taskKind, "backlinks.campaign_prepare");
  const descriptor = taskFor();
  assert.equal(descriptor.taskKind, "backlinks.mailbox_verification");
  assert.equal(descriptor.maxAttempts, 3, "provider errors use bounded existing retries");
  assert.deepEqual(Object.keys(descriptor.input as Record<string, unknown>).sort(), ["contactId", "currentNormalizedEmail", "domainId", "opportunityId", "version"]);

  // T3: only a persisted deliverable result whose canonical contact is verified may advance once.
  const deliverable = handlerFixture();
  const delivered = await executeBacklinkMailboxVerificationTask(deliverable.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" });
  assert.equal(delivered.outcome, "verified"); assert.equal(delivered.contactStatus, "verified"); assert.deepEqual(deliverable.counters(), { providerCalls: 1, recordCalls: 1 });
  const campaign = await nextFor({ stage: "mailbox_verification", completedTaskId: "mailbox-task", completedTaskKind: "backlinks.mailbox_verification", contactIds: [ids.contact], mailboxVerification: delivered });
  assert.equal(campaign.task?.taskKind, "backlinks.campaign_prepare");

  // T4-T6: non-deliverable persisted outcomes are terminal and cannot create campaign work.
  for (const status of ["undeliverable", "risky", "unknown"] as const) {
    const fixture = handlerFixture({ status });
    const result = await executeBacklinkMailboxVerificationTask(fixture.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" });
    assert.equal(result.outcome, "terminal");
    const next = await nextFor({ stage: "mailbox_verification", completedTaskId: `mailbox-${status}`, completedTaskKind: "backlinks.mailbox_verification", contactIds: [ids.contact], mailboxVerification: result });
    assert.equal(next.task, null);
  }

  // T7-T11: provider errors retry through the existing bounded lifecycle; protected races/stops do not advance.
  await assert.rejects(() => executeBacklinkMailboxVerificationTask(handlerFixture({ status: "provider_error" }).dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" }), /MAILBOX_VERIFICATION_PROVIDER_ERROR/);
  for (const status of ["do_not_contact", "archived"] as const) {
    const fixture = handlerFixture({ contactStatus: status });
    const result = await executeBacklinkMailboxVerificationTask(fixture.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" });
    assert.equal(result.outcome, "terminal"); assert.deepEqual(fixture.counters(), { providerCalls: 0, recordCalls: 0 });
  }
  const stale = handlerFixture({ email: "new@example.test" });
  assert.equal((await executeBacklinkMailboxVerificationTask(stale.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" })).reason, "MAILBOX_VERIFICATION_STALE_EMAIL");
  assert.equal(stale.counters().providerCalls, 0);
  const conflict = handlerFixture({ recordError: "BACKLINK_CONTACT_MAILBOX_VERIFICATION_KEY_CONFLICT" });
  assert.equal((await executeBacklinkMailboxVerificationTask(conflict.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" })).outcome, "terminal");

  // T12/T15/T16: verified reuse, isolation failure, and absent configuration cannot call a provider unsafely.
  const verified = handlerFixture({ contactStatus: "verified" });
  const verifiedResult = await executeBacklinkMailboxVerificationTask(verified.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" });
  assert.equal(verifiedResult.outcome, "verified"); assert.equal(verified.counters().providerCalls, 0);
  const mismatch = handlerFixture({ workspaceId: "other-workspace" });
  assert.equal((await executeBacklinkMailboxVerificationTask(mismatch.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" })).outcome, "terminal");
  assert.equal(mismatch.counters().providerCalls, 0);
  const missingProvider = handlerFixture({ configured: false });
  assert.equal((await executeBacklinkMailboxVerificationTask(missingProvider.dependencies, { workspaceId: ids.workspace, domainId: ids.domain, opportunityId: ids.opportunity, contactId: ids.contact, currentNormalizedEmail: "editor@example.test" })).reason, "MAILBOX_VERIFICATION_PROVIDER_NOT_CONFIGURED");
  assert.equal(missingProvider.counters().providerCalls, 0);

  // T13/T14/T17/T18: identity is stable for replay, changes for an email change, and non-email validation never routes to mailbox.
  assert.equal(taskFor().taskKey, taskFor().taskKey);
  assert.notEqual(taskFor().taskKey, taskFor("new@example.test").taskKey);
  for (const channel of ["contactForm", "linkedin"] as const) {
    const result = await nextFor({ stage: "contact_validation", completedTaskId: `validation-${channel}`, completedTaskKind: "backlinks.contact_validation", contactIds: [ids.contact], validation: validation({ status: "manual_review", email: null, currentNormalizedEmail: null, [channel]: channel === "contactForm" ? "manual_review" : "manual_action_required", manualReviewRequired: true }) });
    assert.notEqual(result.task?.taskKind, "backlinks.mailbox_verification");
  }

  // T19-T24: the closed composition still has no executor and the Hostfully ID is absent.
  const composition = await readFile(new URL("../lib/automation/backlink-autonomy-production-composition.ts", import.meta.url), "utf8");
  assert.doesNotMatch(composition, /ready|resend|contact[_-]?form|linkedin|follow.?up/i);
  assert.doesNotMatch(composition, /502f1a85-a308-4227-aa73-58332788f235/);

  // T25: the forward-only SQL extends both closed allowlists and nothing else is needed to claim/reclaim this task.
  const migration = await readFile(new URL("../supabase/migrations/20260925000000_add_mailbox_verification_autonomy_task.sql", import.meta.url), "utf8");
  assert.equal((migration.match(/'backlinks\.mailbox_verification'/g) ?? []).length, 2);
  assert.match(migration, /claim_next_backlink_autonomy_task/); assert.match(migration, /reclaim_expired_backlink_autonomy_tasks/);
  console.log("PASS — Backlink mailbox verification autonomy G2C.4-C smoke");
}

void main();
