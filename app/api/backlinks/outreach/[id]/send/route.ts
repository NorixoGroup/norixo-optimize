import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachById, activateBacklinkOutreachAfterEmailAccepted } from "@/lib/backlinks/repositories/outreachRepository";
import { getBacklinkOutreachAttemptById, reserveBacklinkOutreachApprovedInitialAttempt, updateBacklinkOutreachAttemptState } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getAutomationWorkspaceControl } from "@/lib/automation/repositories/automationWorkspaceControlsRepository";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import { markBacklinkOutreachAttemptAccepted, markBacklinkOutreachAttemptFailed, markBacklinkOutreachAttemptUnknown } from "@/lib/backlinks/services/outreachAttemptService";
import { sendApprovedBacklinkOutreachEmail } from "@/lib/backlinks/services/outreachApprovedAutoSendService";
import { BacklinkOutreachEmailSendError } from "@/lib/backlinks/services/outreachEmailSendService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function extractSafeError(error: unknown): {
  errorName: string;
  errorMessage: string;
  errorCode: string | number | null;
} {
  let errorName: string = typeof error;
  let errorMessage = "Unknown error";
  let errorCode: string | number | null = null;
  if (error instanceof Error) {
    errorName = "Error";
    try { if (typeof error.name === "string" && error.name) errorName = error.name; } catch {}
    try { if (typeof error.message === "string" && error.message) errorMessage = error.message; } catch {}
  }
  if (typeof error === "object" && error != null) {
    try {
      const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
      if (typeof code === "string" || typeof code === "number") errorCode = code;
    } catch {}
  }
  return { errorName, errorMessage, errorCode };
}

function parse(value: unknown): { idempotencyKey: string } | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 2 || body.confirm !== true || typeof body.idempotencyKey !== "string") return null;
  const idempotencyKey = body.idempotencyKey.trim();
  return idempotencyKey && idempotencyKey.length <= 255 ? { idempotencyKey } : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = parse(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id } = await context.params;
  const adminClient = createSupabaseAdminClient();
  const transitions = {
    getAttempt: (workspaceId: string, attemptId: string) => getBacklinkOutreachAttemptById(auth.client, workspaceId, attemptId),
    updateAttempt: (workspaceId: string, attemptId: string, patch: Parameters<typeof updateBacklinkOutreachAttemptState>[3]) => updateBacklinkOutreachAttemptState(auth.client, workspaceId, attemptId, patch),
  };
  try {
    const result = await sendApprovedBacklinkOutreachEmail({
      getWorkspaceControl: (workspaceId) => getAutomationWorkspaceControl(auth.client, workspaceId),
      getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(auth.client, workspaceId, outreachId),
      reserveApprovedInitialAttempt: (input) => reserveBacklinkOutreachApprovedInitialAttempt(adminClient, input),
      markAttemptAccepted: markBacklinkOutreachAttemptAccepted(transitions),
      markAttemptFailed: markBacklinkOutreachAttemptFailed(transitions),
      markAttemptUnknown: markBacklinkOutreachAttemptUnknown(transitions),
      sendEmail: createEnvironmentOutreachEmailProvider(),
      activateOutreach: (workspaceId, outreachId, value) => activateBacklinkOutreachAfterEmailAccepted(auth.client, workspaceId, outreachId, value),
      inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,
      replyTokenKeyring: getBacklinkOutreachReplyTokenKeyring(),
    })({ workspaceId: auth.workspace.id, actorUserId: auth.user.id, outreachId: id, idempotencyKey: input.idempotencyKey });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_SEND_DISABLED_BY_DRY_RUN") return NextResponse.json({ error: { code: error.code, message: error.message === "OUTREACH_SEND_DISABLED_BY_DRY_RUN" ? "External email sending is disabled while Backlinks is in dry-run mode." : error.message } }, { status: 409 });
    if (error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_SEND_ATTEMPT_IN_PROGRESS") return NextResponse.json({ error: "An outreach send attempt is already in progress." }, { status: 409 });
    if (error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_SEND_ATTEMPT_UNRESOLVED") return NextResponse.json({ error: "Resolve the uncertain outreach attempt before sending again." }, { status: 409 });
    const safeError = extractSafeError(error);
    console.error("[backlinks-explicit-send-error]", {
      workspaceId: auth.workspace.id,
      outreachId: id,
      errorName: safeError.errorName,
      errorMessage: safeError.errorMessage,
      errorCode: safeError.errorCode,
    });
    return NextResponse.json({ error: "Outreach email send unavailable." }, { status: 409 });
  }
}
