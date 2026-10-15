import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

import type { BraveRequestReservationOutcome } from "../brave-request-budget";

type ReservationRow = {
  reservation_outcome?: unknown;
  reservation_id?: unknown;
  window_used?: unknown;
};

type RpcClient = {
  rpc: (
    name: "reserve_backlink_brave_request",
    args: { p_workspace_id: string; p_run_id: string | null; p_request_key: string },
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type BraveRequestReservation = {
  outcome: BraveRequestReservationOutcome;
  reservationId: string | null;
  windowUsed: number;
};

const OUTCOMES: readonly BraveRequestReservationOutcome[] = ["reserved", "replayed", "limit_reached"];

/**
 * Calls the atomic database reservation. Must be used with the service-role
 * client; the function is not callable by ordinary users. Any error or
 * malformed result throws, so callers fail closed.
 */
export async function reserveBacklinkBraveRequest(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; runId: string | null; requestKey: string },
): Promise<BraveRequestReservation> {
  const operation = "reserveBacklinkBraveRequest";
  // The generated database types predate this function; the call is typed locally.
  const { data, error } = await (client as unknown as RpcClient).rpc("reserve_backlink_brave_request", {
    p_workspace_id: input.workspaceId,
    p_run_id: input.runId,
    p_request_key: input.requestKey,
  });
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);

  const row = Array.isArray(data) && data.length === 1 ? (data[0] as ReservationRow) : null;
  const outcome = row?.reservation_outcome;
  if (
    row === null ||
    typeof outcome !== "string" ||
    !OUTCOMES.includes(outcome as BraveRequestReservationOutcome) ||
    typeof row.window_used !== "number"
  ) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation,
      message: "The database returned an invalid Brave request reservation result.",
    });
  }

  return {
    outcome: outcome as BraveRequestReservationOutcome,
    reservationId: typeof row.reservation_id === "string" ? row.reservation_id : null,
    windowUsed: row.window_used,
  };
}
