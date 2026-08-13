import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { applyBacklinkOutreachScheduleReconciliationAutomation } from "@/lib/backlinks/services/outreachScheduleApplyService";
import {
  listBacklinkOutreachScheduleApplyCandidates,
  reconcileBacklinkOutreachFollowUpSchedule,
} from "@/lib/backlinks/repositories/outreachRepository";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import {
  getLatestBacklinkOutreachAttemptForOutreach,
  getOpenBacklinkOutreachAttemptForOutreach,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt } from "@/lib/automation/repositories/automationWorkspaceControlsRepository";

const WORKSPACE_ID_HEADER = "X-Norixo-Workspace-Id";

type ApplyBody = { limit?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function parseApplyBody(value: unknown): ApplyBody | null {
  if (value == null) return {};
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length > 1 || (keys.length === 1 && keys[0] !== "limit")) return null;
  if (!("limit" in value)) return {};
  const { limit } = value;
  return typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= 200 ? { limit } : null;
}

function invalidInputResponse() {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_INPUT", message: "Invalid automation outreach schedule apply input" } },
    { status: 400 },
  );
}

function failureResponse() {
  return NextResponse.json(
    { ok: false, error: { code: "AUTOMATION_OUTREACH_SCHEDULE_APPLY_FAILED", message: "Unable to run automation outreach schedule apply" } },
    { status: 500 },
  );
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

  const body = parseApplyBody(await request.json().catch(() => null));
  if (body == null) {
    return invalidInputResponse();
  }

  try {
    const client = createSupabaseAdminClient();
    const result = await applyBacklinkOutreachScheduleReconciliationAutomation(
      {
        getWorkspaceControl: async (workspaceId) => {
          const { data, error } = await client
            .from("automation_workspace_controls")
            .select("workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason, last_schedule_apply_attempt_at, created_at, updated_at")
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          if (error != null) {
            throw error;
          }
          return data == null
            ? null
            : {
                workspaceId: data.workspace_id,
                backlinksEnabled: data.backlinks_enabled,
                backlinkOutreachScheduleApplyEnabled: data.backlink_outreach_schedule_apply_enabled,
                dryRunOnly: data.dry_run_only,
                lastScheduleApplyAttemptAt: data.last_schedule_apply_attempt_at,
                disabledReason: data.disabled_reason,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
              };
        },
        listCandidates: async (workspaceId, limit) => {
          return listBacklinkOutreachScheduleApplyCandidates(client, workspaceId, limit);
        },
        markWorkspaceAttempt: async (workspaceId, attemptedAt) => {
          await markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt(client, {
            workspaceId,
            attemptedAt,
          });
        },
        getLatestAttempt: async (workspaceId, outreachId) => {
          const row = await getLatestBacklinkOutreachAttemptForOutreach(client, workspaceId, outreachId);
          return row == null ? null : { status: row.status };
        },
        getOpenAttempt: async (workspaceId, outreachId) => {
          const row = await getOpenBacklinkOutreachAttemptForOutreach(client, workspaceId, outreachId);
          return row == null ? null : { status: row.status };
        },
        getContact: async (workspaceId, contactId) => {
          const row = await getBacklinkContactById(client, workspaceId, contactId);
          return row == null ? null : { contact_status: row.contact_status, email_normalized: row.email_normalized };
        },
        hasInboundReplyStopEffect: (workspaceId, outreachId) =>
          hasBacklinkOutreachInboundReplyStopEffect(client, workspaceId, outreachId),
        reconcileSchedule: (workspaceId, outreachId, input) =>
          reconcileBacklinkOutreachFollowUpSchedule(client, workspaceId, outreachId, input),
      },
      { workspaceId: auth.workspace.id, limit: body.limit },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof Error && error.message === "APPLY_NOT_ENABLED") {
      return NextResponse.json({ error: "Automation schedule apply not enabled." }, { status: 409 });
    }
    console.error("[automation/backlinks/outreach/schedule/apply] request failed");
    return failureResponse();
  }
}
