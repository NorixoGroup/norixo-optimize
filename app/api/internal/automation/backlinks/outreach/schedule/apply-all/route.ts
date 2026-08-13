import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  runBacklinkOutreachScheduleApplyOrchestration,
  type BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl,
} from "@/lib/automation/backlink-outreach-schedule-apply-orchestrator";
import { applyBacklinkOutreachScheduleReconciliationAutomation } from "@/lib/backlinks/services/outreachScheduleApplyService";
import { completeAutomationRun, createOrGetAutomationRun } from "@/lib/automation/repositories/automationRunsRepository";
import { listBacklinkOutreach } from "@/lib/backlinks/repositories/outreachRepository";
import { reconcileBacklinkOutreachFollowUpSchedule } from "@/lib/backlinks/repositories/outreachRepository";
import {
  getLatestBacklinkOutreachAttemptForOutreach,
  getOpenBacklinkOutreachAttemptForOutreach,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/types/database.types";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

type ApplyAllBody = {
  workspaceLimit?: number;
  outreachLimitPerWorkspace?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApplyAllBody(value: unknown): ApplyAllBody | null {
  if (value == null) return {};
  if (!isRecord(value)) return null;
  const body = value as { workspaceLimit?: unknown; outreachLimitPerWorkspace?: unknown };
  const keys = Object.keys(value);
  if (
    keys.length > 2 ||
    (keys.length === 1 && keys[0] !== "workspaceLimit" && keys[0] !== "outreachLimitPerWorkspace") ||
    (keys.length === 2 &&
      (!keys.includes("workspaceLimit") || !keys.includes("outreachLimitPerWorkspace")))
  ) {
    return null;
  }
  const { workspaceLimit, outreachLimitPerWorkspace } = body;
  if (workspaceLimit != null && typeof workspaceLimit !== "number") {
    return null;
  }
  if (
    typeof workspaceLimit === "number" &&
    (!Number.isInteger(workspaceLimit) || workspaceLimit < 1 || workspaceLimit > 100)
  ) {
    return null;
  }
  if (outreachLimitPerWorkspace != null && typeof outreachLimitPerWorkspace !== "number") {
    return null;
  }
  if (
    typeof outreachLimitPerWorkspace === "number" &&
    (!Number.isInteger(outreachLimitPerWorkspace) ||
      outreachLimitPerWorkspace < 1 ||
      outreachLimitPerWorkspace > 200)
  ) {
    return null;
  }
  return {
    workspaceLimit: typeof workspaceLimit === "number" ? workspaceLimit : undefined,
    outreachLimitPerWorkspace:
      typeof outreachLimitPerWorkspace === "number" ? outreachLimitPerWorkspace : undefined,
  };
}

function invalidInputResponse() {
  return NextResponse.json(
    { ok: false, error: { code: "INVALID_INPUT", message: "Invalid automation outreach schedule apply-all input" } },
    { status: 400 },
  );
}

function failureResponse() {
  return NextResponse.json(
    { ok: false, error: { code: "AUTOMATION_OUTREACH_SCHEDULE_APPLY_ALL_FAILED", message: "Unable to run automation outreach schedule apply-all" } },
    { status: 500 },
  );
}

async function authenticateInternalRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (CRON_SECRET.length > 0 && authorization === `Bearer ${CRON_SECRET}`) {
    return { kind: "cron" as const };
  }

  const authHeader = authorization.toLowerCase();
  if (!authHeader.startsWith("bearer ")) {
    return null;
  }

  const client = createRequestSupabaseClient(request);
  const token = authorization.slice(7).trim();
  const {
    data: { user },
  } = await client.auth.getUser(token);
  if (user == null || !isAdminPrivateEmail(user.email)) {
    return null;
  }

  return { kind: "admin" as const, user, client };
}

export async function POST(request: NextRequest) {
  const auth = await authenticateInternalRequest(request);
  if (auth == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.kind === "admin" && !isAdminPrivateEmail(auth.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = parseApplyAllBody(await request.json().catch(() => null));
  if (body == null) {
    return invalidInputResponse();
  }

  const adminClient = createSupabaseAdminClient();
  const serverNow = new Date().toISOString();

  try {
    const result = await runBacklinkOutreachScheduleApplyOrchestration(
      {
        now: () => serverNow,
        listEligibleWorkspaces: async (limit) => {
          const { data, error } = await adminClient
            .from("automation_workspace_controls")
            .select(
              "workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason",
            )
            .eq("backlinks_enabled", true)
            .eq("dry_run_only", true)
            .eq("backlink_outreach_schedule_apply_enabled", true)
            .is("disabled_reason", null)
            .order("workspace_id", { ascending: true })
            .limit(limit);
          if (error != null) {
            throw error;
          }
          return (
            data?.map((row) => ({
              workspaceId: row.workspace_id,
              backlinksEnabled: row.backlinks_enabled,
              backlinkOutreachScheduleApplyEnabled: row.backlink_outreach_schedule_apply_enabled,
              dryRunOnly: row.dry_run_only,
              disabledReason: row.disabled_reason,
            })) ?? []
          ) as BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl[];
        },
        applyWorkspace: async ({ workspaceId, outreachLimit, scheduledAt }) => {
          const { data: control, error: controlError } = await adminClient
            .from("automation_workspace_controls")
            .select("workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason")
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          if (controlError != null) {
            throw controlError;
          }
          if (
            control == null ||
            control.backlinks_enabled !== true ||
            control.backlink_outreach_schedule_apply_enabled !== true ||
            control.dry_run_only !== true ||
            control.disabled_reason != null
          ) {
            throw new Error("APPLY_NOT_ENABLED");
          }

          const createRun = await createOrGetAutomationRun(adminClient, {
            workspaceId,
            system: "backlinks",
            runKind: "backlinks.outreach.maintenance",
            idempotencyKey: `backlinks:outreach:schedule:apply:${workspaceId}:${scheduledAt.slice(0, 13)}`,
            mode: "dry_run",
            triggerSource: "internal",
            requestedBy: null,
            scheduledAt,
            input: { operation: "schedule_apply", limit: outreachLimit } as Json,
          });

          const result = await applyBacklinkOutreachScheduleReconciliationAutomation(
            {
              getWorkspaceControl: async () => ({
                workspaceId,
                backlinksEnabled: true,
                backlinkOutreachScheduleApplyEnabled: true,
                dryRunOnly: true,
                disabledReason: null,
                createdAt: scheduledAt,
                updatedAt: scheduledAt,
              }),
              listCandidates: async (workspaceIdInput, limit) => {
                const page = await listBacklinkOutreach(adminClient, {
                  workspaceId: workspaceIdInput,
                  pagination: { page: 1, pageSize: limit },
                });
                return page.items.map((item) => ({
                  id: item.id,
                  workspace_id: item.workspace_id,
                  contact_id: item.contact_id,
                  status: item.status,
                  channel: item.channel,
                  current_attempt: item.current_attempt,
                  max_attempts: item.max_attempts,
                  last_attempt_at: item.last_attempt_at,
                  next_follow_up_at: item.next_follow_up_at,
                  response_deadline_at: item.response_deadline_at,
                }));
              },
              getLatestAttempt: async (workspaceIdInput, outreachId) => {
                const row = await getLatestBacklinkOutreachAttemptForOutreach(adminClient, workspaceIdInput, outreachId);
                return row == null ? null : { status: row.status };
              },
              getOpenAttempt: async (workspaceIdInput, outreachId) => {
                const row = await getOpenBacklinkOutreachAttemptForOutreach(adminClient, workspaceIdInput, outreachId);
                return row == null ? null : { status: row.status };
              },
              getContact: async (workspaceIdInput, contactId) => {
                const row = await getBacklinkContactById(adminClient, workspaceIdInput, contactId);
                return row == null ? null : { contact_status: row.contact_status, email_normalized: row.email_normalized };
              },
              hasInboundReplyStopEffect: (workspaceIdInput, outreachId) =>
                hasBacklinkOutreachInboundReplyStopEffect(adminClient, workspaceIdInput, outreachId),
              reconcileSchedule: (workspaceIdInput, outreachId, input) =>
                reconcileBacklinkOutreachFollowUpSchedule(adminClient, workspaceIdInput, outreachId, input),
            },
            { workspaceId, limit: outreachLimit },
          );

          const completedRun = await completeAutomationRun(adminClient, {
            workspaceId,
            runId: createRun.run.id,
            completedAt: scheduledAt,
            summary: {
              operation: "schedule_apply",
              workspaceId,
              scheduled: result.scheduled,
              existing: result.existing,
              notApplicable: result.notApplicable,
              conflicts: result.conflicts,
              failed: result.failed,
              scanned: result.scanned,
            } as Json,
          });
          if (completedRun == null && createRun.kind === "created") {
            throw new Error("BACKLINK_OUTREACH_SCHEDULE_APPLY_RUN_COMPLETION_REJECTED");
          }

          return {
            workspaceId,
            runDisposition: createRun.kind,
            result,
          };
        },
      },
      {
        workspaceLimit: body.workspaceLimit,
        outreachLimitPerWorkspace: body.outreachLimitPerWorkspace,
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof Error && error.message === "APPLY_NOT_ENABLED") {
      return NextResponse.json({ error: "Automation schedule apply not enabled." }, { status: 409 });
    }
    console.error("[automation/backlinks/outreach/schedule/apply-all] request failed");
    return failureResponse();
  }
}
