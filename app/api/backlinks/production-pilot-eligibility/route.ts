import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  approveProductionPilotEligibility,
  getProductionPilotEligibility,
  revokeProductionPilotEligibility,
  type ProductionPilotEligibilityRpcClient,
} from "@/lib/backlinks/repositories/productionPilotEligibilityRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type BaseInput = { contactId: string; opportunityId: string };
type ApproveInput = BaseInput & { action: "approve"; sourceReference: string; reason: string; confirm: true };
type RevokeInput = BaseInput & { action: "revoke"; reason: string; confirm: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseMutation(value: unknown): ApproveInput | RevokeInput | null {
  if (!isRecord(value) || value.confirm !== true || (value.action !== "approve" && value.action !== "revoke")) return null;
  const contactId = text(value.contactId); const opportunityId = text(value.opportunityId); const reason = text(value.reason);
  if (contactId == null || opportunityId == null || reason == null) return null;
  if (value.action === "revoke") return Object.keys(value).length === 5 ? { action: "revoke", contactId, opportunityId, reason, confirm: true } : null;
  const sourceReference = text(value.sourceReference);
  return sourceReference != null && Object.keys(value).length === 6 ? { action: "approve", contactId, opportunityId, reason, sourceReference, confirm: true } : null;
}

async function adminContext(request: NextRequest) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return null;
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return "forbidden" as const;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await adminContext(request);
  if (auth == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const contactId = text(request.nextUrl.searchParams.get("contactId"));
  const opportunityId = text(request.nextUrl.searchParams.get("opportunityId"));
  if (contactId == null || opportunityId == null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const state = await getProductionPilotEligibility(
      createSupabaseAdminClient() as unknown as ProductionPilotEligibilityRpcClient,
      { workspaceId: auth.workspace.id, contactId, opportunityId },
    );
    return NextResponse.json({ eligibility: state });
  } catch {
    return NextResponse.json({ error: "Pilot eligibility unavailable." }, { status: 409 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await adminContext(request);
  if (auth == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = parseMutation(await request.json().catch(() => null));
  if (input == null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const client = createSupabaseAdminClient() as unknown as ProductionPilotEligibilityRpcClient;
    const result = input.action === "approve"
      ? await approveProductionPilotEligibility(client, {
          workspaceId: auth.workspace.id, contactId: input.contactId, opportunityId: input.opportunityId,
          actorUserId: auth.user.id, sourceReference: input.sourceReference, reason: input.reason,
        })
      : await revokeProductionPilotEligibility(client, {
          workspaceId: auth.workspace.id, contactId: input.contactId, opportunityId: input.opportunityId,
          actorUserId: auth.user.id, reason: input.reason,
        });
    return NextResponse.json({ ok: true, result });
  } catch {
    // SQL failures deliberately remain opaque: they can reveal neither contacts nor eligibility state.
    return NextResponse.json({ error: "Pilot eligibility action unavailable." }, { status: 409 });
  }
}
