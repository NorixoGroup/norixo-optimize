import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getBacklinkOutreachDraftEligibilityForMembership } from "@/lib/backlinks/services/outreachDraftEligibilityService";
import { createBacklinkOutreachDraftRouteServices } from "@/lib/backlinks/services/outreachDraftRouteService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; opportunityId: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, opportunityId } = await context.params;
  try {
    const { eligibility } = createBacklinkOutreachDraftRouteServices(auth.client);
    const excludeOutreachId = new URL(request.url).searchParams.get("excludeOutreachId")?.trim() || undefined;
    return NextResponse.json(await getBacklinkOutreachDraftEligibilityForMembership(eligibility, { workspaceId: auth.workspace.id, campaignId: id, opportunityId, excludeOutreachId }));
  } catch {
    return NextResponse.json({ error: "Outreach eligibility unavailable." }, { status: 409 });
  }
}
