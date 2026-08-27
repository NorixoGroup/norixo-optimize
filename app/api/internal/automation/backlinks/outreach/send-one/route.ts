import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import { getCampaignOpportunity } from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import { getBacklinkContactById, listBacklinkContactsByDomain } from "@/lib/backlinks/repositories/contactsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import {
  getBacklinkOutreachById,
  getBacklinkOutreachLiveAutoSendCandidateById,
  listBacklinkOutreachLiveAutoSendCandidates,
  listBacklinkOutreachByOpportunity,
  activateBacklinkOutreachAfterEmailAccepted,
  updateBacklinkOutreach,
} from "@/lib/backlinks/repositories/outreachRepository";
import {
  getBacklinkOutreachAttemptById,
  getBacklinkOutreachAttemptByIdempotencyKey,
  getOpenBacklinkOutreachAttemptForOutreach,
  reserveBacklinkOutreachAttempt,
  updateBacklinkOutreachAttemptState,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import {
  markBacklinkOutreachAttemptAccepted,
  markBacklinkOutreachAttemptFailed,
  markBacklinkOutreachAttemptUnknown,
} from "@/lib/backlinks/services/outreachAttemptService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { getBacklinkOutreachDraftEligibilityForMembership } from "@/lib/backlinks/services/outreachDraftEligibilityService";
import { sendBacklinkOutreachEmail, BacklinkOutreachEmailSendError } from "@/lib/backlinks/services/outreachEmailSendService";
import {
  BacklinkOutreachLiveAutoSendError,
  runBacklinkOutreachLiveAutoSend,
} from "@/lib/automation/backlink-outreach-live-auto-send-service";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const WORKSPACE_ID_HEADER = "X-Norixo-Workspace-Id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LiveAutoSendBody = {
  confirm: true;
  outreachId?: string;
};

type WorkspaceControlRow = {
  workspace_id: string;
  backlinks_enabled: boolean;
  backlink_outreach_schedule_apply_enabled: boolean;
  dry_run_only: boolean;
  disabled_reason: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function parseBody(value: unknown): LiveAutoSendBody | null {
  if (value == null || !isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (
    keys.length > 2 ||
    !keys.includes("confirm") ||
    (keys.includes("outreachId") && keys.length !== 2) ||
    (!keys.includes("outreachId") && keys.length !== 1)
  ) {
    return null;
  }

  if (value.confirm !== true) {
    return null;
  }

  if (!("outreachId" in value)) {
    return { confirm: true };
  }

  const outreachId = value.outreachId;
  if (typeof outreachId !== "string" || !UUID_PATTERN.test(outreachId.trim())) {
    return null;
  }

  return { confirm: true, outreachId: outreachId.trim() };
}

function invalidInputResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid automation live auto-send input",
      },
    },
    { status: 400 },
  );
}

function notEnabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "LIVE_AUTO_SEND_NOT_ENABLED",
        message: "Live automatic outreach send is not enabled.",
      },
    },
    { status: 409 },
  );
}

function failureResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "LIVE_AUTO_SEND_FAILED",
        message: "Unable to run live automatic outreach send.",
      },
    },
    { status: 500 },
  );
}

function isEnabled(control: WorkspaceControlRow | null): control is WorkspaceControlRow {
  return control != null &&
    control.backlinks_enabled === true &&
    control.backlink_outreach_schedule_apply_enabled === true &&
    control.dry_run_only === false &&
    control.disabled_reason == null;
}

export async function POST(request: NextRequest) {
  const workspaceHeader = request.headers.get(WORKSPACE_ID_HEADER);
  if (workspaceHeader == null || workspaceHeader.trim().length === 0) {
    return invalidInputResponse();
  }
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = parseBody(await request.json().catch(() => null));
  if (body == null) {
    return invalidInputResponse();
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const transitions = {
      getAttempt: (workspaceId: string, attemptId: string) =>
        getBacklinkOutreachAttemptById(adminClient, workspaceId, attemptId),
      updateAttempt: (
        workspaceId: string,
        attemptId: string,
        patch: Parameters<typeof updateBacklinkOutreachAttemptState>[3],
      ) => updateBacklinkOutreachAttemptState(adminClient, workspaceId, attemptId, patch),
    };
    const { data: control, error: controlError } = await adminClient
      .from("automation_workspace_controls")
      .select(
        "workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason",
      )
      .eq("workspace_id", auth.workspace.id)
      .maybeSingle();

    if (controlError != null) {
      throw controlError;
    }

    if (!isEnabled(control)) {
      return notEnabledResponse();
    }

    const sendBacklinkOutreach = sendBacklinkOutreachEmail({
      eligibility: {
        getMembership: (input) =>
          getCampaignOpportunity(adminClient, input.workspaceId, input.campaignId, input.opportunityId),
        getOpportunity: (workspaceId, opportunityId) =>
          getBacklinkOpportunityById(adminClient, workspaceId, opportunityId),
        listContactsByDomain: (workspaceId, domainId) =>
          listBacklinkContactsByDomain(adminClient, workspaceId, domainId),
        listOutreachByOpportunity: (workspaceId, opportunityId) =>
          listBacklinkOutreachByOpportunity(adminClient, workspaceId, opportunityId),
      },
      getWorkspaceControl: async () => ({ dryRunOnly: control.dry_run_only }),
      getOutreach: (workspaceId, outreachId) =>
        getBacklinkOutreachById(adminClient, workspaceId, outreachId),
      getContact: (workspaceId, contactId) =>
        getBacklinkContactById(adminClient, workspaceId, contactId),
      getAttemptByIdempotencyKey: (workspaceId, idempotencyKey) =>
        getBacklinkOutreachAttemptByIdempotencyKey(adminClient, workspaceId, idempotencyKey),
      getOpenAttemptForOutreach: (workspaceId, outreachId) =>
        getOpenBacklinkOutreachAttemptForOutreach(adminClient, workspaceId, outreachId),
      updateOutreach: (workspaceId, outreachId, input) =>
        updateBacklinkOutreach(adminClient, workspaceId, outreachId, input),
      reserveAttempt: (workspaceId, input) =>
        reserveBacklinkOutreachAttempt(adminClient, workspaceId, input),
      markAttemptAccepted: markBacklinkOutreachAttemptAccepted(transitions),
      markAttemptFailed: markBacklinkOutreachAttemptFailed(transitions),
      markAttemptUnknown: markBacklinkOutreachAttemptUnknown(transitions),
      sendEmail: createEnvironmentOutreachEmailProvider(),
      activateOutreach: (workspaceId, outreachId, input) =>
        activateBacklinkOutreachAfterEmailAccepted(adminClient, workspaceId, outreachId, input),
      inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,
      replyTokenKeyring: getBacklinkOutreachReplyTokenKeyring(),
    });

    const result = await runBacklinkOutreachLiveAutoSend(
      {
        getCandidateById: (workspaceId, outreachId) =>
          getBacklinkOutreachLiveAutoSendCandidateById(adminClient, workspaceId, outreachId),
        listCandidates: (workspaceId, limit) =>
          listBacklinkOutreachLiveAutoSendCandidates(adminClient, workspaceId, limit),
        sendBacklinkOutreachEmail: sendBacklinkOutreach,
        now: () => new Date().toISOString(),
        createIdempotencyKey: ({ workspaceId, outreachId, selectedAt }) =>
          `automation:backlinks:live-auto-send:${workspaceId}:${outreachId}:${selectedAt}:${randomUUID()}`,
      },
      {
        workspaceId: auth.workspace.id,
        actorUserId: auth.user.id,
        workspaceControl: {
          backlinksEnabled: control.backlinks_enabled,
          backlinkOutreachScheduleApplyEnabled: control.backlink_outreach_schedule_apply_enabled,
          dryRunOnly: control.dry_run_only,
          disabledReason: control.disabled_reason,
        },
        outreachId: body.outreachId ?? null,
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof BacklinkOutreachLiveAutoSendError && error.code === "LIVE_AUTO_SEND_NOT_ENABLED") {
      return notEnabledResponse();
    }
    if (error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_SEND_DISABLED_BY_DRY_RUN") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: "External email sending is disabled while Backlinks is in dry-run mode.",
          },
        },
        { status: 409 },
      );
    }
    return failureResponse();
  }
}
