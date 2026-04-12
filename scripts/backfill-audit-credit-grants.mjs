#!/usr/bin/env node

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const PLAN_CREDIT_TOTALS = {
  pro: 5,
  scale: 15,
};

const ACTIVE_STATUSES = ["active", "trialing"];
const DRY_RUN = process.argv.includes("--dry-run");
const GRANT_EVENT_TYPE = "audit_credit_granted";
const BACKFILL_SOURCE = "backfill_pro_scale_missing_credit_grant_v1";
const BATCH_SIZE = 200;

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function resolveTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function pickLatestSubscriptionByWorkspace(subscriptions) {
  const byWorkspace = new Map();

  for (const row of subscriptions) {
    const workspaceId = row.workspace_id;
    if (!workspaceId) continue;

    const candidateRank = Math.max(
      resolveTimestamp(row.updated_at),
      resolveTimestamp(row.created_at)
    );
    const current = byWorkspace.get(workspaceId);

    if (!current) {
      byWorkspace.set(workspaceId, { row, rank: candidateRank });
      continue;
    }

    if (candidateRank >= current.rank) {
      byWorkspace.set(workspaceId, { row, rank: candidateRank });
    }
  }

  return Array.from(byWorkspace.values()).map((entry) => entry.row);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("subscriptions")
    .select("workspace_id, plan_code, status, created_at, updated_at")
    .in("plan_code", Object.keys(PLAN_CREDIT_TOTALS))
    .in("status", ACTIVE_STATUSES)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (subscriptionsError) {
    throw new Error(
      `Failed to load active pro/scale subscriptions: ${subscriptionsError.message}`
    );
  }

  const latestSubscriptions = pickLatestSubscriptionByWorkspace(subscriptions ?? []);
  const workspaceIds = latestSubscriptions.map((row) => row.workspace_id).filter(Boolean);

  if (workspaceIds.length === 0) {
    console.info("[backfill][audit_credit_granted] no active pro/scale workspaces found");
    return;
  }

  const workspacesWithGrant = new Set();
  const workspaceChunks = chunkArray(workspaceIds, BATCH_SIZE);

  for (const idsChunk of workspaceChunks) {
    const { data: grants, error: grantsError } = await supabaseAdmin
      .from("usage_events")
      .select("workspace_id")
      .in("workspace_id", idsChunk)
      .eq("event_type", GRANT_EVENT_TYPE);

    if (grantsError) {
      throw new Error(
        `Failed to load existing audit_credit_granted events: ${grantsError.message}`
      );
    }

    for (const row of grants ?? []) {
      if (row.workspace_id) {
        workspacesWithGrant.add(row.workspace_id);
      }
    }
  }

  const eventsToInsert = latestSubscriptions
    .filter((row) => row.workspace_id && !workspacesWithGrant.has(row.workspace_id))
    .map((row) => {
      const planCode = row.plan_code;
      const quantity = PLAN_CREDIT_TOTALS[planCode] ?? 0;

      return {
        workspace_id: row.workspace_id,
        event_type: GRANT_EVENT_TYPE,
        quantity,
        metadata: {
          source: BACKFILL_SOURCE,
          reason: "legacy_active_subscription_missing_credit_grant",
          plan_code: planCode,
        },
      };
    })
    .filter((event) => event.quantity > 0);

  console.info("[backfill][audit_credit_granted] summary", {
    dryRun: DRY_RUN,
    scannedActiveWorkspaces: latestSubscriptions.length,
    alreadyGranted: workspacesWithGrant.size,
    missingGrants: eventsToInsert.length,
  });

  if (eventsToInsert.length === 0) {
    console.info("[backfill][audit_credit_granted] nothing to insert");
    return;
  }

  if (DRY_RUN) {
    console.info("[backfill][audit_credit_granted] dry-run sample", eventsToInsert.slice(0, 10));
    return;
  }

  for (const batch of chunkArray(eventsToInsert, BATCH_SIZE)) {
    const { error: insertError } = await supabaseAdmin.from("usage_events").insert(batch);

    if (insertError) {
      throw new Error(`Failed to insert backfill usage events: ${insertError.message}`);
    }
  }

  console.info("[backfill][audit_credit_granted] inserted", {
    insertedCount: eventsToInsert.length,
    source: BACKFILL_SOURCE,
  });
}

main().catch((error) => {
  console.error("[backfill][audit_credit_granted] failed", error);
  process.exitCode = 1;
});
