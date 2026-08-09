import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { listBacklinkDiscoveryIntakeApplications } from "@/lib/automation/repositories/backlinkDiscoveryIntakeApplicationRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function GET(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.status === "workspace_forbidden" || !isAdminPrivateEmail(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const discoveryTaskId = request.nextUrl.searchParams.get("discoveryTaskId");
  if (discoveryTaskId == null || discoveryTaskId.trim() === "") return NextResponse.json({ error: "Invalid discovery task" }, { status: 400 });
  try {
    return NextResponse.json({ items: await listBacklinkDiscoveryIntakeApplications(context.client, { workspaceId: context.workspace.id, discoveryTaskId }) });
  } catch {
    return NextResponse.json({ error: "Impossible de lire les mappings Discovery." }, { status: 500 });
  }
}
