import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type AuditCreditLotRow = {
  id: string;
  granted_quantity: number | null;
  consumed_quantity: number | null;
  expires_at: string | null;
  created_at: string;
};

export type ConsumeWorkspaceAuditCreditsResult = {
  requested: number;
  consumed: number;
  success: boolean;
};

export const NO_AUDIT_CREDITS_MESSAGE =
  "Vous n’avez plus de crédits disponibles. Choisissez une offre pour continuer.";

export async function consumeWorkspaceAuditCredits(
  workspaceId: string,
  client: SupabaseClient = supabase,
  quantity = 1
): Promise<ConsumeWorkspaceAuditCreditsResult> {
  const requested = Math.max(1, quantity);

  if (!workspaceId) {
    return {
      requested,
      consumed: 0,
      success: false,
    };
  }

  const nowIso = new Date().toISOString();
  let remaining = requested;

  // Retry a few passes to reduce race collisions without introducing global locking.
  for (let pass = 0; pass < 5 && remaining > 0; pass += 1) {
    const { data: lotsData, error: lotsError } = await client
      .from("audit_credit_lots")
      .select("id, granted_quantity, consumed_quantity, expires_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);

    if (lotsError) {
      console.warn("[billing][audit_credit_lots] failed to load lots for consumption", {
        workspaceId,
        lotsError,
      });
      break;
    }

    const rows = (lotsData ?? []) as AuditCreditLotRow[];

    const openLots = rows.filter((row) => {
      const granted = Math.max(row.granted_quantity ?? 0, 0);
      const consumed = Math.max(row.consumed_quantity ?? 0, 0);
      const hasRemaining = consumed < granted;
      const isExpired = Boolean(row.expires_at && row.expires_at <= nowIso);
      return hasRemaining && !isExpired;
    });

    if (openLots.length === 0) {
      break;
    }

    let consumedThisPass = 0;

    for (const lot of openLots) {
      if (remaining <= 0) break;

      const granted = Math.max(lot.granted_quantity ?? 0, 0);
      const consumed = Math.max(lot.consumed_quantity ?? 0, 0);
      const available = Math.max(granted - consumed, 0);

      if (available <= 0) continue;

      const consumeNow = Math.min(remaining, available);

      const { data: updateRows, error: updateError } = await client
        .from("audit_credit_lots")
        .update({
          consumed_quantity: consumed + consumeNow,
          updated_at: nowIso,
        })
        .eq("id", lot.id)
        .eq("consumed_quantity", consumed)
        .select("id")
        .limit(1);

      if (updateError) {
        console.warn("[billing][audit_credit_lots] failed to update lot consumption", {
          workspaceId,
          lotId: lot.id,
          updateError,
        });
        continue;
      }

      if (!updateRows || updateRows.length === 0) {
        continue;
      }

      remaining -= consumeNow;
      consumedThisPass += consumeNow;
    }

    if (consumedThisPass <= 0) {
      break;
    }
  }

  const consumed = requested - remaining;

  return {
    requested,
    consumed,
    success: consumed >= requested,
  };
}
