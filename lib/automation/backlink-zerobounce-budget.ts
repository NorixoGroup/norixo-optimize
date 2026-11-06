import { createHash } from "node:crypto";

import type { MailboxVerificationProvider, MailboxVerificationResult } from "@/lib/backlinks/services/mailboxVerificationService";

/**
 * Deliberately below ZeroBounce's own stated 100/cycle limit. The margin is
 * for verifications made directly in the ZeroBounce dashboard outside this
 * application, which this budget cannot see or count. Configurable, not a
 * silent assumption that the full 100 is available to us alone.
 */
export const BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_DEFAULT_LIMIT = 80;

export type ZeroBounceVerificationReservationOutcome = "reserved" | "replayed" | "limit_reached";

export type ReserveZeroBounceVerification = (input: {
  workspaceId: string;
  contactId: string;
  emailFingerprint: string;
  /**
   * ISO date identifying the current provider billing cycle. Callers must
   * derive this from the actual ZeroBounce renewal anchor (confirmed 2026-12-01),
   * never assume a rolling 30-day window equals the provider's billing month.
   */
  cyclePeriodStart: string;
  limit: number;
}) => Promise<{ outcome: ZeroBounceVerificationReservationOutcome }>;

export class BacklinkZeroBounceBudgetError extends Error {
  constructor(readonly code: "LIMIT_REACHED" | "ALREADY_RESERVED" | "BUDGET_UNAVAILABLE") {
    super(`BACKLINK_ZEROBOUNCE_BUDGET_${code}`);
  }
}

export function fingerprintZeroBounceEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export type BudgetedMailboxVerificationContext = {
  workspaceId: string;
  contactId: string;
  cyclePeriodStart: string;
  limit?: number;
};

/**
 * Wraps a MailboxVerificationProvider so that no ZeroBounce request leaves the
 * process without a successful, new atomic reservation. A "replayed" outcome
 * (this exact workspace+contact+email was already reserved this cycle) throws
 * instead of proceeding -- it must never trigger a second provider call.
 * Modeled on createBudgetedBacklinkDiscoveryProvider (brave-request-budget.ts).
 */
export function createBudgetedMailboxVerificationProvider(
  provider: MailboxVerificationProvider,
  reserve: ReserveZeroBounceVerification,
  context: BudgetedMailboxVerificationContext,
): MailboxVerificationProvider {
  return {
    async verify(input): Promise<MailboxVerificationResult> {
      if (!context.workspaceId || !context.contactId || !context.cyclePeriodStart) {
        throw new BacklinkZeroBounceBudgetError("BUDGET_UNAVAILABLE");
      }
      const emailFingerprint = fingerprintZeroBounceEmail(input.email);
      let outcome: unknown;
      try {
        const reservation = await reserve({
          workspaceId: context.workspaceId,
          contactId: context.contactId,
          emailFingerprint,
          cyclePeriodStart: context.cyclePeriodStart,
          limit: context.limit ?? BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_DEFAULT_LIMIT,
        });
        outcome = reservation?.outcome;
      } catch {
        throw new BacklinkZeroBounceBudgetError("BUDGET_UNAVAILABLE");
      }
      if (outcome === "limit_reached") throw new BacklinkZeroBounceBudgetError("LIMIT_REACHED");
      if (outcome === "replayed") throw new BacklinkZeroBounceBudgetError("ALREADY_RESERVED");
      if (outcome !== "reserved") throw new BacklinkZeroBounceBudgetError("BUDGET_UNAVAILABLE");
      return provider.verify(input);
    },
  };
}
