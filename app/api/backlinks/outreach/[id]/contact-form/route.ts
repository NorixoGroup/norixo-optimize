import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getContactFormAutomationHistory } from "@/lib/backlinks/services/contactFormAutomationService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  try {
    return NextResponse.json({ ok: true, result: await getContactFormAutomationHistory(auth.client, auth.workspace.id, id) });
  } catch {
    return NextResponse.json({ error: "Contact form history unavailable." }, { status: 404 });
  }
}