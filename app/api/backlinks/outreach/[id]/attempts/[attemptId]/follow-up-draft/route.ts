import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachAttemptById } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getBacklinkOutreachFollowUpDraftByAttemptId, updateBacklinkOutreachFollowUpDraft as updateBacklinkOutreachFollowUpDraftRpc } from "@/lib/backlinks/repositories/outreachFollowUpDraftsRepository";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type RouteProjection = {
  attemptId: string;
  followUpNumber: number;
  subject: string;
  body: string;
  preparedAt: string;
  updatedAt: string;
};

function parse(value: unknown): { subject: string; body: string; expectedUpdatedAt: string } | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 3 || body.subject === undefined || body.body === undefined || body.expectedUpdatedAt === undefined) return null;
  if (typeof body.subject !== "string" || typeof body.body !== "string" || typeof body.expectedUpdatedAt !== "string") return null;
  return { subject: body.subject, body: body.body, expectedUpdatedAt: body.expectedUpdatedAt };
}

function project(value: { attempt_id: string; follow_up_number: number; subject: string; body: string; prepared_at: string; updated_at: string }): RouteProjection {
  return {
    attemptId: value.attempt_id,
    followUpNumber: value.follow_up_number,
    subject: value.subject,
    body: value.body,
    preparedAt: value.prepared_at,
    updatedAt: value.updated_at,
  };
}

async function context(request: NextRequest) {
  const result = await getRequestUserAndWorkspace(request);
  if (result.status === "unauthenticated") return null;
  if (result.status === "workspace_forbidden") return "forbidden" as const;
  return isAdminPrivateEmail(result.user.email) ? { client: result.client, user: result.user, workspace: result.workspace } : "forbidden" as const;
}

export async function GET(request: NextRequest, contextValue: { params: Promise<{ id: string; attemptId: string }> }) {
  const { id, attemptId } = await contextValue.params;
  const requestContext = await context(request);
  if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const outreach = await getBacklinkOutreachById(requestContext.client, requestContext.workspace.id, id);
    const attempt = await getBacklinkOutreachAttemptById(requestContext.client, requestContext.workspace.id, attemptId);
    if (attempt.outreach_id !== outreach.id || attempt.attempt_kind !== "follow_up" || attempt.status !== "prepared") {
      return NextResponse.json({ error: "Follow-up draft unavailable." }, { status: 409 });
    }
    const draft = await getBacklinkOutreachFollowUpDraftByAttemptId(requestContext.client, requestContext.workspace.id, attemptId);
    if (draft == null) {
      return NextResponse.json({ error: "Follow-up draft unavailable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, result: project(draft) });
  } catch (error) {
    if (error instanceof BacklinkRepositoryError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Follow-up draft unavailable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Follow-up draft unavailable." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest, contextValue: { params: Promise<{ id: string; attemptId: string }> }) {
  const { id, attemptId } = await contextValue.params;
  const requestContext = await context(request);
  if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = parse(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  try {
    const draft = await getBacklinkOutreachFollowUpDraftByAttemptId(requestContext.client, requestContext.workspace.id, attemptId);
    if (draft == null) return NextResponse.json({ error: "Le brouillon de relance est indisponible." }, { status: 404 });
    const attempt = await getBacklinkOutreachAttemptById(requestContext.client, requestContext.workspace.id, attemptId);
    if (attempt.outreach_id !== id || attempt.attempt_kind !== "follow_up" || attempt.status !== "prepared") {
      return NextResponse.json({ error: "Le brouillon de relance est indisponible." }, { status: 409 });
    }
    const result = await updateBacklinkOutreachFollowUpDraftRpc(requestContext.client, {
      workspaceId: requestContext.workspace.id,
      outreachId: id,
      attemptId,
      actorUserId: requestContext.user.id,
      subject: input.subject,
      body: input.body,
      expectedUpdatedAt: input.expectedUpdatedAt,
      updatedAt: draft.updated_at,
    });
    return NextResponse.json({ ok: true, result: project({
      attempt_id: result.attemptId,
      follow_up_number: result.followUpNumber,
      subject: result.subject,
      body: result.body,
      prepared_at: result.preparedAt,
      updated_at: result.updatedAt,
    }) });
  } catch (error) {
    if (error instanceof BacklinkRepositoryError && error.code === "CONFLICT") {
      return NextResponse.json({ error: "Le brouillon a été modifié ailleurs. Rechargez la version la plus récente." }, { status: 409 });
    }
    return NextResponse.json({ error: "Le brouillon de relance est indisponible." }, { status: 409 });
  }
}
