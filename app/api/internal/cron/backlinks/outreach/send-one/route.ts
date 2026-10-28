import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  hasValidBacklinkOutreachLiveAutoSendCronAuthorization,
  isBacklinkOutreachLiveAutoSendCronEnabled,
} from "@/lib/automation/backlink-outreach-live-auto-send-cron-config";
import { runBacklinkOutreachLiveAutoSendCron } from "@/lib/automation/backlink-outreach-live-auto-send-cron-service";
import {
  getAutomationWorkspaceControl,
  listAutomationWorkspaceControlsForBacklinkLiveAutoSend,
} from "@/lib/automation/repositories/automationWorkspaceControlsRepository";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import {
  activateBacklinkOutreachAfterEmailAccepted,
  getBacklinkOutreachById,
  getBacklinkOutreachLiveAutoSendCandidateById,
  listBacklinkOutreachLiveAutoSendCandidates,
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

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function disabledResponse() {
  return NextResponse.json(
    { error: "Backlink live auto-send cron is disabled" },
    { status: 409 },
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

    const result = await runBacklinkOutreachLiveAutoSendCron({
      listWorkspaceControls: async (limit) =>
        (await listAutomationWorkspaceControlsForBacklinkLiveAutoSend(adminClient, limit)).map((control) => ({
          workspaceId: control.workspaceId,
          backlinksEnabled: control.backlinksEnabled,
          backlinkOutreachScheduleApplyEnabled: control.backlinkOutreachScheduleApplyEnabled,
          dryRunOnly: control.dryRunOnly,
          disabledReason: control.disabledReason,
        })),
      getCandidateById: (workspaceId, outreachId) =>
        getBacklinkOutreachLiveAutoSendCandidateById(adminClient, workspaceId, outreachId),
      listCandidates: (workspaceId, limit) =>
        listBacklinkOutreachLiveAutoSendCandidates(adminClient, workspaceId, limit),
      sendBacklinkOutreachEmail,
      now: () => new Date().toISOString(),
      createIdempotencyKey: ({ workspaceId, outreachId, selectedAt }) =>
        `automation:backlinks:live-auto-send:cron:${workspaceId}:${outreachId}:${selectedAt}:${randomUUID()}`,
    });

    return NextResponse.json({
      disposition: result.disposition,
      workspacesScanned: result.workspacesScanned,
      candidatesConsidered: result.candidatesConsidered,
    });
  } catch {
    console.error("[automation/backlinks/outreach/send-one/cron] request failed");
    return NextResponse.json(
      { error: "Unable to run backlink live auto-send cron" },
      { status: 500 },
    );
  }
}
