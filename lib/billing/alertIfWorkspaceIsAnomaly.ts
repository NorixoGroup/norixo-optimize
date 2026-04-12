import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSlackAlert } from "@/lib/slack/sendSlackAlert";

export async function alertIfWorkspaceIsAnomaly(workspaceId: string) {
  const supabaseAdmin = createSupabaseAdminClient();

  // 1. Charger la vue
  const { data, error } = await supabaseAdmin
    .from("workspace_revenue_with_status")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[slack-alert] Failed to load workspace_revenue_with_status", error);
    return;
  }

  if (!data) return;

  // 2. Check anomaly
  if (data.billing_status !== "⚠️ anomaly") {
    return;
  }

  // 3. ANTI-SPAM (30 minutes)
  const THIRTY_MINUTES_AGO = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: recentEvents, error: recentEventsError } = await supabaseAdmin
    .from("usage_events")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("event_type", "slack_alert_sent")
    .gte("created_at", THIRTY_MINUTES_AGO)
    .limit(1);

  if (recentEventsError) {
    console.error("[slack-alert] Failed to check recent alerts", recentEventsError);
    return;
  }

  if (recentEvents && recentEvents.length > 0) {
    console.info("[slack-alert] skipped (anti-spam active)", {
      workspaceId,
    });
    return;
  }

  // 4. ENVOI SLACK
  await sendSlackAlert({
    title: "⚠️ Billing anomaly detected",
    workspaceName: data.workspace_name,
    workspaceId: data.workspace_id,
    planCode: data.plan_code,
    subscriptionStatus: data.subscription_status,
    paymentsCount: data.payments_count,
    totalRevenue: data.total_revenue,
    billingStatus: data.billing_status,
    lastPaymentAt: data.last_payment_at,
  });

  // 5. TRACE pour anti-spam
  await supabaseAdmin.from("usage_events").insert({
    workspace_id: workspaceId,
    event_type: "slack_alert_sent",
    quantity: 1,
    metadata: {
      alert_type: "billing_anomaly",
    },
  });

  console.info("[slack-alert] sent", {
    workspaceId,
  });
}