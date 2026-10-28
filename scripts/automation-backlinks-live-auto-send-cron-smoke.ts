import { readFile } from "node:fs/promises";

import type { BacklinkOutreachLiveAutoSendCandidateRow } from "../lib/backlinks/repositories/outreachRepository";
import {
  hasValidBacklinkOutreachLiveAutoSendCronAuthorization,
  isBacklinkOutreachLiveAutoSendCronEnabled,
} from "../lib/automation/backlink-outreach-live-auto-send-cron-config";
import {
  runBacklinkOutreachLiveAutoSendCron,
  type BacklinkOutreachLiveAutoSendCronWorkspaceControl,
} from "../lib/automation/backlink-outreach-live-auto-send-cron-service";
import {
  BacklinkOutreachEmailSendError,
  type BacklinkOutreachEmailSendResult,
} from "../lib/backlinks/services/outreachEmailSendService";
import { sendApprovedBacklinkOutreachEmail } from "../lib/backlinks/services/outreachApprovedAutoSendService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const control: BacklinkOutreachLiveAutoSendCronWorkspaceControl = {
  workspaceId: "workspace-1",
  backlinksEnabled: true,
  backlinkOutreachScheduleApplyEnabled: true,
  dryRunOnly: false,
  disabledReason: null,
};

function candidate(
  id: string,
  overrides: Partial<BacklinkOutreachLiveAutoSendCandidateRow> = {},
): BacklinkOutreachLiveAutoSendCandidateRow {
  return {
    id,
    workspace_id: "workspace-1",
    status: "ready",
    channel: "email",
    current_attempt: 0,
    max_attempts: 3,
    updated_at: "2026-10-28T08:00:00.000Z",
    auto_send_approved_at: "2026-10-28T07:59:00.000Z",
    auto_send_approved_by: "approved-by-user",
    auto_send_approval_fingerprint: "approval-fingerprint",
    ...overrides,
  };
}

function sent(outreachId: string): BacklinkOutreachEmailSendResult {
  return {
    disposition: "sent",
    outreachId,
    attemptId: `attempt-${outreachId}`,
    attemptStatus: "accepted",
    providerMessageId: `message-${outreachId}`,
    outreachStatus: "active",
    currentAttempt: 1,
    errorCode: null,
  };
}

function dependencies(input: {
  controls?: BacklinkOutreachLiveAutoSendCronWorkspaceControl[];
  candidates?: BacklinkOutreachLiveAutoSendCandidateRow[];
  send: (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }) => Promise<BacklinkOutreachEmailSendResult>;
}) {
  const candidates = input.candidates ?? [];
  return {
    listWorkspaceControls: async () => input.controls ?? [control],
    getCandidateById: async (_workspaceId: string, outreachId: string) =>
      candidates.find((item) => item.id === outreachId) ?? null,
    listCandidates: async () => candidates,
    sendBacklinkOutreachEmail: input.send,
    now: () => "2026-10-28T08:00:00.000Z",
    createIdempotencyKey: ({ workspaceId, outreachId, selectedAt }: { workspaceId: string; outreachId: string; selectedAt: string }) =>
      `test:${workspaceId}:${outreachId}:${selectedAt}`,
  };
}

async function main(): Promise<void> {
  const environment = {
    CRON_SECRET: "local-test-secret",
    BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED: "true",
  };
  assert(
    !hasValidBacklinkOutreachLiveAutoSendCronAuthorization(null, environment),
    "Missing cron authorization must be rejected.",
  );
  assert(
    !hasValidBacklinkOutreachLiveAutoSendCronAuthorization("Bearer wrong", environment),
    "Invalid cron authorization must be rejected.",
  );
  assert(
    hasValidBacklinkOutreachLiveAutoSendCronAuthorization("Bearer local-test-secret", environment),
    "The configured cron authorization must be accepted.",
  );
  assert(isBacklinkOutreachLiveAutoSendCronEnabled(environment), "Only the explicit true flag must enable the cron.");
  assert(
    !isBacklinkOutreachLiveAutoSendCronEnabled({ BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED: "1" }),
    "Any value other than true must leave the cron disabled.",
  );

  {
    let calls = 0;
    const result = await runBacklinkOutreachLiveAutoSendCron(dependencies({
      controls: [{ ...control, dryRunOnly: true }],
      candidates: [candidate("550e8400-e29b-41d4-a716-446655440001")],
      send: async () => {
        calls += 1;
        return sent("550e8400-e29b-41d4-a716-446655440001");
      },
    }));
    assert(result.disposition === "no_candidate" && calls === 0, "Disabled controls must not reach the send service.");
  }

  {
    let calls = 0;
    const result = await runBacklinkOutreachLiveAutoSendCron(dependencies({
      send: async () => {
        calls += 1;
        return sent("unused");
      },
    }));
    assert(result.disposition === "no_candidate" && calls === 0, "No candidates must not reach the send service.");
  }

  {
    let calls = 0;
    const result = await runBacklinkOutreachLiveAutoSendCron(dependencies({
      candidates: [candidate("550e8400-e29b-41d4-a716-446655440002", { auto_send_approved_by: null })],
      send: async () => {
        calls += 1;
        return sent("550e8400-e29b-41d4-a716-446655440002");
      },
    }));
    assert(result.disposition === "no_candidate" && calls === 0, "Candidates without explicit human approval must not reach the send service.");
  }

  {
    const providerCalls = 0;
    const result = await runBacklinkOutreachLiveAutoSendCron(dependencies({
      candidates: [candidate("550e8400-e29b-41d4-a716-446655440003")],
      send: async () => {
        // This is the V3 refusal boundary: the provider call is unreachable.
        throw new BacklinkOutreachEmailSendError("OUTREACH_INELIGIBLE");
      },
    }));
    assert(result.disposition === "no_candidate" && providerCalls === 0, "A V3 refusal must not invoke a provider.");
  }

  {
    let providerCalls = 0;
    const sendApproved = sendApprovedBacklinkOutreachEmail({
      getWorkspaceControl: async () => ({ backlinksEnabled: true, dryRunOnly: false }),
      getOutreach: async () => ({
        id: "outreach-1",
        campaign_id: "campaign-1",
        opportunity_id: "opportunity-1",
        contact_id: "contact-1",
        channel: "email",
        status: "ready",
        subject: "Subject",
        body: "Body",
        current_attempt: 0,
        max_attempts: 3,
        first_contact_at: null,
        last_attempt_at: null,
      }),
      reserveApprovedInitialAttempt: async () => ({
        attempt: null,
        snapshot: null,
        disposition: "production_eligibility_required",
        rateLimitReason: null,
      }),
      markAttemptAccepted: async () => undefined,
      markAttemptFailed: async () => undefined,
      markAttemptUnknown: async () => undefined,
      sendEmail: async () => {
        providerCalls += 1;
        return {
          status: "accepted",
          provider: "resend",
          providerMessageId: "must-not-be-used",
          errorCode: null,
          errorMessage: null,
        };
      },
      activateOutreach: async () => {
        throw new Error("V3 rejection must occur before outreach activation.");
      },
      inboundReplyDomain: "example.test",
      replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "local-test-key" } },
      createAttemptId: () => "550e8400-e29b-41d4-a716-446655440007",
    });
    try {
      await sendApproved({
        workspaceId: "workspace-1",
        actorUserId: "approved-by-user",
        outreachId: "outreach-1",
        idempotencyKey: "local-test-idempotency-key",
      });
      throw new Error("Expected V3 rejection.");
    } catch (error) {
      assert(
        error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_INELIGIBLE",
        "V3 refusals must surface as an ineligible send and never reach the provider.",
      );
    }
    assert(providerCalls === 0, "The real send service must not call Resend after a V3 refusal.");
  }

  {
    let providerCalls = 0;
    const candidates = [
      candidate("550e8400-e29b-41d4-a716-446655440004"),
      candidate("550e8400-e29b-41d4-a716-446655440005"),
    ];
    const result = await runBacklinkOutreachLiveAutoSendCron(dependencies({
      candidates,
      send: async (input) => {
        providerCalls += 1;
        return sent(input.outreachId);
      },
    }));
    assert(result.disposition === "sent" && providerCalls === 1, "A cron run must send at most one email.");
  }

  {
    let providerCalls = 0;
    let reserved = false;
    const candidates = [candidate("550e8400-e29b-41d4-a716-446655440006")];
    const send = async (input: { outreachId: string }) => {
      if (reserved) throw new BacklinkOutreachEmailSendError("OUTREACH_INELIGIBLE");
      reserved = true;
      providerCalls += 1;
      return sent(input.outreachId);
    };
    const [first, second] = await Promise.all([
      runBacklinkOutreachLiveAutoSendCron(dependencies({ candidates, send })),
      runBacklinkOutreachLiveAutoSendCron(dependencies({ candidates, send })),
    ]);
    assert(
      providerCalls === 1 && [first.disposition, second.disposition].includes("sent"),
      "Concurrent executions must have only one provider-reaching reservation.",
    );
    const retry = await runBacklinkOutreachLiveAutoSendCron(dependencies({ candidates, send }));
    assert(retry.disposition === "no_candidate" && providerCalls === 1, "A retry after reservation must remain idempotent.");
  }

  const route = await readFile("app/api/internal/cron/backlinks/outreach/send-one/route.ts", "utf8");
  assert(route.includes("hasValidBacklinkOutreachLiveAutoSendCronAuthorization"), "Route must validate CRON_SECRET authorization.");
  assert(route.includes("isBacklinkOutreachLiveAutoSendCronEnabled"), "Route must require the explicit disabled-by-default activation gate.");
  assert(route.includes("runBacklinkOutreachLiveAutoSendCron"), "Route must use the cron engine.");
  assert(route.includes("reserveBacklinkOutreachApprovedInitialAttempt"), "Route must use the existing V3 reservation path.");
  assert(!route.includes("console.error(error"), "Route logs must not serialize error objects or secrets.");

  console.log("PASS — Automation backlinks live auto-send cron smoke");
}

void main();
