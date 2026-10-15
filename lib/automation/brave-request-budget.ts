import {
  BacklinkDiscoveryProviderError,
  type BacklinkDiscoveryProvider,
  type BacklinkDiscoveryRequestContext,
} from "./backlink-discovery-provider-types";

/**
 * Documentation of the budget. The database function
 * `reserve_backlink_brave_request` is authoritative and enforces these numbers;
 * nothing in application code counts requests.
 */
export const BACKLINK_BRAVE_REQUEST_BUDGET_LIMIT = 80;
export const BACKLINK_BRAVE_REQUEST_BUDGET_WINDOW_DAYS = 30;

export type BraveRequestReservationOutcome = "reserved" | "replayed" | "limit_reached";

export type ReserveBraveRequest = (input: {
  workspaceId: string;
  runId: string | null;
  requestKey: string;
}) => Promise<{ outcome: BraveRequestReservationOutcome }>;

/** One key per task attempt and query: a retry is a new attempt and needs a new reservation. */
export function buildBraveRequestKey(
  context: BacklinkDiscoveryRequestContext,
  queryIndex: number,
): string {
  return `brave:${context.taskId}:a${context.taskAttempt}:q${queryIndex}`;
}

function budgetUnavailableError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_CONFIGURATION_ERROR",
    "Brave Search request budget is unavailable",
    false,
  );
}

/** Internal 80/30-day budget refusal. Distinct from Brave's own HTTP 429 (PROVIDER_QUOTA_EXCEEDED). */
function budgetExhaustedError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_BUDGET_EXHAUSTED",
    "Brave Search request budget is exhausted",
    false,
  );
}

function reservationReplayedError(): BacklinkDiscoveryProviderError {
  return new BacklinkDiscoveryProviderError(
    "PROVIDER_QUOTA_EXCEEDED",
    "Brave Search request was already reserved for this attempt",
    false,
  );
}

/**
 * Wraps a provider so that no request leaves the process without a successful,
 * new reservation. Anything other than an explicit `reserved` outcome (limit,
 * replay, error, missing context, malformed result) sends nothing.
 */
export function createBudgetedBacklinkDiscoveryProvider(
  provider: BacklinkDiscoveryProvider,
  reserve: ReserveBraveRequest,
): BacklinkDiscoveryProvider {
  return {
    name: provider.name,
    async search(searchInput) {
      const context = searchInput.requestContext;
      if (
        context === undefined ||
        typeof context.workspaceId !== "string" ||
        context.workspaceId.length === 0 ||
        typeof context.taskId !== "string" ||
        context.taskId.length === 0 ||
        !Number.isInteger(context.taskAttempt) ||
        context.taskAttempt < 0
      ) {
        throw budgetUnavailableError();
      }

      let outcome: unknown;
      try {
        const reservation = await reserve({
          workspaceId: context.workspaceId,
          runId: context.runId,
          requestKey: buildBraveRequestKey(context, searchInput.queryIndex),
        });
        outcome = reservation?.outcome;
      } catch {
        throw budgetUnavailableError();
      }

      if (outcome === "limit_reached") throw budgetExhaustedError();
      if (outcome === "replayed") throw reservationReplayedError();
      if (outcome !== "reserved") throw budgetUnavailableError();

      return provider.search(searchInput);
    },
  };
}
