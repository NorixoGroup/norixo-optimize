import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachById } from "@/lib/backlinks/repositories/outreachRepository";
import { listBacklinkOutreachInboundRepliesForOutreach } from "@/lib/backlinks/repositories/outreachInboundReplyClassificationsRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { const auth = await getRequestUserAndWorkspace(request); if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const { id } = await context.params; try { await getBacklinkOutreachById(auth.client, auth.workspace.id, id); return NextResponse.json({ replies: await listBacklinkOutreachInboundRepliesForOutreach(auth.client, auth.workspace.id, id) }); } catch { return NextResponse.json({ error: "Inbound replies unavailable." }, { status: 404 }); } }
