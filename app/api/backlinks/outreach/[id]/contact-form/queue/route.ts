import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { queueContactFormRun } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function approvalId(value: unknown): string | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 1 && typeof body.approvalId === "string" && body.approvalId.trim() ? body.approvalId : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const value = approvalId(await request.json().catch(() => null));
  if (value == null) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id } = await context.params;
  try {
    const result = await queueContactFormRun(createSupabaseAdminClient(), { workspaceId: auth.workspace.id, outreachId: id, approvalId: value });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Contact form queue unavailable." }, { status: 409 });
  }
}