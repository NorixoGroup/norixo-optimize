import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * The checkout intent of ONE Stripe session, limited to the caller's workspace: a session id that belongs to another
 * workspace (or does not exist) yields `null`, exactly like an unknown one.
 */
export async function findCheckoutIntentForSession(admin: AdminClient, workspaceId: string, sessionId: string) {
  return admin
    .from("checkout_intents")
    .select("status, plan_code, created_at, completed_at")
    .eq("workspace_id", workspaceId)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
}
