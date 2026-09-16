import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { confirmLinkedInReply } from "@/lib/backlinks/services/outreachLinkedInInteractionService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReplyConfirmedBody = {
  confirm?: unknown;
  classification?: unknown;
};

function parseBody(value: unknown):
  | {
      confirm: true;
      classification: "positive" | "negative";
    }
  | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return null;
  }

  const body = value as ReplyConfirmedBody;

  if (body.confirm !== true) {
    return null;
  }

  if (
    body.classification !== "positive" &&
    body.classification !== "negative"
  ) {
    return null;
  }

  if (
    Object.keys(body).some(
      (key) => key !== "confirm" && key !== "classification",
    )
  ) {
    return null;
  }

  return {
    confirm: true,
    classification: body.classification,
  };
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await getRequestUserAndWorkspace(request);

  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (
    auth.status === "workspace_forbidden" ||
    !isAdminPrivateEmail(auth.user.email)
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const body = parseBody(rawBody);

  if (!body) {
    return NextResponse.json(
      {
        error:
          'Body must be exactly {"confirm":true,"classification":"positive"|"negative"}.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await confirmLinkedInReply(createSupabaseAdminClient(), {
      workspaceId: auth.workspace.id,
      outreachId: id,
      actorUserId: auth.user.id,
      classification: body.classification,
    });

    return NextResponse.json({
      disposition: result.disposition,
      interactionId: result.interactionId,
      occurredAt: result.occurredAt,
      outreachStatus: result.outreachStatus,
      classification: result.classification,
    });
  } catch (error) {
    if (error instanceof BacklinkRepositoryError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: error.message },
          { status: 404 },
        );
      }

      if (error.code === "CONFLICT") {
        return NextResponse.json(
          { error: error.message },
          { status: 409 },
        );
      }

      if (error.code === "VALIDATION") {
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }
    }

    console.error(
      "[backlinks] LinkedIn reply confirmation failed",
      error,
    );

    return NextResponse.json(
      { error: "Unable to confirm LinkedIn reply." },
      { status: 500 },
    );
  }
}
