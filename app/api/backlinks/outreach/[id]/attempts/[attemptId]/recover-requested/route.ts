import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  getBacklinkOutreachAttemptById,
  recoverRequestedBacklinkOutreachAttemptAsUnknown,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import {
  BacklinkOutreachRequestedAttemptRecoveryError,
  recoverBacklinkOutreachRequestedAttempt,
} from "@/lib/backlinks/services/outreachRequestedAttemptRecoveryService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

function parse(value: unknown): true | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && body.confirm === true ? true : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!parse(await request.json().catch(() => null))) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id, attemptId } = await context.params;
  try {
    const result = await recoverBacklinkOutreachRequestedAttempt({
      getAttempt: (workspaceId, value) => getBacklinkOutreachAttemptById(auth.client, workspaceId, value),
      recoverRequestedAttempt: (workspaceId, value, patch) => recoverRequestedBacklinkOutreachAttemptAsUnknown(auth.client, workspaceId, value, patch),
    })({
      workspaceId: auth.workspace.id,
      actorUserId: auth.user.id,
      outreachId: id,
      attemptId,
    });
    return NextResponse.json({ ok: true, result: { disposition: result.disposition } });
  } catch (error) {
    if (error instanceof BacklinkOutreachRequestedAttemptRecoveryError && error.code === "REQUESTED_ATTEMPT_RECOVERY_TOO_EARLY") {
      return NextResponse.json({ error: "Requested attempt recovery is not available yet." }, { status: 409 });
    }
    return NextResponse.json({ error: "Requested attempt recovery unavailable." }, { status: 409 });
  }
}
