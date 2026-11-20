import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

export async function tryReserveBacklinkLiveAutoSendCycle(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; cycleId: string; outreachId: string; reservedAt: string },
): Promise<{ kind: "acquired" } | { kind: "already_reserved" }> {
  const { error } = await client
    .from("backlink_live_auto_send_cycle_reservations")
    .insert({
      workspace_id: input.workspaceId,
      cycle_id: input.cycleId,
      outreach_id: input.outreachId,
      reserved_at: input.reservedAt,
    });
  if (error == null) return { kind: "acquired" };
  const normalized = normalizeBacklinkRepositoryError("tryReserveBacklinkLiveAutoSendCycle", error);
  if (normalized.code === "CONFLICT") return { kind: "already_reserved" };
  throw normalized;
}

/** Only a proven no-candidate result may release its own reservation. */
export async function releaseBacklinkLiveAutoSendCycleReservation(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; cycleId: string; outreachId: string },
): Promise<void> {
  const { error } = await client
    .from("backlink_live_auto_send_cycle_reservations")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("cycle_id", input.cycleId)
    .eq("outreach_id", input.outreachId);
  if (error != null) throw normalizeBacklinkRepositoryError("releaseBacklinkLiveAutoSendCycleReservation", error);
}
