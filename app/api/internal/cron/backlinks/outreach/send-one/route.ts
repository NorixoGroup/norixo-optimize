import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  hasValidBacklinkOutreachLiveAutoSendCronAuthorization,
  isBacklinkOutreachLiveAutoSendCronEnabled,
} from "@/lib/automation/backlink-outreach-live-auto-send-cron-config";
import { runBacklinkOutreachLiveAutoSend } from "@/lib/automation/backlink-outreach-live-auto-send-service";
import { getAutomationWorkspaceControl } from "@/lib/automation/repositories/automationWorkspaceControlsRepository";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import {
  activateBacklinkOutreachAfterEmailAccepted,
  getBacklinkOutreachById,
  getBacklinkOutreachLiveAutoSendCandidateById,
} from "@/lib/backlinks/repositories/outreachRepository";
import {
  getBacklinkOutreachAttemptById,
  reserveBacklinkOutreachApprovedInitialAttempt,
  updateBacklinkOutreachAttemptState,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import {
  markBacklinkOutreachAttemptAccepted,
  markBacklinkOutreachAttemptFailed,
  markBacklinkOutreachAttemptUnknown,
} from "@/lib/backlinks/services/outreachAttemptService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { sendApprovedBacklinkOutreachEmail } from "@/lib/backlinks/services/outreachApprovedAutoSendService";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function disabledResponse() {
  return NextResponse.json(
    { error: "Backlink live auto-send cron is disabled" },
    { status: 409 },
  );
}

/**
 * This cron has no body and no header to carry a scheduled target: Vercel's cron trigger is a
 * fixed GET with only the Authorization header. There is no safe way to select a candidate
 * automatically (G4-M1), so both workspaceId and outreachId are mandatory query parameters.
 * Without them this route is unusable in a recurring schedule — intentionally, since it is not
 * registered in vercel.json and must not become one.
 */
function requiredUuidQueryParam(request: NextRequest, name: string): string | null {
  const value = request.nextUrl.searchParams.get(name);
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed && UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function invalidInputResponse() {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_INPUT", message: "workspaceId and outreachId query parameters are required." } },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const environment = {
    CRON_SECRET: process.env.CRON_SECRET,
    BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED: process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED,
  };
  if (!hasValidBacklinkOutreachLiveAutoSendCronAuthorization(
    request.headers.get("authorization"),
    environment,
  )) {
    return unauthorizedResponse();
  }
  if (!isBacklinkOutreachLiveAutoSendCronEnabled(environment)) {
    return disabledResponse();
  }
  const workspaceId = requiredUuidQueryParam(request, "workspaceId");
  const outreachId = requiredUuidQueryParam(request, "outreachId");
  if (workspaceId == null || outreachId == null) {
    return invalidInputResponse();
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const sendBacklinkOutreachEmail = sendApprovedBacklinkOutreachEmail({
      getWorkspaceControl: async (workspaceId) => {
        const control = await getAutomationWorkspaceControl(adminClient, workspaceId);
        return control == null
          ? null
          : { backlinksEnabled: control.backlinksEnabled, dryRunOnly: control.dryRunOnly };
      },
      getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(adminClient, workspaceId, outreachId),
      reserveApprovedInitialAttempt: (input) => reserveBacklinkOutreachApprovedInitialAttempt(adminClient, input),
      markAttemptAccepted: markBacklinkOutreachAttemptAccepted({
        getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(adminClient, workspaceId, attemptId),
        updateAttempt: (workspaceId, attemptId, patch) =>
          updateBacklinkOutreachAttemptState(adminClient, workspaceId, attemptId, patch),
      }),
      markAttemptFailed: markBacklinkOutreachAttemptFailed({
        getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(adminClient, workspaceId, attemptId),
        updateAttempt: (workspaceId, attemptId, patch) =>
          updateBacklinkOutreachAttemptState(adminClient, workspaceId, attemptId, patch),
      }),
      markAttemptUnknown: markBacklinkOutreachAttemptUnknown({
        getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(adminClient, workspaceId, attemptId),
        updateAttempt: (workspaceId, attemptId, patch) =>
          updateBacklinkOutreachAttemptState(adminClient, workspaceId, attemptId, patch),
      }),
      sendEmail: createEnvironmentOutreachEmailProvider(),
      activateOutreach: (workspaceId, outreachId, input) =>
        activateBacklinkOutreachAfterEmailAccepted(adminClient, workspaceId, outreachId, input),
      inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,
      replyTokenKeyring: getBacklinkOutreachReplyTokenKeyring(),
    });

    const [control, candidate] = await Promise.all([
      getAutomationWorkspaceControl(adminClient, workspaceId),
      getBacklinkOutreachLiveAutoSendCandidateById(adminClient, workspaceId, outreachId),
    ]);
    // The actor is always the human who already approved this exact send (auto_send_approved_by),
    // never a fabricated identity: if no approved candidate exists, there is nothing to attribute
    // and the service call below resolves to "no_candidate" without reaching the provider.
    const actorUserId = candidate?.auto_send_approved_by ?? null;
    if (actorUserId == null) {
      return NextResponse.json({ disposition: "no_candidate", outreachId: null });
    }

    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: (scopeWorkspaceId, scopeOutreachId) =>
          getBacklinkOutreachLiveAutoSendCandidateById(adminClient, scopeWorkspaceId, scopeOutreachId),
        sendBacklinkOutreachEmail,
        now: () => new Date().toISOString(),
        createIdempotencyKey: ({ workspaceId: idWorkspaceId, outreachId: idOutreachId, selectedAt }) =>
          `automation:backlinks:live-auto-send:cron:${idWorkspaceId}:${idOutreachId}:${selectedAt}:${randomUUID()}`,
      },
      {
        workspaceId,
        actorUserId,
        workspaceControl: control,
        outreachId,
      },
    );

    return NextResponse.json({ disposition: result.disposition, outreachId: result.outreachId });
  } catch {
    console.error("[automation/backlinks/outreach/send-one/cron] request failed");
    return NextResponse.json(
      { error: "Unable to run backlink live auto-send cron" },
      { status: 500 },
    );
  }
}
