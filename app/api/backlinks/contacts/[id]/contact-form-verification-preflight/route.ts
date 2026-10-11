import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { createOrGetContactFormVerificationPreflight, getContactFormVerificationPreflight } from "@/lib/backlinks/repositories/contactFormVerificationPreflightRepository";
import { normalizeContactFormVerificationUrl } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import { executeContactFormVerificationPreflight } from "@/lib/backlinks/services/contactFormVerificationPreflightWorker";

async function context(request: NextRequest) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return null;
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return "forbidden" as const;
  return auth;
}
async function contactId(value: { params: Promise<{ id: string }> }) { return (await value.params).id; }

export async function GET(request: NextRequest, value: { params: Promise<{ id: string }> }) {
  const auth = await context(request); if (auth == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (auth === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { return NextResponse.json({ preflight: await getContactFormVerificationPreflight(auth.client, auth.workspace.id, await contactId(value)) }); }
  catch { return NextResponse.json({ error: "Verification preflight unavailable." }, { status: 409 }); }
}

export async function POST(request: NextRequest, value: { params: Promise<{ id: string }> }) {
  const auth = await context(request); if (auth == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (auth === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body == null || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as Record<string, unknown>).idempotencyKey !== "string") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  try {
    const id = await contactId(value); const contact = await getBacklinkContactById(auth.client, auth.workspace.id, id); const formUrl = normalizeContactFormVerificationUrl(contact.contact_form_url);
    if (formUrl == null) return NextResponse.json({ error: "Contact form URL unavailable." }, { status: 409 });
    const adminClient = createSupabaseAdminClient();
    const result = await createOrGetContactFormVerificationPreflight(adminClient, { workspaceId: auth.workspace.id, contactId: id, formUrl, idempotencyKey: (body as { idempotencyKey: string }).idempotencyKey, requestedBy: auth.user.id });
    const preflight = await executeContactFormVerificationPreflight({
      client: adminClient,
      workspaceId: auth.workspace.id,
      preflightId: result.preflight.id,
      workerId: `contact-form-preflight:${auth.user.id}:${randomUUID()}`,
    });
    return NextResponse.json({ ok: true, result: { ...result, preflight } }, { status: result.disposition === "created" ? 201 : 200 });
  } catch { return NextResponse.json({ error: "Verification preflight unavailable." }, { status: 409 }); }
}
