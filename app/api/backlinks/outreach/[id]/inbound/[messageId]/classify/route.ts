import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { classifyBacklinkOutreachInboundReply as classifyRpc, getBacklinkOutreachInboundMessageById } from "@/lib/backlinks/repositories/outreachInboundReplyClassificationsRepository";
import { BacklinkOutreachInboundReplyClassificationServiceError, classifyBacklinkOutreachInboundReply } from "@/lib/backlinks/services/outreachInboundReplyClassificationService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function parse(value: unknown): { classification: "positive" | "negative" } | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 2 || body.confirm !== true || (body.classification !== "positive" && body.classification !== "negative")) return null;
  return { classification: body.classification };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; messageId: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parse(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id, messageId } = await context.params;
  try {
    const adminClient = createSupabaseAdminClient();
    const result = await classifyBacklinkOutreachInboundReply({ getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(adminClient, workspaceId, outreachId), getInboundMessage: (inboundMessageId) => getBacklinkOutreachInboundMessageById(adminClient, inboundMessageId), classify: (value) => classifyRpc(adminClient, value), now: () => new Date().toISOString() })({ workspaceId: auth.workspace.id, actorUserId: auth.user.id, outreachId: id, inboundMessageId: messageId, classification: body.classification });
    return NextResponse.json({ ok: true, result: { disposition: result.disposition, classification: result.classification } });
  } catch (error) {
    if (error instanceof BacklinkRepositoryError && error.code === "NOT_FOUND") return NextResponse.json({ error: "Inbound reply not found." }, { status: 404 });
    if (error instanceof BacklinkRepositoryError && error.code === "CONFLICT") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof BacklinkOutreachInboundReplyClassificationServiceError) return NextResponse.json({ error: "Inbound reply not found." }, { status: 404 });
    return NextResponse.json({ error: "Inbound reply classification unavailable." }, { status: 409 });
  }
}
