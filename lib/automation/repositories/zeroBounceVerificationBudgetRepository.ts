import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

import type { ZeroBounceVerificationReservationOutcome } from "../backlink-zerobounce-budget";

type ReservationRow = {
  reservation_outcome?: unknown;
  reservation_id?: unknown;
  period_used?: unknown;
};

type RpcClient = {
  rpc: (
    name: "reserve_backlink_zerobounce_verification",
    args: {
      p_workspace_id: string;
      p_contact_id: string;
      p_email_fingerprint: string;
      p_cycle_period_start: string;
      p_limit: number;
    },
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type ZeroBounceVerificationReservation = {
  outcome: ZeroBounceVerificationReservationOutcome;
  reservationId: string | null;
  periodUsed: number;
};

const OUTCOMES: readonly ZeroBounceVerificationReservationOutcome[] = ["reserved", "replayed", "limit_reached"];

/**
 * Calls the atomic database reservation function. Must be used with the
 * service-role client; the function is not callable by ordinary users. Any
 * error or malformed result throws, so callers fail closed -- never treated
 * as an implicit "reserved".
 *
 * Mirrors reserveBacklinkBraveRequest (braveRequestBudgetRepository.ts).
 */
export async function reserveBacklinkZeroBounceVerification(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; contactId: string; emailFingerprint: string; cyclePeriodStart: string; limit: number },
): Promise<ZeroBounceVerificationReservation> {
  const operation = "reserveBacklinkZeroBounceVerification";
  // The generated database types predate this function; the call is typed locally.
  const { data, error } = await (client as unknown as RpcClient).rpc("reserve_backlink_zerobounce_verification", {
    p_workspace_id: input.workspaceId,
    p_contact_id: input.contactId,
    p_email_fingerprint: input.emailFingerprint,
    p_cycle_period_start: input.cyclePeriodStart,
    p_limit: input.limit,
  });
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);

  const row = Array.isArray(data) && data.length === 1 ? (data[0] as ReservationRow) : null;
  const outcome = row?.reservation_outcome;
  if (
    row === null ||
    typeof outcome !== "string" ||
    !OUTCOMES.includes(outcome as ZeroBounceVerificationReservationOutcome) ||
    typeof row.period_used !== "number"
  ) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation,
      message: "The database returned an invalid ZeroBounce verification reservation result.",
    });
  }

  return {
    outcome: outcome as ZeroBounceVerificationReservationOutcome,
    reservationId: typeof row.reservation_id === "string" ? row.reservation_id : null,
    periodUsed: row.period_used,
  };
}
