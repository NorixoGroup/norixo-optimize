import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { approveContactFormInitial } from "@/lib/backlinks/repositories/contactFormAutomationRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ApprovalBody = { senderName: string; senderEmail: string; senderCompany: string; senderWebsite: string; senderFirstName?: string | null; senderLastName?: string | null };

const REQUIRED_FIELDS = ["senderName", "senderEmail", "senderCompany", "senderWebsite"] as const;
const OPTIONAL_SPLIT_IDENTITY_FIELDS = ["senderFirstName", "senderLastName"] as const;
const APPROVAL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_SPLIT_IDENTITY_FIELDS] as const;

function optionalSenderIdentityPart(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 120) return undefined;
  return normalized;
}

function parseBody(value: unknown): ApprovalBody | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length < REQUIRED_FIELDS.length || keys.length > APPROVAL_FIELDS.length || !keys.every((key) => (APPROVAL_FIELDS as readonly string[]).includes(key))) return null;
  if (!REQUIRED_FIELDS.every((field) => typeof body[field] === "string" && body[field].trim())) return null;
  const senderFirstName = optionalSenderIdentityPart(body.senderFirstName);
  const senderLastName = optionalSenderIdentityPart(body.senderLastName);
  if (senderFirstName === undefined || senderLastName === undefined) return null;
  return { senderName: body.senderName as string, senderEmail: body.senderEmail as string, senderCompany: body.senderCompany as string, senderWebsite: body.senderWebsite as string, senderFirstName, senderLastName };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parseBody(await request.json().catch(() => null));
  if (body == null) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id } = await context.params;
  try {
    const result = await approveContactFormInitial(createSupabaseAdminClient(), { workspaceId: auth.workspace.id, outreachId: id, approvedByUserId: auth.user.id, ...body });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Contact form approval unavailable." }, { status: 409 });
  }
}
