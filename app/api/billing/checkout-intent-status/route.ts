import { NextRequest, NextResponse } from "next/server";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const PACK_PLANS = new Set(["starter", "pro", "scale"]);

/**
 * Dernier checkout_intent du workspace session (lecture seule, UX billing).
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
