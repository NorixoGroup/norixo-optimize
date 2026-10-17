import type { Json } from "@/types/database.types";

import {
  generateBacklinkDiscoveryQuerySuggestions,
  normalizeBacklinkDiscoveryQueryKey,
  type BacklinkDiscoveryQuerySuggestionResult,
} from "./backlink-discovery-query-generator";
import type { AutomationRun } from "./types";

/**
 * Scheduled AI-assisted Brave discovery.
 *
 * Window: one logical run per UTC calendar date, on Monday, Wednesday and Friday only.
 * The run idempotency key is derived from that date, so the existing
 * `automation_runs` unique constraint rejects a second run for the same window.
 * Output is the existing discovery/qualification/promotion PREVIEW; nothing is promoted,
 * no contact is resolved and nothing is sent.
 */

// The run kind used by prepareBacklinksAutomationRun; the idempotency key below keeps scheduled runs distinct.
export const SCHEDULED_DISCOVERY_RUN_KIND = "backlinks.daily_preview";
export const SCHEDULED_DISCOVERY_MAX_QUERIES = 5;
export const SCHEDULED_DISCOVERY_MAX_RESULTS_PER_QUERY = 5;
export const SCHEDULED_DISCOVERY_MAX_WORKSPACES = 3;
export const SCHEDULED_DISCOVERY_HISTORY_DAYS = 90;
export const SCHEDULED_DISCOVERY_PROMPT_HISTORY_LIMIT = 30;
export const SCHEDULED_DISCOVERY_WORKER_ID = "norixo-scheduled-discovery";

/** Monday, Wednesday, Friday (UTC). */
const SCHEDULED_WEEKDAYS_UTC: readonly number[] = [1, 3, 5];

export type ScheduledDiscoveryMarket = { countryCode: string; languageCode: string };

/** Fixed order; rotation index is derived from the date alone, so it is auditable and repeatable. */
export const SCHEDULED_DISCOVERY_MARKETS: readonly ScheduledDiscoveryMarket[] = Object.freeze([
  { countryCode: "US", languageCode: "en" },
  { countryCode: "GB", languageCode: "en" },
  { countryCode: "FR", languageCode: "fr" },
  { countryCode: "ES", languageCode: "es" },
  { countryCode: "DE", languageCode: "de" },
  { countryCode: "CA", languageCode: "en" },
  // Asian and Middle Eastern markets run in English until localized landing pages and
  // editorial outreach are verified. Appended, so the first six positions keep their order.
  { countryCode: "JP", languageCode: "en" },
  { countryCode: "SG", languageCode: "en" },
  { countryCode: "KR", languageCode: "en" },
  { countryCode: "TH", languageCode: "en" },
  { countryCode: "AE", languageCode: "en" },
]);

/**
 * Markets whose country code is NOT in Brave's published country-filter list (checked against a
 * third-party copy of that list, not Brave's own documentation, which does not enumerate values).
 * For these the market still steers query generation, but no `country` filter is sent to Brave:
 * a rejected request would still consume a budget reservation.
 */
const BRAVE_COUNTRY_FILTER_UNSUPPORTED: readonly string[] = Object.freeze(["TH", "AE"]);

export function isBraveCountryFilterSupported(countryCode: string): boolean {
  return !BRAVE_COUNTRY_FILTER_UNSUPPORTED.includes(countryCode);
}

// Monday 2026-01-05 (UTC): the first scheduled window of the rotation.
const ROTATION_EPOCH_UTC_MS = Date.UTC(2026, 0, 5);
const DAY_MS = 24 * 60 * 60 * 1000;

export type ScheduledDiscoveryWindow = {
  /** UTC date, YYYY-MM-DD. */
  windowDate: string;
  idempotencyKey: string;
};

export function isScheduledDiscoveryEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.BACKLINK_SCHEDULED_DISCOVERY_ENABLED === "true";
}

/** Returns the window for `now`, or null when `now` (UTC) is not a scheduled weekday. */
export function resolveScheduledDiscoveryWindow(now: Date): ScheduledDiscoveryWindow | null {
  if (!Number.isFinite(now.getTime())) return null;
  if (!SCHEDULED_WEEKDAYS_UTC.includes(now.getUTCDay())) return null;
  const windowDate = now.toISOString().slice(0, 10);
  return { windowDate, idempotencyKey: `scheduled-discovery:${windowDate}` };
}

/** Deterministic: the n-th scheduled window since the epoch maps to market n mod (market count). */
export function selectScheduledDiscoveryMarket(windowDate: string): ScheduledDiscoveryMarket {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(windowDate);
  if (parsed === null) throw new Error("SCHEDULED_DISCOVERY_WINDOW_DATE_INVALID");
  const dayMs = Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3]));
  const weekday = new Date(dayMs).getUTCDay();
  const slot = SCHEDULED_WEEKDAYS_UTC.indexOf(weekday);
  const daysSinceEpoch = Math.round((dayMs - ROTATION_EPOCH_UTC_MS) / DAY_MS);
  if (slot === -1 || daysSinceEpoch < 0) throw new Error("SCHEDULED_DISCOVERY_WINDOW_DATE_INVALID");
  const ordinal = Math.floor(daysSinceEpoch / 7) * SCHEDULED_WEEKDAYS_UTC.length + slot;
  return SCHEDULED_DISCOVERY_MARKETS[ordinal % SCHEDULED_DISCOVERY_MARKETS.length]!;
}

export type ScheduledDiscoveryBraveLimits = {
  maxSearchesPerRun: number;
  maxResultsPerSearch: number;
};

export function buildScheduledDiscoveryInput(input: {
  queries: readonly string[];
  market: ScheduledDiscoveryMarket;
  braveLimits: ScheduledDiscoveryBraveLimits;
}): Record<string, Json> {
  const maxQueries = Math.min(SCHEDULED_DISCOVERY_MAX_QUERIES, input.braveLimits.maxSearchesPerRun);
  const maxResults = Math.min(
    SCHEDULED_DISCOVERY_MAX_RESULTS_PER_QUERY,
    input.braveLimits.maxResultsPerSearch,
  );
  const queries = input.queries.slice(0, maxQueries);
  return {
    version: 1,
    source: "scheduled",
    provider: "brave_search",
    searches: queries.map((query) => ({
      query,
      ...(isBraveCountryFilterSupported(input.market.countryCode)
        ? { countryCode: input.market.countryCode }
        : {}),
      languageCode: input.market.languageCode,
    })),
    maxResultsPerSearch: maxResults,
    maxCandidates: maxQueries * maxResults,
  };
}

export type ScheduledDiscoveryWorkspaceOutcome =
  | "completed"
  | "pending_retry"
  | "failed"
  | "rejected"
  | "skipped_window_exists"
  | "skipped_no_queries"
  | "error";

export type ScheduledDiscoveryResult =
  | { disposition: "disabled" }
  | { disposition: "not_scheduled_day" }
  | { disposition: "brave_disabled" }
  | {
      disposition: "completed";
      windowDate: string;
      market: ScheduledDiscoveryMarket;
      workspaces: readonly { workspaceId: string; outcome: ScheduledDiscoveryWorkspaceOutcome }[];
    };

export type ScheduledDiscoveryDependencies = {
  isEnabled: () => boolean;
  /** null when Brave discovery is not configured. */
  getBraveLimits: () => ScheduledDiscoveryBraveLimits | null;
  /** Only workspaces whose existing control has backlinks enabled and no disabled reason. */
  listEligibleWorkspaceIds: (limit: number) => Promise<readonly string[]>;
  getRunByKey: (input: { workspaceId: string; runKind: string; idempotencyKey: string }) => Promise<AutomationRun | null>;
  listRecentQueries: (input: { workspaceId: string; since: string; limit: number }) => Promise<readonly string[]>;
  generateQueries: typeof generateBacklinkDiscoveryQuerySuggestions;
  runTick: (input: {
    workspaceId: string;
    idempotencyKey: string;
    scheduledAt: string;
    discoveryInput: Record<string, Json>;
  }) => Promise<{ kind: string }>;
};

function dedupeAgainstHistory(
  suggestions: BacklinkDiscoveryQuerySuggestionResult["suggestions"],
  history: readonly string[],
): string[] {
  const seen = new Set(history.map(normalizeBacklinkDiscoveryQueryKey));
  const queries: string[] = [];
  for (const suggestion of suggestions) {
    const key = normalizeBacklinkDiscoveryQueryKey(suggestion.query);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    queries.push(suggestion.query);
  }
  return queries;
}

/**
 * A run for a window that already exists is never started again: a second cron
 * delivery, a retry or a manual re-invocation all stop here. Only a run that was
 * prepared but never started (`queued`) is resumed.
 */
export async function runScheduledBacklinkDiscovery(
  deps: ScheduledDiscoveryDependencies,
  input: { now: Date },
): Promise<ScheduledDiscoveryResult> {
  // Everything below this line is behind the flag: when OFF there are no reads, AI calls or writes.
  if (!deps.isEnabled()) return { disposition: "disabled" };

  const window = resolveScheduledDiscoveryWindow(input.now);
  if (window === null) return { disposition: "not_scheduled_day" };

  const braveLimits = deps.getBraveLimits();
  if (braveLimits === null) return { disposition: "brave_disabled" };

  const market = selectScheduledDiscoveryMarket(window.windowDate);
  const since = new Date(input.now.getTime() - SCHEDULED_DISCOVERY_HISTORY_DAYS * DAY_MS).toISOString();
  const workspaceIds = await deps.listEligibleWorkspaceIds(SCHEDULED_DISCOVERY_MAX_WORKSPACES);
  const workspaces: { workspaceId: string; outcome: ScheduledDiscoveryWorkspaceOutcome }[] = [];

  for (const workspaceId of [...workspaceIds].sort()) {
    try {
      const existing = await deps.getRunByKey({
        workspaceId,
        runKind: SCHEDULED_DISCOVERY_RUN_KIND,
        idempotencyKey: window.idempotencyKey,
      });
      if (existing !== null && existing.status !== "queued") {
        workspaces.push({ workspaceId, outcome: "skipped_window_exists" });
        continue;
      }

      const history = await deps.listRecentQueries({
        workspaceId,
        since,
        limit: 500,
      });
      const generated = await deps.generateQueries({
        countryCode: market.countryCode,
        languageCode: market.languageCode,
        count: SCHEDULED_DISCOVERY_MAX_QUERIES,
        excludeQueries: history.slice(0, SCHEDULED_DISCOVERY_PROMPT_HISTORY_LIMIT),
      });
      // The prompt only sees the most recent queries; the full history is enforced here.
      const queries = dedupeAgainstHistory(generated.suggestions, history);
      if (queries.length === 0) {
        workspaces.push({ workspaceId, outcome: "skipped_no_queries" });
        continue;
      }

      const result = await deps.runTick({
        workspaceId,
        idempotencyKey: window.idempotencyKey,
        scheduledAt: input.now.toISOString(),
        discoveryInput: buildScheduledDiscoveryInput({ queries, market, braveLimits }),
      });
      const outcome: ScheduledDiscoveryWorkspaceOutcome =
        result.kind === "completed" || result.kind === "pending_retry" || result.kind === "rejected"
          ? result.kind
          : "failed";
      workspaces.push({ workspaceId, outcome });
    } catch {
      // One workspace failing (AI, database, provider) must not hide the others or leak details.
      workspaces.push({ workspaceId, outcome: "error" });
    }
  }

  return { disposition: "completed", windowDate: window.windowDate, market, workspaces };
}
