import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import {
  applyBacklinkOutreachUnsubscribe,
  type ApplyBacklinkOutreachUnsubscribeRpcClient,
  type BacklinkOutreachUnsubscribeSource,
} from "@/lib/backlinks/repositories/outreachUnsubscribeRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Explicit admin unsubscribe: records that the recipient asked not to be contacted
 * again (for example in a reply that was classified as negative). Deterministic and
 * idempotent; it performs workspace-wide email suppression. A plain negative
 * response never reaches this route.
 */

type UnsubscribeRequestBody = { confirm: true; source?: Extract<BacklinkOutreachUnsubscribeSource, "admin_unsubscribe" | "inbound_reply"> };

function parse(value: unknown): UnsubscribeRequestBody | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (body.confirm !== true || !keys.every((key) => key === "confirm" || key === "source")) return null;
  if ("source" in body && body.source !== "admin_unsubscribe" && body.source !== "inbound_reply") return null;
  return { confirm: true, ...(body.source ? { source: body.source as UnsubscribeRequestBody["source"] } : {}) };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parse(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { id } = await context.params;
  try {
    const result = await applyBacklinkOutreachUnsubscribe(createSupabaseAdminClient() as unknown as ApplyBacklinkOutreachUnsubscribeRpcClient, {
      workspaceId: auth.workspace.id,
      outreachId: id,
      source: body.source ?? "admin_unsubscribe",
    });
    return NextResponse.json({
      ok: true,
      result: {
        disposition: result.disposition,
        outreachStatus: result.outreachStatus,
        closedOutreachCount: result.closedOutreachCount,
      },
    });
  } catch (error) {
    if (error instanceof BacklinkRepositoryError && error.code === "NOT_FOUND") return NextResponse.json({ error: "Outreach not found." }, { status: 404 });
    if (error instanceof BacklinkRepositoryError && error.code === "VALIDATION") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unsubscribe unavailable." }, { status: 409 });
  }
}
