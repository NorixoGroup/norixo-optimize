import { BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_DEFAULT_LIMIT } from "./backlink-zerobounce-budget";

export type BacklinkZeroBounceBudgetRuntimeConfig = {
  /**
   * The current billing cycle's period start, computed from the confirmed
   * renewal anchor (BACKLINK_ZEROBOUNCE_CYCLE_PERIOD_START, format YYYY-MM-01
   * -- see BL-AUTO-04 Mission C). null means the anchor is unset, malformed,
   * or still in the future. Callers must treat null as "verification
   * unavailable", never guess a rolling window.
   */
  cyclePeriodStart: string | null;
  limit: number;
};

const ANCHOR_PATTERN = /^(\d{4})-(\d{2})-01$/;

/**
 * The anchor is the confirmed date of a past (or the first) ZeroBounce
 * monthly renewal, always the 1st of that month. The RPC's budget cap is
 * tied to the current calendar cycle, not to the anchor itself, so this
 * recomputes the 1st of `now`'s UTC calendar month on every call -- the
 * cycle rolls forward automatically and never needs a monthly operator edit.
 * Any ambiguity (malformed anchor, invalid month, or now before the anchor)
 * fails closed to null rather than guessing.
 */
export function computeBacklinkZeroBounceCyclePeriodStart(anchor: string, now: Date): string | null {
  if (Number.isNaN(now.getTime())) return null;

  const match = ANCHOR_PATTERN.exec(anchor);
  if (match == null) return null;
  const anchorYear = Number.parseInt(match[1], 10);
  const anchorMonth = Number.parseInt(match[2], 10);
  if (anchorMonth < 1 || anchorMonth > 12) return null;

  const anchorUtcMs = Date.UTC(anchorYear, anchorMonth - 1, 1);
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowUtcMs = Date.UTC(nowYear, nowMonth, 1);
  if (nowUtcMs < anchorUtcMs) return null;

  return `${String(nowYear).padStart(4, "0")}-${String(nowMonth + 1).padStart(2, "0")}-01`;
}

export function readBacklinkZeroBounceBudgetRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  now: () => Date = () => new Date(),
): BacklinkZeroBounceBudgetRuntimeConfig {
  const rawAnchor = env.BACKLINK_ZEROBOUNCE_CYCLE_PERIOD_START?.trim();
  const cyclePeriodStart = rawAnchor != null ? computeBacklinkZeroBounceCyclePeriodStart(rawAnchor, now()) : null;

  const rawLimit = env.BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_LIMIT?.trim();
  const parsedLimit = rawLimit != null ? Number.parseInt(rawLimit, 10) : Number.NaN;
  const limit = Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100
    ? parsedLimit
    : BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_DEFAULT_LIMIT;

  return { cyclePeriodStart, limit };
}
