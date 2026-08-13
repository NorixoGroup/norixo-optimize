import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { runBacklinkOutreachMaintenanceOrchestration } from "@/lib/automation/backlink-outreach-maintenance-orchestrator";
import { completeAutomationRun } from "@/lib/automation/repositories/automationRunsRepository";
import { createOrGetAutomationRun } from "@/lib/automation/repositories/automationRunsRepository";
import { createOrGetAutomationTask } from "@/lib/automation/repositories/automationTasksRepository";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import {
  getLatestBacklinkOutreachAttemptForOutreach,
  getOpenBacklinkOutreachAttemptForOutreach,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import { previewBacklinkOutreachScheduleReconciliationRun } from "@/lib/backlinks/services/outreachScheduleReconciliationService";
import { previewBacklinkOutreachSignalDetectionRun } from "@/lib/automation/backlink-outreach-maintenance-runner";
import { listBacklinkOutreach } from "@/lib/backlinks/repositories/outreachRepository";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import type { Json } from "@/types/database.types";

type InternalAutomationTickBody = {
  workspaceLimit?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInternalAutomationTickBody(
  value: unknown,
): InternalAutomationTickBody | null {
  if (value == null) {
    return {};
  }
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (keys.length > 1 || (keys.length === 1 && keys[0] !== "workspaceLimit")) {
    return null;
  }

  if (!("workspaceLimit" in value)) {
    return {};
  }

  const { workspaceLimit } = value;
  return typeof workspaceLimit === "number" &&
    Number.isInteger(workspaceLimit) &&
    workspaceLimit >= 1 &&
    workspaceLimit <= 100
    ? { workspaceLimit }
    : null;
}

function getAuthorizationToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function authenticateInternalAutomationRequest(request: NextRequest) {
  const token = getAuthorizationToken(request);
  if (token == null) {
    return null;
  }

  const client = createRequestSupabaseClient(request);
  const {
    data: { user },
  } = await client.auth.getUser(token);

  if (user == null || !isAdminPrivateEmail(user.email)) {
    return null;
  }

  return { client, user };
}

function invalidInputResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid automation outreach tick input",
      },
    },
    { status: 400 },
  );
}

function failureResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "AUTOMATION_OUTREACH_TICK_FAILED",
        message: "Unable to run automation outreach tick",
      },
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authenticateInternalAutomationRequest(request);
  if (auth == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseInternalAutomationTickBody(await request.json().catch(() => null));
  if (body == null) {
    return invalidInputResponse();
  }

  const adminClient = createSupabaseAdminClient();
  const serverNow = new Date().toISOString();

  try {
    const result = await runBacklinkOutreachMaintenanceOrchestration(
      {
        now: () => serverNow,
        listEligibleWorkspaces: async (limit) => {
          const { data, error } = await adminClient
            .from("automation_workspace_controls")
            .select("workspace_id, backlinks_enabled, dry_run_only, disabled_reason")
            .eq("backlinks_enabled", true)
            .eq("dry_run_only", true)
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
              dryRunOnly: row.dry_run_only,
              disabledReason: row.disabled_reason,
            })) ?? []
          );
        },
        previewScheduleReconciliation: async (input) => {
          let disposition: "created" | "existing" | null = null;
          const result = await previewBacklinkOutreachScheduleReconciliationRun(
            {
              createRun: async (runInput) => {
                const created = await createOrGetAutomationRun(adminClient, {
                  ...runInput,
                  input: runInput.input as Json,
                });
                disposition = created.kind;
                return created;
              },
              completeRun: async (runInput) => {
                const completed = await completeAutomationRun(adminClient, {
                  ...runInput,
                  summary: runInput.summary as Json | null,
                });
                return completed == null
                  ? { kind: "rejected", reason: "not_updated" as const }
                  : { kind: "transitioned", run: completed };
              },
              listCandidates: async (workspaceId, limit) => {
                const page = await listBacklinkOutreach(adminClient, {
                  workspaceId,
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
              getLatestAttempt: async (workspaceId, outreachId) => {
                const row = await getLatestBacklinkOutreachAttemptForOutreach(
                  adminClient,
                  workspaceId,
                  outreachId,
                );
                return row == null ? null : { status: row.status };
              },
              getOpenAttempt: async (workspaceId, outreachId) => {
                const row = await getOpenBacklinkOutreachAttemptForOutreach(
                  adminClient,
                  workspaceId,
                  outreachId,
                );
                return row == null ? null : { status: row.status };
              },
              getContact: async (workspaceId, contactId) => {
                const row = await getBacklinkContactById(adminClient, workspaceId, contactId);
                return {
                  contact_status: row.contact_status,
                  email_normalized: row.email_normalized,
                };
              },
              hasInboundReplyStopEffect: (workspaceId, outreachId) =>
                hasBacklinkOutreachInboundReplyStopEffect(
                  adminClient,
                  workspaceId,
                  outreachId,
                ),
            },
            { ...input, requestedBy: null },
          );
          if (disposition == null) {
            throw new Error("BACKLINK_OUTREACH_SCHEDULE_RECONCILIATION_RUN_DISPOSITION_MISSING");
          }
          return { disposition, result };
        },
        previewSignalDetection: async (input) => {
          let disposition: "created" | "existing" | null = null;
          const result = await previewBacklinkOutreachSignalDetectionRun(
            {
              client: adminClient,
              createRun: async (runInput) => {
                const created = await createOrGetAutomationRun(adminClient, {
                  ...runInput,
                  input: runInput.input as Json,
                });
                disposition = created.kind;
                return created;
              },
              completeRun: async (runInput) => {
                const completed = await completeAutomationRun(adminClient, {
                  ...runInput,
                  summary: runInput.summary as Json | null,
                });
                return completed == null
                  ? { kind: "rejected", reason: "not_updated" as const }
                  : { kind: "transitioned", run: completed };
              },
              createTask: async (taskInput) => createOrGetAutomationTask(adminClient, taskInput),
            },
            input,
          );
          if (disposition == null) {
            throw new Error("BACKLINK_OUTREACH_SIGNAL_DETECTION_RUN_DISPOSITION_MISSING");
          }
          return { disposition, result };
        },
      },
      body,
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[automation/backlinks/outreach/tick] request failed", error);
    return failureResponse();
  }
}
