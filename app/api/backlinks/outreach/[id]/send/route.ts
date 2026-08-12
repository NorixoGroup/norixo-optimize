import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getCampaignOpportunity } from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import { getBacklinkContactById, listBacklinkContactsByDomain } from "@/lib/backlinks/repositories/contactsRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { getBacklinkOutreachById, activateBacklinkOutreachAfterEmailAccepted, listBacklinkOutreachByOpportunity } from "@/lib/backlinks/repositories/outreachRepository";
import { getBacklinkOutreachAttemptById, getBacklinkOutreachAttemptByIdempotencyKey, getOpenBacklinkOutreachAttemptForOutreach, reserveBacklinkOutreachAttempt, updateBacklinkOutreachAttemptState } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import { markBacklinkOutreachAttemptAccepted, markBacklinkOutreachAttemptFailed, markBacklinkOutreachAttemptUnknown } from "@/lib/backlinks/services/outreachAttemptService";
import { BacklinkOutreachEmailSendError, sendBacklinkOutreachEmail } from "@/lib/backlinks/services/outreachEmailSendService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

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
  const transitions = {
    getAttempt: (workspaceId: string, attemptId: string) => getBacklinkOutreachAttemptById(auth.client, workspaceId, attemptId),
    updateAttempt: (workspaceId: string, attemptId: string, patch: Parameters<typeof updateBacklinkOutreachAttemptState>[3]) => updateBacklinkOutreachAttemptState(auth.client, workspaceId, attemptId, patch),
  };
  try {
    const result = await sendBacklinkOutreachEmail({
      eligibility: {
        getMembership: (value) => getCampaignOpportunity(auth.client, value.workspaceId, value.campaignId, value.opportunityId),
        getOpportunity: (workspaceId, opportunityId) => getBacklinkOpportunityById(auth.client, workspaceId, opportunityId),
        listContactsByDomain: (workspaceId, domainId) => listBacklinkContactsByDomain(auth.client, workspaceId, domainId),
        listOutreachByOpportunity: (workspaceId, opportunityId) => listBacklinkOutreachByOpportunity(auth.client, workspaceId, opportunityId),
      },
      getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(auth.client, workspaceId, outreachId),
      getContact: (workspaceId, contactId) => getBacklinkContactById(auth.client, workspaceId, contactId),
      getAttemptByIdempotencyKey: (workspaceId, idempotencyKey) => getBacklinkOutreachAttemptByIdempotencyKey(auth.client, workspaceId, idempotencyKey),
      getOpenAttemptForOutreach: (workspaceId, outreachId) => getOpenBacklinkOutreachAttemptForOutreach(auth.client, workspaceId, outreachId),
      reserveAttempt: (workspaceId, value) => reserveBacklinkOutreachAttempt(auth.client, workspaceId, value),
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
    if (error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_SEND_ATTEMPT_IN_PROGRESS") return NextResponse.json({ error: "An outreach send attempt is already in progress." }, { status: 409 });
    if (error instanceof BacklinkOutreachEmailSendError && error.code === "OUTREACH_SEND_ATTEMPT_UNRESOLVED") return NextResponse.json({ error: "Resolve the uncertain outreach attempt before sending again." }, { status: 409 });
    return NextResponse.json({ error: "Outreach email send unavailable." }, { status: 409 });
  }
}
