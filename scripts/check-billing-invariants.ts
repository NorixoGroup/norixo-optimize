/**
 * Vérifications défensives des invariants billing (crédits d’audit).
 * Usage : npx tsx scripts/check-billing-invariants.ts
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (.env.local chargé automatiquement si présent).
 *
 * Référence — appels à consumeWorkspaceAuditCredits (au 2026-04) :
 * uniquement lib/billing/consumeWorkspaceAuditCredits.ts définition ;
 * usages : app/api/audits/route.ts, app/api/listings/route.ts.
 * Toute occurrence supplémentaire doit être examinée (rg consumeWorkspaceAuditCredits).
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function tryLoadDotEnvLocal() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  try {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

const ALLOWED_AUDIT_CREDIT_CONSUMED_SOURCES = new Set([
  "api_audits_create",
  "api_listings_create",
]);

async function main() {
  tryLoadDotEnvLocal();
  const admin = createSupabaseAdminClient();

  const pageSize = 1000;
  let offset = 0;
  const consumedRows: Array<{
    id: string;
    workspace_id: string | null;
    created_at: string | null;
    metadata: Record<string, unknown> | null;
  }> = [];

  for (;;) {
    const { data, error } = await admin
      .from("usage_events")
      .select("id, workspace_id, created_at, metadata")
      .eq("event_type", "audit_credit_consumed")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[check-billing-invariants] usage_events query failed", error);
      process.exit(1);
    }
    const batch = data ?? [];
    consumedRows.push(...(batch as typeof consumedRows));
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  const badWebhookSource = consumedRows.filter(
    (r) => (r.metadata as { source?: unknown } | null)?.source === "stripe_webhook"
  );

  const badOrMissingSource = consumedRows.filter((r) => {
    const s = (r.metadata as { source?: unknown } | null)?.source;
    return typeof s !== "string" || !ALLOWED_AUDIT_CREDIT_CONSUMED_SOURCES.has(s);
  });

  const { data: packLots, error: packErr } = await admin
    .from("audit_credit_lots")
    .select(
      "id, workspace_id, source_type, source_ref, granted_quantity, consumed_quantity, created_at"
    )
    .eq("source_type", "stripe_checkout_pack")
    .order("created_at", { ascending: false })
    .limit(40);

  if (packErr) {
    console.error("[check-billing-invariants] audit_credit_lots query failed", packErr);
    process.exit(1);
  }

  const overConsumed = (packLots ?? []).filter((row) => {
    const g = Math.max(Number((row as { granted_quantity?: unknown }).granted_quantity ?? 0), 0);
    const c = Math.max(Number((row as { consumed_quantity?: unknown }).consumed_quantity ?? 0), 0);
    return c > g;
  });

  console.log("--- check-billing-invariants ---");
  console.log("usage_events audit_credit_consumed (échantillonné) :", consumedRows.length);
  console.log(
    "violations metadata.source = stripe_webhook :",
    badWebhookSource.length,
    badWebhookSource.slice(0, 5)
  );
  console.log(
    "violations source absente ou hors liste autorisée (api_audits_create | api_listings_create) :",
    badOrMissingSource.length
  );
  if (badOrMissingSource.length > 0) {
    console.log("exemples :", badOrMissingSource.slice(0, 8));
  }
  console.log("lots stripe_checkout_pack (40 derniers) — overConsumed (consumed > granted) :", overConsumed.length);
  if (overConsumed.length > 0) {
    console.log(overConsumed);
  }

  const failed =
    badWebhookSource.length > 0 || badOrMissingSource.length > 0 || overConsumed.length > 0;
  if (failed) {
    console.error("[check-billing-invariants] ÉCHEC — voir détails ci-dessus.");
    process.exit(1);
  }
  console.log("[check-billing-invariants] OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
