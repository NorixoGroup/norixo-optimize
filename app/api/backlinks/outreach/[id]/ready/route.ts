import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachById, getActiveBacklinkOutreachByIdentity, listBacklinkOutreachByOpportunity, updateBacklinkOutreach } from "@/lib/backlinks/repositories/outreachRepository";
import { listBacklinkOutreachAttemptsForOutreach } from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getCampaignOpportunity } from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import { getBacklinkOpportunityById } from "@/lib/backlinks/repositories/opportunitiesRepository";
import { listBacklinkContactsByDomain } from "@/lib/backlinks/repositories/contactsRepository";
import { markBacklinkOutreachReady } from "@/lib/backlinks/services/outreachReadyService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
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
    const adminClient = createSupabaseAdminClient();
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
      approveInitialSend: async ({ workspaceId, outreachId, actorUserId }) => {
        const { data, error } = await adminClient.rpc("approve_backlink_outreach_initial_send", {
          p_workspace_id: workspaceId,
          p_outreach_id: outreachId,
          p_approved_by: actorUserId,
        });
        if (error != null || !Array.isArray(data) || data.length !== 1 || (data[0].disposition !== "approved" && data[0].disposition !== "already_approved")) {
          throw new Error("Atomic first approval unavailable.");
        }
        return data[0];
      },
    })({ workspaceId: auth.workspace.id, actorUserId: auth.user.id, outreachId: id, reapprove: body.reapprove === true });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const diagnostic = typeof error === "object" && error != null ? error as Record<string, unknown> : null;
    const diagnosticString = (key: string) => typeof diagnostic?.[key] === "string" ? diagnostic[key] : null;
    console.error("[backlinks-ready-approval-error]", {
      outreachId: id,
      workspaceId: auth.workspace.id,
      userId: auth.user.id,
      errorName: error instanceof Error ? error.name : diagnosticString("name") ?? "UnknownError",
      errorMessage: error instanceof Error ? error.message : diagnosticString("message") ?? "Unknown error",
      errorCode: diagnosticString("code"),
      errorDetails: diagnosticString("details"),
      errorHint: diagnosticString("hint"),
    });
    return NextResponse.json({ error: "Ready approval unavailable." }, { status: 409 });
  }
}
