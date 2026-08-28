import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachById, getActiveBacklinkOutreachByIdentity, listBacklinkOutreachByOpportunity, updateBacklinkOutreach } from "@/lib/backlinks/repositories/outreachRepository";
import { listBacklinkOutreachAttemptsForOutreach } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getCampaignOpportunity } from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { listBacklinkContactsByDomain } from "@/lib/backlinks/repositories/contactsRepository";
import { markBacklinkOutreachReady } from "@/lib/backlinks/services/outreachReadyService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
type ReadyRequestBody = { confirm: true; reapprove?: true };
function parseBody(value: unknown): ReadyRequestBody | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (body.confirm !== true || !(keys.length === 1 || keys.length === 2) || !keys.every((key) => key === "confirm" || key === "reapprove")) return null;
  if ("reapprove" in body && body.reapprove !== true) return null;
  return body.reapprove === true ? { confirm: true, reapprove: true } : { confirm: true };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parseBody(await request.json().catch(() => null));
  if (body == null) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id } = await context.params;
  try {
    const result = await markBacklinkOutreachReady({
      eligibility: {
        getMembership: (v) => getCampaignOpportunity(auth.client, v.workspaceId, v.campaignId, v.opportunityId),
        getOpportunity: (w, o) => getBacklinkOpportunityById(auth.client, w, o),
        listContactsByDomain: (w, d) => listBacklinkContactsByDomain(auth.client, w, d),
        listOutreachByOpportunity: (w, o) => listBacklinkOutreachByOpportunity(auth.client, w, o),
      },
      getOutreach: async (w, o) => getBacklinkOutreachById(auth.client, w, o) as any,
      getActiveOutreach: async (v) => getActiveBacklinkOutreachByIdentity(auth.client, v) as any,
      listAttemptsForOutreach: (w, o) => listBacklinkOutreachAttemptsForOutreach(auth.client, w, o),
      updateOutreach: async (w, o, v) => updateBacklinkOutreach(auth.client, w, o, v as any) as any,
    })({ workspaceId: auth.workspace.id, actorUserId: auth.user.id, outreachId: id, reapprove: body.reapprove === true });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Ready approval unavailable." }, { status: 409 });
  }
}
