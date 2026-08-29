import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { setCampaignLiveInitialSendEnabled } from "@/lib/backlinks/services/campaignService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

function parseBody(value: unknown): { liveInitialSendEnabled: boolean } | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || typeof body.liveInitialSendEnabled !== "boolean") return null;
  return { liveInitialSendEnabled: body.liveInitialSendEnabled };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const body = parseBody(await request.json().catch(() => null));
  if (!id || body == null) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  try {
    const campaign = await setCampaignLiveInitialSendEnabled(auth.client, auth.workspace.id, id, body.liveInitialSendEnabled);
    return NextResponse.json({ ok: true, campaign: { id: campaign.id, liveInitialSendEnabled: campaign.live_initial_send_enabled } });
  } catch (error) {
    const code = typeof error === "object" && error != null && "code" in error ? (error as { code?: unknown }).code : null;
    return NextResponse.json({ error: "Campaign unavailable." }, { status: code === "NOT_FOUND" ? 404 : 400 });
  }
}
