import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  buildManualBacklinkVerificationJobInput,
  createOrGetBacklinkVerificationJob,
  type HttpVerificationOptions,
  type VerificationPolicy,
} from "@/lib/backlinks/verification";
import {
  createBacklinkVerificationJob,
  getBacklinkVerificationJobByKey,
} from "@/lib/backlinks/repositories/verificationJobsRepository";
import { getLink } from "@/lib/backlinks/services/linkService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ManualJobRequestBody = {
  queuedAt: string;
  policy: VerificationPolicy;
  http: HttpVerificationOptions;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const keys = Object.keys(value);
  return keys.every((key) => allowedKeys.includes(key));
}

function parsePolicy(value: unknown): VerificationPolicy | null {
  if (!isRecord(value)) {
    return null;
  }

  const allowedKeys = [
    "strictAnchor",
    "strictRel",
    "followRedirects",
    "maxRedirects",
    "acceptCanonical",
  ];
  if (!hasOnlyKeys(value, allowedKeys)) {
    return null;
  }

  const { strictAnchor, strictRel, followRedirects, maxRedirects, acceptCanonical } =
    value;
  if (
    (strictAnchor !== undefined && typeof strictAnchor !== "boolean") ||
    (strictRel !== undefined && typeof strictRel !== "boolean") ||
    (followRedirects !== undefined && typeof followRedirects !== "boolean") ||
    (maxRedirects !== undefined &&
      (typeof maxRedirects !== "number" || !Number.isFinite(maxRedirects))) ||
    (acceptCanonical !== undefined && typeof acceptCanonical !== "boolean")
  ) {
    return null;
  }

  return {
    ...(strictAnchor === undefined ? {} : { strictAnchor }),
    ...(strictRel === undefined ? {} : { strictRel }),
    ...(followRedirects === undefined ? {} : { followRedirects }),
    ...(maxRedirects === undefined ? {} : { maxRedirects }),
    ...(acceptCanonical === undefined ? {} : { acceptCanonical }),
  };
}

function parseHttp(value: unknown): HttpVerificationOptions | null {
  if (!isRecord(value)) {
    return null;
  }

  const allowedKeys = [
    "timeoutMs",
    "maxRedirects",
    "maxResponseBytes",
    "userAgent",
  ];
  if (!hasOnlyKeys(value, allowedKeys)) {
    return null;
  }

  const { timeoutMs, maxRedirects, maxResponseBytes, userAgent } = value;
  if (
    typeof timeoutMs !== "number" ||
    !Number.isFinite(timeoutMs) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    typeof maxRedirects !== "number" ||
    !Number.isFinite(maxRedirects) ||
    !Number.isInteger(maxRedirects) ||
    maxRedirects < 0 ||
    typeof maxResponseBytes !== "number" ||
    !Number.isFinite(maxResponseBytes) ||
    !Number.isInteger(maxResponseBytes) ||
    maxResponseBytes < 0 ||
    (userAgent !== undefined &&
      (typeof userAgent !== "string" || userAgent.trim().length === 0))
  ) {
    return null;
  }

  return userAgent === undefined
    ? { timeoutMs, maxRedirects, maxResponseBytes }
    : { timeoutMs, maxRedirects, maxResponseBytes, userAgent };
}

function parseManualJobRequestBody(value: unknown): ManualJobRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const expectedKeys = ["queuedAt", "policy", "http"];
  if (
    Object.keys(value).length !== expectedKeys.length ||
    !hasOnlyKeys(value, expectedKeys)
  ) {
    return null;
  }

  const { queuedAt, policy: policyValue, http: httpValue } = value;
  if (
    typeof queuedAt !== "string" ||
    queuedAt.trim().length === 0 ||
    !Number.isFinite(Date.parse(queuedAt))
  ) {
    return null;
  }

  const policy = parsePolicy(policyValue);
  const http = parseHttp(httpValue);
  if (policy == null || http == null) {
    return null;
  }

  return { queuedAt, policy, http };
}

function invalidInputResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Manual backlink verification job input is invalid",
      },
    },
    { status: 400 },
  );
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    error.code === "NOT_FOUND"
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { client, user, workspace } = await getRequestUserAndWorkspace(request);
  if (!client || !user || !workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminPrivateEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const linkId = id;
  if (linkId.trim().length === 0) {
    return invalidInputResponse();
  }

  const body = await request.json().catch(() => null);
  const bodyInput = parseManualJobRequestBody(body);
  if (bodyInput == null) {
    return invalidInputResponse();
  }

  try {
    await getLink(client, workspace.id, linkId);
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

    console.error("[backlinks/verification-job] link lookup failed");
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BACKLINK_JOB_CREATION_FAILED",
          message: "Backlink verification job creation failed",
        },
      },
      { status: 500 },
    );
  }

  try {
    const jobInput = buildManualBacklinkVerificationJobInput({
      workspaceId: workspace.id,
      linkId,
      queuedAt: bodyInput.queuedAt,
      policy: bodyInput.policy,
      http: bodyInput.http,
    });
    const adminClient = createSupabaseAdminClient();
    const result = await createOrGetBacklinkVerificationJob(jobInput, {
      getJobByKey: (workspaceId, jobKey) =>
        getBacklinkVerificationJobByKey(adminClient, workspaceId, jobKey),
      createJob: (input) =>
        createBacklinkVerificationJob(adminClient, input.workspaceId, input),
    });

    return NextResponse.json(
      { ok: true, result },
      { status: result.kind === "created" ? 201 : 200 },
    );
  } catch {
    console.error("[backlinks/verification-job] job creation failed");
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BACKLINK_JOB_CREATION_FAILED",
          message: "Backlink verification job creation failed",
        },
      },
      { status: 500 },
    );
  }
}
