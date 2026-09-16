import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getBacklinkOutreachInboundMessageById } from "@/lib/backlinks/repositories/outreachInboundReplyClassificationsRepository";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { BacklinkOutreachReplyAssistantError } from "@/lib/backlinks/services/outreachReplyAssistant";
import { createBacklinkOutreachReplyAssistantRouteService } from "@/lib/backlinks/services/outreachReplyAssistantRouteService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const auth = await getRequestUserAndWorkspace(request);

  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    auth.status === "workspace_forbidden" ||
    !isAdminPrivateEmail(auth.user.email)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, messageId } = await context.params;

  try {
    const adminClient = createSupabaseAdminClient();

    const [outreach, inboundMessage] = await Promise.all([
      getBacklinkOutreachById(
        adminClient,
        auth.workspace.id,
        id,
      ),
      getBacklinkOutreachInboundMessageById(
        adminClient,
        messageId,
      ),
    ]);

    if (outreach.channel !== "email") {
      return NextResponse.json(
        { error: "Stored email reply required." },
        { status: 409 },
      );
    }

    if (
      inboundMessage.workspace_id !== auth.workspace.id ||
      inboundMessage.outreach_id !== id ||
      inboundMessage.provider !== "resend" ||
      inboundMessage.correlation_status !== "correlated" ||
      typeof inboundMessage.text_body !== "string" ||
      !inboundMessage.text_body.trim()
    ) {
      return NextResponse.json(
        { error: "Stored inbound reply unavailable." },
        { status: 404 },
      );
    }

    const propose =
      createBacklinkOutreachReplyAssistantRouteService(adminClient);

    const result = await propose({
      workspaceId: auth.workspace.id,
      outreachId: id,
      inbound: {
        sender: inboundMessage.sender,
        subject: inboundMessage.subject,
        textBody: inboundMessage.text_body,
      },
    });

    return NextResponse.json({
      ok: true,
      result: {
        proposal: result.proposal,
        providerId: result.providerId,
        model: result.model,
      },
    });
  } catch (error) {
    if (
      error instanceof BacklinkRepositoryError &&
      error.code === "NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Inbound reply not found." },
        { status: 404 },
      );
    }

    if (error instanceof BacklinkOutreachReplyAssistantError) {
      return NextResponse.json(
        { error: "Reply proposal unavailable." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Reply proposal unavailable." },
      { status: 409 },
    );
  }
}
