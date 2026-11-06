import { BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_DEFAULT_LIMIT } from "./backlink-zerobounce-budget";

export type BacklinkZeroBounceBudgetRuntimeConfig = {
  /**
   * null means the operator has not confirmed the provider's billing-cycle
   * anchor yet. Callers must treat this as "verification unavailable", never
   * guess a rolling window -- see BL-AUTO-04 Mission B.
   */
  cyclePeriodStart: string | null;
  limit: number;
};

const CYCLE_PERIOD_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readBacklinkZeroBounceBudgetRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BacklinkZeroBounceBudgetRuntimeConfig {
  const rawStart = env.BACKLINK_ZEROBOUNCE_CYCLE_PERIOD_START?.trim();
  const cyclePeriodStart = rawStart != null && CYCLE_PERIOD_START_PATTERN.test(rawStart) ? rawStart : null;

  const rawLimit = env.BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_LIMIT?.trim();
  const parsedLimit = rawLimit != null ? Number.parseInt(rawLimit, 10) : Number.NaN;
  const limit = Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100
    ? parsedLimit
    : BACKLINK_ZEROBOUNCE_VERIFICATION_BUDGET_DEFAULT_LIMIT;

  return { cyclePeriodStart, limit };
}
