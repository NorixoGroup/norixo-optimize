import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { recordManualLinkedInInitialContact } from "@/lib/backlinks/services/outreachManualLinkedInContactService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function isExplicitConfirmation(value: unknown): value is { confirm: true } {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && body.confirm === true;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isExplicitConfirmation(await request.json().catch(() => null))) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { id } = await context.params;
  try {
    const result = await recordManualLinkedInInitialContact(createSupabaseAdminClient(), {
      workspaceId: auth.workspace.id,
      outreachId: id,
      actorUserId: auth.user.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Manual LinkedIn contact recording unavailable." }, { status: 409 });
  }
}
