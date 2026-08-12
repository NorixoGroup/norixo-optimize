import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { applyBacklinkOutreachFinalNoResponse } from "@/lib/backlinks/services/outreachFinalNoResponseService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body == null || Array.isArray(body) || Object.keys(body).length !== 1 || !("confirm" in body) || body.confirm !== true) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id } = await context.params;
  try {
    const result = await applyBacklinkOutreachFinalNoResponse(auth.client)({ workspaceId: auth.workspace.id, actorUserId: auth.user.id, outreachId: id });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Final no-response confirmation unavailable." }, { status: 409 });
  }
}
