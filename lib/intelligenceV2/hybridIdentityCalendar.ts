// Lot H1.0: pure UTC calendar for the hybrid identity-linkage policy.
//
// This module deliberately has no clock, I/O, HMAC, token, listing identity,
// database, retention, or pipeline concerns. It defines fixed comparison
// boundaries only. In particular, the end of a link scope is NOT an
// observation-retention or purge instruction.

export const HYBRID_IDENTITY_ROTATION_DAYS = 90;
export const HYBRID_IDENTITY_LINK_SCOPE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;
const UTC_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type HybridIdentityCalendarConfig = Readonly<{
  /** Strict UTC ISO instant, for example 2026-01-01T00:00:00.000Z. */
  originUtc: string;
  rotationDays: number;
  linkScopeDays: number;
}>;

export type HybridIdentityCalendarValidation =
  | Readonly<{ ok: true; config: HybridIdentityCalendarConfig; originMs: number }>
  | Readonly<{
      ok: false;
      reason:
        | "invalid_config"
        | "invalid_origin_utc"
        | "unsupported_rotation_days"
        | "unsupported_link_scope_days"
        | "incoherent_scope_multiple";
    }>;

export type HybridIdentityRotationEpoch = Readonly<{
  epochId: string;
  epochIndex: number;
  startsAt: string;
  endsAt: string;
  linkScopeId: string;
  linkScopeIndex: number;
}>;

export type HybridIdentityLinkScope = Readonly<{
  linkScopeId: string;
  linkScopeIndex: number;
  startsAt: string;
  endsAt: string;
}>;

function parseStrictUtcInstant(value: unknown): number | null {
  if (typeof value !== "string" || !UTC_INSTANT_RE.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString() === value ? parsed : null;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function toUtcIso(ms: number): string | null {
  if (!Number.isSafeInteger(ms) || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/**
 * Validates the deliberately narrow H1.0 policy. Durations are exact UTC
 * 24-hour days, not calendar months. A caller must explicitly opt into the
 * policy values; accepting an arbitrary duration here would weaken the fixed
 * two-epoch / one-scope invariant on which H1.0 relies.
 */
export function validateHybridIdentityCalendarConfig(
  value: unknown,
): HybridIdentityCalendarValidation {
  if (value == null || typeof value !== "object") {
    return Object.freeze({ ok: false, reason: "invalid_config" });
  }

  const candidate = value as Partial<HybridIdentityCalendarConfig>;
  const originUtc = candidate.originUtc;
  const originMs = parseStrictUtcInstant(originUtc);
  if (originMs == null || typeof originUtc !== "string") {
    return Object.freeze({ ok: false, reason: "invalid_origin_utc" });
  }
  if (!isPositiveSafeInteger(candidate.rotationDays)) {
    return Object.freeze({ ok: false, reason: "unsupported_rotation_days" });
  }
  if (!isPositiveSafeInteger(candidate.linkScopeDays)) {
    return Object.freeze({ ok: false, reason: "unsupported_link_scope_days" });
  }
  if (candidate.rotationDays !== HYBRID_IDENTITY_ROTATION_DAYS) {
    return Object.freeze({ ok: false, reason: "unsupported_rotation_days" });
  }
  if (candidate.linkScopeDays !== HYBRID_IDENTITY_LINK_SCOPE_DAYS) {
    return Object.freeze({ ok: false, reason: "unsupported_link_scope_days" });
  }
  if (candidate.linkScopeDays !== candidate.rotationDays * 2) {
    return Object.freeze({ ok: false, reason: "incoherent_scope_multiple" });
  }

  return Object.freeze({
    ok: true,
    config: Object.freeze({
      originUtc,
      rotationDays: candidate.rotationDays,
      linkScopeDays: candidate.linkScopeDays,
    }),
    originMs,
  });
}

function epochId(config: HybridIdentityCalendarConfig, epochIndex: number): string {
  return `hybrid-identity-epoch:${config.originUtc}:${config.rotationDays}d:${epochIndex}`;
}

function linkScopeId(config: HybridIdentityCalendarConfig, linkScopeIndex: number): string {
  return `hybrid-identity-scope:${config.originUtc}:${config.linkScopeDays}d:${linkScopeIndex}`;
}

function intervalForIndex(
  originMs: number,
  days: number,
  index: number,
): Readonly<{ startsAt: string; endsAt: string }> | null {
  if (!Number.isSafeInteger(index) || index < 0) return null;
  const durationMs = days * DAY_MS;
  const startsAtMs = originMs + index * durationMs;
  const endsAtMs = startsAtMs + durationMs;
  const startsAt = toUtcIso(startsAtMs);
  const endsAt = toUtcIso(endsAtMs);
  return startsAt == null || endsAt == null ? null : Object.freeze({ startsAt, endsAt });
}

/**
 * Finds the fixed 90-day epoch containing `instantUtc`. Intervals are
 * half-open: [startsAt, endsAt). Invalid or pre-origin instants fail closed
 * with null; H1.0 deliberately defines no negative historical epoch.
 */
export function getHybridIdentityRotationEpoch(
  configValue: unknown,
  instantUtc: unknown,
): HybridIdentityRotationEpoch | null {
  const validated = validateHybridIdentityCalendarConfig(configValue);
  const instantMs = parseStrictUtcInstant(instantUtc);
  if (!validated.ok || instantMs == null || instantMs < validated.originMs) return null;

  const durationMs = validated.config.rotationDays * DAY_MS;
  const epochIndex = Math.floor((instantMs - validated.originMs) / durationMs);
  const interval = intervalForIndex(
    validated.originMs,
    validated.config.rotationDays,
    epochIndex,
  );
  if (interval == null) return null;

  const linkScopeIndex = Math.floor(
    (epochIndex * validated.config.rotationDays) / validated.config.linkScopeDays,
  );
  return Object.freeze({
    epochId: epochId(validated.config, epochIndex),
    epochIndex,
    startsAt: interval.startsAt,
    endsAt: interval.endsAt,
    linkScopeId: linkScopeId(validated.config, linkScopeIndex),
    linkScopeIndex,
  });
}

/** Finds the fixed 180-day comparison block containing `instantUtc`. */
export function getHybridIdentityLinkScope(
  configValue: unknown,
  instantUtc: unknown,
): HybridIdentityLinkScope | null {
  const validated = validateHybridIdentityCalendarConfig(configValue);
  const instantMs = parseStrictUtcInstant(instantUtc);
  if (!validated.ok || instantMs == null || instantMs < validated.originMs) return null;

  const durationMs = validated.config.linkScopeDays * DAY_MS;
  const linkScopeIndex = Math.floor((instantMs - validated.originMs) / durationMs);
  const interval = intervalForIndex(
    validated.originMs,
    validated.config.linkScopeDays,
    linkScopeIndex,
  );
  if (interval == null) return null;

  return Object.freeze({
    linkScopeId: linkScopeId(validated.config, linkScopeIndex),
    linkScopeIndex,
    startsAt: interval.startsAt,
    endsAt: interval.endsAt,
  });
}

/** Verifies that an epoch is wholly contained in exactly the supplied scope. */
export function epochBelongsToHybridIdentityLinkScope(
  epoch: HybridIdentityRotationEpoch | null | undefined,
  scope: HybridIdentityLinkScope | null | undefined,
): boolean {
  if (epoch == null || scope == null) return false;
  return (
    epoch.linkScopeId === scope.linkScopeId &&
    epoch.linkScopeIndex === scope.linkScopeIndex &&
    scope.startsAt <= epoch.startsAt &&
    epoch.endsAt <= scope.endsAt
  );
}

/**
 * The only H1.0 comparison/union gate. Distinct fixed scopes always fail
 * closed, preventing transitive chains from crossing a 180-day boundary.
 */
export function canCompareOrUnionWithinHybridIdentityScope(
  left: HybridIdentityLinkScope | null | undefined,
  right: HybridIdentityLinkScope | null | undefined,
): boolean {
  if (left == null || right == null) return false;
  return (
    left.linkScopeId === right.linkScopeId &&
    left.linkScopeIndex === right.linkScopeIndex &&
    left.startsAt === right.startsAt &&
    left.endsAt === right.endsAt
  );
}
