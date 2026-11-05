import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { listBacklinkOutreachAttemptsForOutreach } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { listBacklinkOutreachDeliveryEventsForOutreach } from "@/lib/backlinks/repositories/outreachDeliveryEventsRepository";
import { getRequestUserAndWorkspace, createStaffOutreachReadClient } from "@/lib/server/routeAuth";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const readClient = createStaffOutreachReadClient();
  try {
    await getBacklinkOutreachById(readClient, auth.workspace.id, id);
    const [attempts, deliveryEvents] = await Promise.all([listBacklinkOutreachAttemptsForOutreach(readClient, auth.workspace.id, id), listBacklinkOutreachDeliveryEventsForOutreach(readClient, auth.workspace.id, id)]);
    return NextResponse.json({ outreachId: id, attempts: attempts.map((attempt) => ({ id: attempt.id, channel: attempt.channel, provider: attempt.provider, recipient: attempt.recipient, status: attempt.status, providerMessageId: attempt.provider_message_id, errorCode: attempt.error_code, errorMessage: attempt.error_message, requestedAt: attempt.requested_at, acceptedAt: attempt.accepted_at, failedAt: attempt.failed_at, resolvedAt: attempt.resolved_at })), deliveryEvents: deliveryEvents.map((event) => ({ id: event.id, attemptId: event.attempt_id, eventType: event.event_type, occurredAt: event.occurred_at, receivedAt: event.received_at })) });
  } catch {
    return NextResponse.json({ error: "Attempt history unavailable." }, { status: 404 });
  }
}
