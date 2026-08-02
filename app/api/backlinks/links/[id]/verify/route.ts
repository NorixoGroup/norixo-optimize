import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  buildManualBacklinkVerificationJobInput,
  createOrGetBacklinkVerificationJob,
} from "@/lib/backlinks/verification";
import { createBacklinkVerificationProductionComposition } from "@/lib/backlinks/verification/production-composition";
import {
  createBacklinkVerificationJob,
  getBacklinkVerificationJobByKey,
} from "@/lib/backlinks/repositories/verificationJobsRepository";
import { getLink } from "@/lib/backlinks/services/linkService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const MANUAL_VERIFICATION_POLICY = {
  strictAnchor: false,
  strictRel: false,
  followRedirects: true,
  maxRedirects: 3,
  acceptCanonical: false,
};
const MANUAL_VERIFICATION_HTTP = {
  timeoutMs: 10_000,
  maxRedirects: 3,
  maxResponseBytes: 1_048_576,
  userAgent: "Norixo-Backlink-Verification/1.0",
};
const MANUAL_VERIFICATION_WORKER_ID = "norixo-backlink-manual";
const MANUAL_VERIFICATION_LEASE_DURATION_SECONDS = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

async function hasEmptyRequestBody(request: NextRequest): Promise<boolean> {
  const body = await request.text();
  if (body.trim().length === 0) {
    return true;
  }

  try {
    const parsed: unknown = JSON.parse(body);
    return isRecord(parsed) && Object.keys(parsed).length === 0;
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    error.code === "NOT_FOUND"
  );
}

function failureResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "BACKLINK_VERIFICATION_FAILED",
        message: "Backlink verification failed",
      },
    },
    { status: 500 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestContext = await getRequestUserAndWorkspace(request);
  if (requestContext.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (requestContext.status === "workspace_forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isAdminPrivateEmail(requestContext.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (id.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "Link ID is invalid" } },
      { status: 400 },
    );
  }
  if (!(await hasEmptyRequestBody(request))) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_INPUT", message: "Request body must be empty" },
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  try {
    await getLink(requestContext.client, requestContext.workspace.id, id);
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "LINK_NOT_FOUND", message: "Backlink not found" },
        },
        { status: 404 },
      );
    }

    console.error("[backlinks/verify] link lookup failed");
    return failureResponse();
  }

  try {
    const jobInput = buildManualBacklinkVerificationJobInput({
      workspaceId: requestContext.workspace.id,
      linkId: id,
      queuedAt: now,
      policy: MANUAL_VERIFICATION_POLICY,
      http: MANUAL_VERIFICATION_HTTP,
    });
    const adminClient = createSupabaseAdminClient();
    const enqueue = await createOrGetBacklinkVerificationJob(jobInput, {
      getJobByKey: (workspaceId, jobKey) =>
        getBacklinkVerificationJobByKey(adminClient, workspaceId, jobKey),
      createJob: (input) =>
        createBacklinkVerificationJob(adminClient, input.workspaceId, input),
    });
    const composition = createBacklinkVerificationProductionComposition();
    const execution = await composition.runTargetedJob({
      workspaceId: requestContext.workspace.id,
      jobId: enqueue.job.id,
      workerId: MANUAL_VERIFICATION_WORKER_ID,
      claimedAt: now,
      attemptedAt: now,
      leaseDurationSeconds: MANUAL_VERIFICATION_LEASE_DURATION_SECONDS,
    });

    return NextResponse.json(
      { ok: true, enqueue, execution },
      { status: enqueue.kind === "created" && execution.kind !== "rejected" ? 201 : 200 },
    );
  } catch {
    console.error("[backlinks/verify] verification failed");
    return failureResponse();
  }
}
