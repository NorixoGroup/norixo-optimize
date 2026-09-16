import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import {
  createBacklinkOutreachReplyAssistantRouteService,
} from "@/lib/backlinks/services/outreachReplyAssistantRouteService";
import { BacklinkOutreachReplyAssistantError } from "@/lib/backlinks/services/outreachReplyAssistant";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type LinkedInReplyAssistantBody = {
  inbound: {
    sender: string | null;
    subject: string | null;
    textBody: string;
  };
};

function parseBody(value: unknown): LinkedInReplyAssistantBody | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;

  if (
    Object.keys(body).length !== 1 ||
    typeof body.inbound !== "object" ||
    body.inbound == null ||
    Array.isArray(body.inbound)
  ) {
    return null;
  }

  const inbound = body.inbound as Record<string, unknown>;

  if (
    Object.keys(inbound).some(
      (key) => !["sender", "subject", "textBody"].includes(key),
    ) ||
    typeof inbound.textBody !== "string" ||
    !inbound.textBody.trim() ||
    (inbound.sender !== undefined &&
      inbound.sender !== null &&
      typeof inbound.sender !== "string") ||
    (inbound.subject !== undefined &&
      inbound.subject !== null &&
      typeof inbound.subject !== "string")
  ) {
    return null;
  }

  return {
    inbound: {
      sender:
        typeof inbound.sender === "string"
          ? inbound.sender
          : null,
      subject:
        typeof inbound.subject === "string"
          ? inbound.subject
          : null,
      textBody: inbound.textBody,
    },
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
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

  const body = parseBody(await request.json().catch(() => null));

  if (body == null) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    const outreach = await getBacklinkOutreachById(
      auth.client,
      auth.workspace.id,
      id,
    );

    if (outreach.channel !== "linkedin") {
      return NextResponse.json(
        { error: "LinkedIn reply proposal unavailable for this outreach." },
        { status: 409 },
      );
    }

    const propose =
      createBacklinkOutreachReplyAssistantRouteService(auth.client);

    const result = await propose({
      workspaceId: auth.workspace.id,
      outreachId: id,
      inbound: body.inbound,
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
        { error: "Outreach not found." },
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
