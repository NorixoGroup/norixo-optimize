import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createBacklinkVerificationProductionComposition } from "@/lib/backlinks/verification/production-composition";
import {
  readBacklinkReverificationRuntimeConfig,
  runBacklinkReverificationAutomation,
} from "@/lib/backlinks/verification";
import {
  getBacklinkVerificationJobByKey,
  createBacklinkVerificationJob,
} from "@/lib/backlinks/repositories/verificationJobsRepository";
import { listBacklinkReverificationCandidates } from "@/lib/backlinks/repositories/linksRepository";
import { listAutomationWorkspaceControlsForBacklinkReverification } from "@/lib/automation/repositories/automationWorkspaceControlsRepository";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ReverificationAutomationBody = {
  workspaceLimit?: number;
  candidateLimitPerWorkspace?: number;
  schedulerMaxIterations?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function parseBody(value: unknown): ReverificationAutomationBody | null {
  if (value == null) {
    return {};
  }

  if (!isRecord(value)) {
    return null;
  }

  const expectedKeys = ["workspaceLimit", "candidateLimitPerWorkspace", "schedulerMaxIterations"];
  const keys = Object.keys(value);
  if (!keys.every((key) => expectedKeys.includes(key))) {
    return null;
  }

  const { workspaceLimit, candidateLimitPerWorkspace, schedulerMaxIterations } = value;
  for (const [fieldName, fieldValue, max] of [
    ["workspaceLimit", workspaceLimit, 100],
    ["candidateLimitPerWorkspace", candidateLimitPerWorkspace, 200],
    ["schedulerMaxIterations", schedulerMaxIterations, 100],
  ] as const) {
    if (
      fieldValue != null &&
      (typeof fieldValue !== "number" ||
        !Number.isInteger(fieldValue) ||
        fieldValue < 1 ||
        fieldValue > max)
    ) {
      return null;
    }
  }

  return {
    ...(typeof workspaceLimit === "number" ? { workspaceLimit } : {}),
    ...(typeof candidateLimitPerWorkspace === "number"
      ? { candidateLimitPerWorkspace }
      : {}),
    ...(typeof schedulerMaxIterations === "number" ? { schedulerMaxIterations } : {}),
  };
}

async function authenticateInternalRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (cronSecret.length > 0 && authorization === `Bearer ${cronSecret}`) {
    return { kind: "cron" as const };
  }

  if (!authorization.toLowerCase().startsWith("bearer ")) {
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

  return { kind: "admin" as const, client, user };
}

export async function POST(request: NextRequest) {
  const auth = await authenticateInternalRequest(request);
  if (auth == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.kind === "admin" && !isAdminPrivateEmail(auth.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = parseBody(await request.json().catch(() => null));
  if (body == null) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "Invalid backlink reverification automation input",
        },
      },
      { status: 400 },
    );
  }

  const adminClient = createSupabaseAdminClient();
  const composition = createBacklinkVerificationProductionComposition();
  const config = readBacklinkReverificationRuntimeConfig();

  try {
    const result = await runBacklinkReverificationAutomation(
      {
        listEligibleWorkspaces: async (limit) =>
          (await listAutomationWorkspaceControlsForBacklinkReverification(adminClient, limit)).map(
            (control) => ({
              workspaceId: control.workspaceId,
              backlinksEnabled: control.backlinksEnabled,
              disabledReason: null,
            }),
          ),
        listCandidates: async (workspaceId, limit) =>
          listBacklinkReverificationCandidates(adminClient, {
            workspaceId,
            limit,
          }),
        getJobByKey: (workspaceId, jobKey) =>
          getBacklinkVerificationJobByKey(adminClient, workspaceId, jobKey),
        createJob: (input) => createBacklinkVerificationJob(adminClient, input.workspaceId, input),
        runSchedulerTick: (input) => composition.runSchedulerTick(input),
      },
      {
        workspaceLimit: body.workspaceLimit,
        candidateLimitPerWorkspace: body.candidateLimitPerWorkspace,
        schedulerMaxIterations: body.schedulerMaxIterations,
        workerId: "norixo-backlink-reverification",
        leaseDurationSeconds: 120,
        now: new Date().toISOString(),
        config,
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[automation/backlinks/reverification] request failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BACKLINK_REVERIFICATION_FAILED",
          message: "Unable to run backlink reverification automation",
        },
      },
      { status: 500 },
    );
  }
}
