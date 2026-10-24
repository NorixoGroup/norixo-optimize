import { NextRequest, NextResponse } from "next/server";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { findCheckoutIntentForSession } from "@/lib/billing/checkoutIntentLookup";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const PACK_PLANS = new Set(["starter", "pro", "scale"]);

/**
 * Dernier checkout_intent du workspace session (lecture seule, UX billing), ou celui d'une session Stripe précise (`?session_id=`).
 */
export async function GET(request: NextRequest) {
  const { user, workspace } = await getRequestUserAndWorkspace(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!workspace?.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // Confirmation of a specific checkout (billing page after the Stripe redirect): the webhook marks the intent
  // `completed` after granting the credit, so `completed` is the proof that the purchase is effective.
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim() ?? "";
  if (sessionId) {
    const { data: bySession, error: bySessionError } = await findCheckoutIntentForSession(
      supabaseAdmin,
      workspace.id,
      sessionId
    );

    if (bySessionError) {
      console.warn("[billing][checkout-intent-status] session query failed", bySessionError);
      return NextResponse.json({ error: "Unable to load checkout intent" }, { status: 500 });
    }

    return NextResponse.json({ intent: bySession ?? null });
  }

  const { data, error } = await supabaseAdmin
    .from("checkout_intents")
    .select("id, status, plan_code, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[billing][checkout-intent-status] query failed", error);
    return NextResponse.json({ error: "Unable to load checkout intent" }, { status: 500 });
  }

  const intent = data as
    | { id: string; status: string; plan_code: string; created_at: string }
    | null;

  if (
    intent &&
    intent.status === "pending" &&
    PACK_PLANS.has(String(intent.plan_code ?? "").toLowerCase())
  ) {
    return NextResponse.json({
      intent: {
        status: intent.status,
        plan_code: intent.plan_code,
        created_at: intent.created_at,
      },
    });
  }

  return NextResponse.json({ intent: null });
}
