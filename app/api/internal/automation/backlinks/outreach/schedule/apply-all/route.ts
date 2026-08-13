import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { runBacklinkOutreachScheduleApplyOrchestration } from "@/lib/automation/backlink-outreach-schedule-apply-orchestrator";
import { createBacklinkOutreachScheduleApplyRun } from "@/lib/automation/repositories/backlinkOutreachScheduleApplyRunsRepository";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/types/database.types";
import {
  BACKLINKS_OUTREACH_SCHEDULE_APPLY_LOCK_KEY,
  runBacklinkOutreachScheduleApply,
} from "@/lib/automation/backlink-outreach-schedule-apply-runner";

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

function alreadyRunningResponse() {
  return NextResponse.json({
    ok: true,
    result: {
      disposition: "already_running",
      workspacesScanned: 0,
      workspacesSucceeded: 0,
      workspacesFailed: 0,
      runsCreated: 0,
      runsExisting: 0,
      scheduled: 0,
      existing: 0,
      notApplicable: 0,
      conflicts: 0,
      failed: 0,
      workspaces: [],
      issues: [],
    },
    audit: null,
  });
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
  const startedAt = new Date().toISOString();

  try {
    const outcome = await runBacklinkOutreachScheduleApply(adminClient, {
      triggerKind: auth.kind === "cron" ? "cron" : "manual_internal",
      startedAt,
      workspaceLimit: body.workspaceLimit ?? 25,
      outreachLimitPerWorkspace: body.outreachLimitPerWorkspace ?? 100,
    });

    if (outcome.disposition === "already_running") {
      return alreadyRunningResponse();
    }
    const result = outcome.result;

    const completedAt = new Date().toISOString();
    const audit = await createBacklinkOutreachScheduleApplyRun(adminClient, {
      workspaceId: null,
      workspaceScope: result.workspaces.map((workspace) => workspace.workspaceId),
      triggerKind: auth.kind === "cron" ? "cron" : "manual_internal",
      startedAt,
      completedAt,
      workspacesScanned: result.workspacesScanned,
      workspacesApplied: result.workspacesSucceeded,
      workspacesFailed: result.workspacesFailed,
      outreachScanned: result.scheduled + result.existing + result.notApplicable + result.conflicts + result.failed,
      scheduled: result.scheduled,
      existing: result.existing,
      notApplicable: result.notApplicable,
      conflicts: result.conflicts,
      failed: result.failed,
      workspaceResults: result.workspaces,
    });

    return NextResponse.json({ ok: true, result, audit });
  } catch (error) {
    if (error instanceof Error && error.message === "APPLY_NOT_ENABLED") {
      return NextResponse.json({ error: "Automation schedule apply not enabled." }, { status: 409 });
    }
    console.error("[automation/backlinks/outreach/schedule/apply-all] request failed");
    return failureResponse();
  }
}
