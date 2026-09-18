import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import { applyBacklinkOutreachFollowUpAccepted, getBacklinkOutreachAttemptById, markBacklinkOutreachFollowUpAttemptRequested, updateBacklinkOutreachAttemptState } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { markBacklinkOutreachAttemptFailed, markBacklinkOutreachAttemptUnknown } from "@/lib/backlinks/services/outreachAttemptService";
import { BacklinkOutreachFollowUpEmailSendError, sendBacklinkOutreachFollowUpEmail } from "@/lib/backlinks/services/outreachFollowUpEmailSendService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

function parse(value: unknown): { confirm: true } | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || body.confirm !== true) return null;
  return { confirm: true };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; attemptId: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parse(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id, attemptId } = await context.params;
  const transitions = {
    getAttempt: (workspaceId: string, value: string) => getBacklinkOutreachAttemptById(auth.client, workspaceId, value),
    updateAttempt: (workspaceId: string, value: string, patch: Parameters<typeof updateBacklinkOutreachAttemptState>[3]) => updateBacklinkOutreachAttemptState(auth.client, workspaceId, value, patch),
  };
  try {
    const adminClient = createSupabaseAdminClient();

    const result = await sendBacklinkOutreachFollowUpEmail({
      getAttempt: (workspaceId, value) => getBacklinkOutreachAttemptById(auth.client, workspaceId, value),
      markRequested: (value) => markBacklinkOutreachFollowUpAttemptRequested(adminClient, value),
      markAccepted: (value) => applyBacklinkOutreachFollowUpAccepted(adminClient, value),
      markFailed: markBacklinkOutreachAttemptFailed(transitions),
      markUnknown: markBacklinkOutreachAttemptUnknown(transitions),
      sendEmail: createEnvironmentOutreachEmailProvider(),
      inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,
      replyTokenKeyring: getBacklinkOutreachReplyTokenKeyring(),
    })({
      workspaceId: auth.workspace.id,
      actorUserId: auth.user.id,
      outreachId: id,
      attemptId,
      confirm: body.confirm,
    });
    return NextResponse.json({ ok: true, result: { disposition: result.disposition } });
  } catch (error) {
    console.error("[backlinks-follow-up-send-error]", {
      kind: error instanceof BacklinkOutreachFollowUpEmailSendError ? "send" : "unexpected",
      name: error instanceof Error ? error.name : null,
      message: error instanceof Error ? error.message : String(error),
      cause:
        error instanceof Error &&
        typeof error.cause === "object" &&
        error.cause != null
          ? {
              code:
                "code" in error.cause && typeof error.cause.code === "string"
                  ? error.cause.code
                  : null,
              message:
                "message" in error.cause && typeof error.cause.message === "string"
                  ? error.cause.message
                  : null,
              details:
                "details" in error.cause && typeof error.cause.details === "string"
                  ? error.cause.details
                  : null,
              hint:
                "hint" in error.cause && typeof error.cause.hint === "string"
                  ? error.cause.hint
                  : null,
            }
          : null,
    });

    if (error instanceof BacklinkOutreachFollowUpEmailSendError) return NextResponse.json({ error: "Follow-up send unavailable." }, { status: 409 });
    return NextResponse.json({ error: "Follow-up send unavailable." }, { status: 409 });
  }
}
