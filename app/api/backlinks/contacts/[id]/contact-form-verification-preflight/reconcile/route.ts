import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getContactFormVerificationPreflight, reconcileAbandonedContactFormVerificationPreflight } from "@/lib/backlinks/repositories/contactFormVerificationPreflightRepository";

export async function POST(request: NextRequest, value: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const contactId = (await value.params).id;
  try {
    const current = await getContactFormVerificationPreflight(auth.client, auth.workspace.id, contactId);
    if (current == null) return NextResponse.json({ error: "Verification preflight unavailable." }, { status: 409 });
    const preflight = await reconcileAbandonedContactFormVerificationPreflight(createSupabaseAdminClient(), { workspaceId: auth.workspace.id, preflightId: current.id, reconciledBy: auth.user.id });
    return NextResponse.json({ ok: true, preflight });
  } catch { return NextResponse.json({ error: "Verification preflight unavailable." }, { status: 409 }); }
}
