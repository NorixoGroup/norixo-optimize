import { readFile } from "node:fs/promises";

import {
  previewBacklinkOutreachScheduleReconciliationRun,
  type BacklinkOutreachScheduleReconciliationCandidate,
  type PreviewBacklinkOutreachScheduleReconciliationRunDependencies,
  type PreviewBacklinkOutreachScheduleReconciliationRunInput,
} from "../lib/backlinks/services/outreachScheduleReconciliationService";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(overrides: Partial<BacklinkOutreachScheduleReconciliationCandidate> = {}): BacklinkOutreachScheduleReconciliationCandidate {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    contact_id: "00000000-0000-4000-8000-000000000010",
    status: "active",
    channel: "email",
    current_attempt: 1,
    max_attempts: 3,
    last_attempt_at: "2026-08-05T10:00:00.000Z",
    next_follow_up_at: null,
    response_deadline_at: null,
    ...overrides,
  };
}

async function main(): Promise<void> {
  const source = await readFile(
    "lib/backlinks/services/outreachScheduleReconciliationService.ts",
    "utf8",
  );
  assert(source.includes("evaluateBacklinkOutreachScheduleReconciliationCandidate"), "Preview runner must keep the shared evaluator.");
  assert(!source.includes("applyBacklinkOutreachScheduleReconciliationAutomation"), "Preview runner must stay separate from the apply runner.");

  const createdRuns: unknown[] = [];
  const completedRuns: unknown[] = [];
  const candidateCalls: number[] = [];
  let latestAttemptCalls = 0;
  let openAttemptCalls = 0;
  let contactCalls = 0;
  let stopEffectCalls = 0;

  const dependencies: PreviewBacklinkOutreachScheduleReconciliationRunDependencies = {
    createRun: async (input) => {
      createdRuns.push(input);
      return { kind: "created", run: { id: "00000000-0000-4000-8000-000000000200" } };
    },
    completeRun: async (input) => {
      completedRuns.push(input);
      return { kind: "transitioned", run: { id: input.runId } };
    },
    listCandidates: async (_workspaceId, limit) => {
      candidateCalls.push(limit);
      return [
        candidate({ id: "00000000-0000-4000-8000-000000000111" }),
        candidate({ id: "00000000-0000-4000-8000-000000000112", current_attempt: 2, max_attempts: 4 }),
        candidate({ id: "00000000-0000-4000-8000-000000000113", current_attempt: 3, max_attempts: 3 }),
        candidate({ id: "00000000-0000-4000-8000-000000000114", next_follow_up_at: "2026-08-10T10:00:00.000Z" }),
        candidate({ id: "00000000-0000-4000-8000-000000000115", next_follow_up_at: "2026-08-11T10:00:00.000Z" }),
        candidate({ id: "00000000-0000-4000-8000-000000000116", status: "active" }),
        candidate({ id: "00000000-0000-4000-8000-000000000117", status: "active" }),
      ];
    },
    getLatestAttempt: async (_workspaceId, outreachId) => {
      latestAttemptCalls += 1;
      if (outreachId === "00000000-0000-4000-8000-000000000116") {
        return { status: "failed" };
      }
      return {
        id: "00000000-0000-4000-8000-000000000300",
        workspace_id: "00000000-0000-4000-8000-000000000001",
        outreach_id: outreachId,
        actor_user_id: "00000000-0000-4000-8000-000000000020",
        channel: "email",
        provider: "resend",
        recipient: "guest@example.com",
        idempotency_key: "attempt-1",
        status: "accepted",
        provider_message_id: "msg-1",
        error_code: null,
        error_message: null,
        requested_at: "2026-08-05T10:00:00.000Z",
        accepted_at: "2026-08-05T10:00:05.000Z",
        failed_at: null,
        resolved_at: null,
        created_at: "2026-08-05T10:00:00.000Z",
        attempt_kind: "initial",
        cancel_reason: null,
        cancelled_at: null,
        prepared_at: null,
        reply_token_hash: null,
        reply_token_key_version: null,
      };
    },
    getOpenAttempt: async (_workspaceId, outreachId) => {
      openAttemptCalls += 1;
      return null;
    },
    getContact: async (_workspaceId, contactId) => {
      contactCalls += 1;
      if (contactId === "00000000-0000-4000-8000-000000000010") {
        return { contact_status: "verified", email_normalized: "guest@example.com" };
      }
      return { contact_status: "verified", email_normalized: "guest@example.com" };
    },
    hasInboundReplyStopEffect: async (_workspaceId, outreachId) => {
      stopEffectCalls += 1;
      return outreachId === "00000000-0000-4000-8000-000000000117";
    },
  };

  const baseInput: PreviewBacklinkOutreachScheduleReconciliationRunInput = {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    requestedBy: null,
    idempotencyKey: "maintenance:2026-08-13",
    scheduledAt: "2026-08-13T08:00:00.000Z",
  };

  const preview = await previewBacklinkOutreachScheduleReconciliationRun(dependencies, baseInput);
  assert(createdRuns.length === 1, "Run must be created exactly once.");
  assert(completedRuns.length === 1, "Run must be completed exactly once.");
  assert(candidateCalls[0] === 100, "Default limit must be 100.");
  assert(JSON.stringify(createdRuns[0]) === JSON.stringify({
    workspaceId: baseInput.workspaceId,
    system: "backlinks",
    runKind: "backlinks.outreach.maintenance",
    idempotencyKey: baseInput.idempotencyKey,
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: null,
    scheduledAt: baseInput.scheduledAt,
    input: { operation: "schedule_reconciliation", limit: 100 },
  }), "Run creation input must be canonical.");
  assert(preview.scanned === 7, "Preview must count the scanned candidates.");
  assert(preview.wouldScheduleFollowUp === 2, "Preview must count follow-up schedules.");
  assert(preview.wouldScheduleFinalResponse === 1, "Preview must count final response schedules.");
  assert(preview.existing === 1, "Preview must count existing schedules.");
  assert(preview.notApplicable === 2, "Preview must count not applicable items.");
  assert(preview.conflicts === 1, "Preview must count conflicts in the nominal fixture.");
  assert(preview.items.every((item) => !("contact" in item) && !("provider" in item) && !("subject" in item) && !("body" in item)), "Preview items must stay public.");
  assert(preview.items.some((item) => item.disposition === "existing" && item.reason === "SCHEDULE_ALREADY_PRESENT"), "Existing classification must be preserved.");

  const limitedPreview = await previewBacklinkOutreachScheduleReconciliationRun(dependencies, { ...baseInput, idempotencyKey: "maintenance:2026-08-13:limit", limit: 500 });
  assert(candidateCalls[1] === 200, "Limit must clamp to 200.");
  assert(completedRuns.length >= 2, "Run completion must be repeated for the second preview.");
  assert(limitedPreview.scanned === 7, "Second preview must remain deterministic.");

  assert(latestAttemptCalls > 0 && openAttemptCalls > 0 && contactCalls > 0 && stopEffectCalls > 0, "Runner must rely on read-only dependencies.");

  console.log("PASS — Backlink outreach schedule reconciliation runner smoke");
}

void main();
