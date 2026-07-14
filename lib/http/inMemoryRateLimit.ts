const GLOBAL_RATE_LIMIT_STATE_KEY =
  "__NORIXO_IN_MEMORY_RATE_LIMIT_STATE_V1__";
const DEFAULT_MAX_ENTRIES = 5000;
const DEFAULT_PURGE_INTERVAL_MS = 60_000;
const INVALID_CONFIGURATION_RETRY_AFTER_SECONDS = 1;

type InMemoryRateLimitEntry = {
  count: number;
  windowStartedAt: number;
  windowMs: number;
};

type InMemoryRateLimitState = {
  entries: Map<string, InMemoryRateLimitEntry>;
  lastPurgeAt: number;
};

export type InMemoryRateLimitResult = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}>;

export type CheckInMemoryRateLimitInput = Readonly<{
  key: string;
  limit: number;
  windowMs: number;
  now?: () => number;
}>;

function getGlobalState(): InMemoryRateLimitState {
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_RATE_LIMIT_STATE_KEY]?: InMemoryRateLimitState;
  };

  if (globalScope[GLOBAL_RATE_LIMIT_STATE_KEY] == null) {
    globalScope[GLOBAL_RATE_LIMIT_STATE_KEY] = {
      entries: new Map<string, InMemoryRateLimitEntry>(),
      lastPurgeAt: 0,
    };
  }

  return globalScope[GLOBAL_RATE_LIMIT_STATE_KEY];
}

function normalizeKey(value: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed.slice(0, 256) : "anonymous";
}

function normalizePositiveInteger(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function pruneExpiredEntries(
  state: InMemoryRateLimitState,
  nowMs: number,
): void {
  for (const [key, entry] of state.entries) {
    if (nowMs >= entry.windowStartedAt + entry.windowMs) {
      state.entries.delete(key);
    }
  }
}

function evictOldestEntries(
  state: InMemoryRateLimitState,
  maxEntries: number,
): void {
  if (state.entries.size <= maxEntries) {
    return;
  }

  const oldestEntries = [...state.entries.entries()]
    .sort((left, right) => left[1].windowStartedAt - right[1].windowStartedAt);

  const overflowCount = state.entries.size - maxEntries;
  for (let index = 0; index < overflowCount; index += 1) {
    const candidate = oldestEntries[index];
    if (candidate == null) {
      break;
    }
    state.entries.delete(candidate[0]);
  }
}

function maybePurgeState(
  state: InMemoryRateLimitState,
  nowMs: number,
  maxEntries: number,
): void {
  const shouldPurge =
    nowMs - state.lastPurgeAt >= DEFAULT_PURGE_INTERVAL_MS ||
    state.entries.size > maxEntries;

  if (!shouldPurge) {
    return;
  }

  pruneExpiredEntries(state, nowMs);
  evictOldestEntries(state, maxEntries);
  state.lastPurgeAt = nowMs;
}

/**
 * Best-effort, process-local, non-distributed rate limiter.
 *
 * This helper intentionally keeps all state in-memory. Counters are not shared
 * across instances, disappear on restart, and only mitigate simple abuse.
 */
export function checkInMemoryRateLimit(
  input: CheckInMemoryRateLimitInput,
): InMemoryRateLimitResult {
  const nowMs = input.now?.() ?? Date.now();
  const normalizedKey = normalizeKey(input.key);
  const normalizedLimit = normalizePositiveInteger(input.limit);
  const normalizedWindowMs = normalizePositiveInteger(input.windowMs);

  if (normalizedLimit == null || normalizedWindowMs == null) {
    return Object.freeze({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: INVALID_CONFIGURATION_RETRY_AFTER_SECONDS,
      resetAt: nowMs + INVALID_CONFIGURATION_RETRY_AFTER_SECONDS * 1000,
    });
  }

  const state = getGlobalState();
  maybePurgeState(state, nowMs, DEFAULT_MAX_ENTRIES);

  const existingEntry = state.entries.get(normalizedKey);
  if (
    existingEntry == null ||
    existingEntry.windowMs !== normalizedWindowMs ||
    nowMs >= existingEntry.windowStartedAt + existingEntry.windowMs
  ) {
    const nextEntry: InMemoryRateLimitEntry = {
      count: 1,
      windowStartedAt: nowMs,
      windowMs: normalizedWindowMs,
    };
    state.entries.set(normalizedKey, nextEntry);

    return Object.freeze({
      allowed: true,
      remaining: Math.max(0, normalizedLimit - 1),
      retryAfterSeconds: 0,
      resetAt: nextEntry.windowStartedAt + nextEntry.windowMs,
    });
  }

  if (existingEntry.count >= normalizedLimit) {
    const resetAt = existingEntry.windowStartedAt + existingEntry.windowMs;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((resetAt - nowMs) / 1000),
    );

    return Object.freeze({
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      resetAt,
    });
  }

  existingEntry.count += 1;
  return Object.freeze({
    allowed: true,
    remaining: Math.max(0, normalizedLimit - existingEntry.count),
    retryAfterSeconds: 0,
    resetAt: existingEntry.windowStartedAt + existingEntry.windowMs,
  });
}

export function resetInMemoryRateLimitStateForTests(): void {
  const state = getGlobalState();
  state.entries.clear();
  state.lastPurgeAt = 0;
}

export function getInMemoryRateLimitStateSizeForTests(): number {
  return getGlobalState().entries.size;
}
