/**
 * SEO generator V3 — in-memory fact registry (isolated, deterministic, closed by default).
 *
 * - Nothing is persisted; there is no database, network or file access, and no module-level state:
 *   every `createFactRegistry()` call owns its own data.
 * - Hostile or malformed input cannot make `register` throw or store something other than what was
 *   checked: the input is first copied into an inert snapshot (factValidation.ts), the SNAPSHOT is
 *   validated, and that same snapshot, deeply frozen, is what gets stored.
 * - Replacement is explicit and never invented: a new version must name an EXISTING predecessor of
 *   the same series, with the next version number, and a predecessor can be replaced only once.
 *   A revocation never reinstates a fact on its own: a later version needs a NEW explicit human
 *   validation dated after the revocation.
 * - Lookups are scoped explicitly (geography, platform, property type); nothing is assumed
 *   equivalent. Reads return facts sorted by id, so every result is reproducible.
 */
import { localSeoTopics } from "../../../data/localSeo";

import { parseIsoDateTime } from "./dates";
import {
  snapshotUntrustedFact,
  validateFactSnapshot,
  type FactIssue,
} from "./factValidation";
import { parseIsoDateTime as parseDateTime } from "./dates";
import { assessFactUse, describedRange, type FactUse, type FactUseAssessment } from "./factUse";
import type { FactId, FactPlatform, FactPropertyType, GeographicScope, LocalFact } from "./localFact";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export type RegisterResult =
  | Readonly<{ ok: true; factId: FactId }>
  | Readonly<{ ok: false; issues: readonly FactIssue[] }>;

/**
 * Exact scope of a lookup. Every dimension is explicit: use `null` for "not applicable". A fact
 * matches only on strict equality of all of them; there are no fallbacks (a country fact never
 * answers a city page, a district fact never answers a whole-city page, a Booking fact never answers
 * an Airbnb page, a hotel fact never answers an apartment page).
 */
export type FactQuery = Readonly<{
  target: GeographicScope;
  platform: FactPlatform;
  propertyType: FactPropertyType;
  topic: LocalSeoTopicSlug;
}>;

export type AssessParams = Readonly<{
  asOf: string;
  use: FactUse;
  topic: LocalSeoTopicSlug | null;
}>;

/** An explicit human decision that a new observation may stand next to the revoked facts it overlaps. */
export type ArbitrationInput = Readonly<{
  factId: FactId;
  /** The overlapped revoked facts this decision covers. */
  revokedFactIds: readonly FactId[];
  arbiter: string;
  decidedAt: string;
  note: string;
}>;

export type ArbitrationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; issues: readonly FactIssue[] }>;

export type FactRegistry = Readonly<{
  register: (fact: LocalFact) => RegisterResult;
  get: (factId: FactId) => LocalFact | undefined;
  list: () => readonly LocalFact[];
  size: () => number;
  /** Every stored fact whose scope, platform, property type and topic match exactly, whatever its status. */
  findFacts: (query: FactQuery) => readonly LocalFact[];
  /** Oldest to newest version of the series that contains `factId`, or null if unknown. */
  getVersionChain: (factId: FactId) => readonly LocalFact[] | null;
  isSuperseded: (factId: FactId) => boolean;
  getSuccessor: (factId: FactId) => LocalFact | undefined;
  assess: (factId: FactId, params: AssessParams) => FactUseAssessment | null;
  /**
   * IANA zone of a jurisdiction, from exactly one distinct, usable, human-validated `timezone` fact
   * whose scope equals `scope`; null when there is none or when facts disagree (never guessed).
   */
  resolveTimeZone: (scope: GeographicScope, asOf: string) => string | null;
  /**
   * Revoked facts of the same series whose period overlaps this fact's, outside its own replacement
   * chain, that no arbitration decided at or before `asOf` covers. Empty when nothing is pending.
   */
  unresolvedRevokedOverlaps: (factId: FactId, asOf: string) => readonly FactId[];
  /** Records a human arbitration. It lifts only the overlap blocker; every other rule still applies. */
  recordArbitration: (input: ArbitrationInput) => ArbitrationResult;
}>;

export type TopicCatalogCheck = Readonly<{
  ok: boolean;
  missingInV3: readonly string[];
  extraInV3: readonly string[];
}>;

/** Compares the V3 topic list with the topic slugs the current (V2) pages actually use. */
export function checkTopicCatalog(currentSlugs: readonly string[]): TopicCatalogCheck {
  const current = new Set(currentSlugs);
  const v3 = new Set<string>(LOCAL_SEO_TOPIC_SLUGS);
  const missingInV3 = [...current].filter((slug) => !v3.has(slug)).sort();
  const extraInV3 = [...v3].filter((slug) => !current.has(slug)).sort();
  return Object.freeze({
    ok: missingInV3.length === 0 && extraInV3.length === 0 && current.size === currentSlugs.length,
    missingInV3: Object.freeze(missingInV3),
    extraInV3: Object.freeze(extraInV3),
  });
}

export type FactRegistryOptions = Readonly<{
  /** Topic slugs of the current pages. Defaults to the real catalogue; tests inject their own. */
  currentTopicSlugs?: readonly string[];
}>;

/** Deep-freezes plain data (the snapshot contains only plain objects and arrays). */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** What identifies a series of versions: scope, platform, property type, kind and what is measured. */
export function lineageKey(fact: LocalFact): string {
  const value = fact.value as Record<string, unknown>;
  const discriminator =
    fact.kind === "quantitative"
      ? value.metric
      : fact.kind === "qualitative"
        ? value.category
        : fact.kind === "regulatory"
          ? value.ruleType
          : value.attribute;
  return stable([fact.scope, fact.platform, fact.propertyType, fact.kind, discriminator]);
}

function sameScope(a: GeographicScope, b: GeographicScope): boolean {
  if (a.level !== b.level || a.countryCode !== b.countryCode) return false;
  if (a.level === "country" || b.level === "country") return true;
  if (a.citySlug !== b.citySlug) return false;
  if (a.level === "district" && b.level === "district") return a.districtName === b.districtName;
  return true;
}

function issue(code: FactIssue["code"], path: string, message: string): FactIssue {
  return { code, path, message };
}

export function createFactRegistry(options: FactRegistryOptions = {}): FactRegistry {
  // Fail closed: if the V3 topic list no longer matches the live catalogue, nothing may be stored.
  const catalog = checkTopicCatalog(options.currentTopicSlugs ?? localSeoTopics.map((topic) => topic.slug));
  if (!catalog.ok) {
    throw new Error(
      `SEO_V3_TOPIC_CATALOG_MISMATCH missing=[${catalog.missingInV3.join(",")}] extra=[${catalog.extraInV3.join(",")}]`,
    );
  }

  const facts = new Map<FactId, LocalFact>();
  const successors = new Map<FactId, FactId>();
  const arbitrations: { factId: FactId; revokedFactIds: readonly FactId[]; decidedAtMs: number }[] = [];

  const sorted = (): LocalFact[] => [...facts.values()].sort((a, b) => (a.factId < b.factId ? -1 : 1));

  function register(candidate: LocalFact): RegisterResult {
    // 1. inert snapshot (never runs user code), 2. validate THE SNAPSHOT, 3. store THE SNAPSHOT.
    const snapshot = snapshotUntrustedFact(candidate);
    if (!snapshot.ok) return Object.freeze({ ok: false, issues: Object.freeze([...snapshot.issues]) });

    const issues: FactIssue[] = validateFactSnapshot(snapshot.value);
    if (issues.length > 0) return Object.freeze({ ok: false, issues: Object.freeze(issues) });

    const fact = deepFreeze(snapshot.value) as unknown as LocalFact;

    if (facts.has(fact.factId)) {
      issues.push(issue("invalid_fact_id", "factId", "duplicate_fact_id: this id is already registered."));
    }

    if (fact.supersedes !== null) {
      const previous = facts.get(fact.supersedes);
      if (previous === undefined) {
        issues.push(issue("invalid_supersedes", "supersedes", "supersedes_unknown_fact: the replaced fact is not registered."));
      } else {
        if (previous.version + 1 !== fact.version) {
          issues.push(issue("invalid_version", "version", "version_not_consecutive: expected the predecessor's version + 1."));
        }
        if (lineageKey(previous) !== lineageKey(fact)) {
          issues.push(issue("invalid_supersedes", "supersedes", "supersedes_different_series: scope, platform, property type, kind or metric differ."));
        }
        if (successors.has(previous.factId)) {
          issues.push(issue("invalid_supersedes", "supersedes", "supersedes_already_replaced: the predecessor already has a successor."));
        }
        const previousAt = parseIsoDateTime(previous.collectedAt);
        const currentAt = parseIsoDateTime(fact.collectedAt);
        if (previousAt !== null && currentAt !== null && currentAt < previousAt) {
          issues.push(issue("chronology", "collectedAt", "successor_older_than_predecessor."));
        }
        // A revocation never reinstates a fact automatically: whatever follows it is either itself
        // refused/revoked, or carries a NEW human validation dated after the revocation.
        if (previous.validation.status === "revoked") {
          const revokedAt = parseIsoDateTime(previous.validation.revokedAt);
          const next = fact.validation;
          const terminal = next.status === "revoked" || next.status === "rejected";
          const revalidated =
            next.status === "human_validated" &&
            revokedAt !== null &&
            (parseIsoDateTime(next.validatedAt) ?? Number.NEGATIVE_INFINITY) > revokedAt;
          if (!terminal && !revalidated) {
            issues.push(
              issue("invalid_supersedes", "validation", "revocation_requires_new_validation: a version that follows a revocation needs a new human validation dated after it."),
            );
          }
        }
      }
    } else {
      // A first version must not silently duplicate or contradict a live series.
      const key = lineageKey(fact);
      const period = stable(fact.observedPeriod);
      for (const other of facts.values()) {
        if (successors.has(other.factId) || lineageKey(other) !== key || stable(other.observedPeriod) !== period) continue;
        if (stable(other.value) === stable(fact.value)) {
          issues.push(issue("invalid_fact_id", "factId", `duplicate_content: same series, period and value as ${other.factId}.`));
        } else if (fact.kind === "quantitative") {
          issues.push(issue("invalid_value", "value", `conflicting_values: ${other.factId} already states a different value for this series and period; register a replacement instead.`));
        }
      }
    }

    if (issues.length > 0) return Object.freeze({ ok: false, issues: Object.freeze(issues) });

    facts.set(fact.factId, fact);
    if (fact.supersedes !== null) successors.set(fact.supersedes, fact.factId);
    return Object.freeze({ ok: true, factId: fact.factId });
  }

  function matchesQuery(fact: LocalFact, query: FactQuery): boolean {
    return (
      fact.relevantTopics.includes(query.topic) &&
      fact.platform === query.platform &&
      fact.propertyType === query.propertyType &&
      sameScope(fact.scope, query.target)
    );
  }

  function getVersionChain(factId: FactId): readonly LocalFact[] | null {
    let current = facts.get(factId);
    if (current === undefined) return null;
    while (current.supersedes !== null) {
      const previous = facts.get(current.supersedes);
      if (previous === undefined) break;
      current = previous;
    }
    const chain: LocalFact[] = [current];
    for (let next = successors.get(current.factId); next !== undefined; next = successors.get(next)) {
      chain.push(facts.get(next)!);
    }
    return Object.freeze(chain);
  }

  /** Ids of the facts a given fact replaces, directly or not. */
  function ancestry(fact: LocalFact): Set<FactId> {
    const seen = new Set<FactId>();
    for (let current: LocalFact | undefined = fact; current !== undefined && current.supersedes !== null; ) {
      if (seen.has(current.supersedes)) break;
      seen.add(current.supersedes);
      current = facts.get(current.supersedes);
    }
    return seen;
  }

  /** Revoked facts of the same series with an overlapping period, outside the fact's own chain. */
  function revokedOverlaps(fact: LocalFact): FactId[] {
    if (fact.validation.status === "revoked") return [];
    const range = describedRange(fact);
    if (range === null) return []; // no time dimension (e.g. a qualitative note): only the chain rule applies
    const key = lineageKey(fact);
    const own = ancestry(fact);
    const found: FactId[] = [];
    for (const other of facts.values()) {
      if (other.factId === fact.factId || other.validation.status !== "revoked" || lineageKey(other) !== key) continue;
      if (own.has(other.factId) || ancestry(other).has(fact.factId)) continue;
      const otherRange = describedRange(other);
      if (otherRange !== null && range[0] < otherRange[1] && otherRange[0] < range[1]) found.push(other.factId);
    }
    return found.sort();
  }

  function unresolvedRevokedOverlaps(factId: FactId, asOf: string): readonly FactId[] {
    const fact = facts.get(factId);
    if (fact === undefined) return Object.freeze([]);
    const asOfMs = parseDateTime(asOf);
    const covered = new Set<FactId>();
    for (const entry of arbitrations) {
      if (entry.factId === factId && asOfMs !== null && entry.decidedAtMs <= asOfMs) entry.revokedFactIds.forEach((id) => covered.add(id));
    }
    return Object.freeze(revokedOverlaps(fact).filter((id) => !covered.has(id)));
  }

  function resolveTimeZone(scope: GeographicScope, asOf: string): string | null {
    const zones = new Set<string>();
    for (const candidate of facts.values()) {
      if (candidate.kind !== "geographic" || candidate.value.attribute !== "timezone") continue;
      if (candidate.platform !== null || candidate.propertyType !== null || !sameScope(candidate.scope, scope)) continue;
      const assessment = assessFactUse(candidate, {
        asOf,
        use: "internal",
        topic: null,
        superseded: successors.has(candidate.factId),
        timeZone: null,
        unresolvedRevokedOverlap: false,
      });
      if (assessment.usable && candidate.validation.status === "human_validated") zones.add(candidate.value.value);
    }
    return zones.size === 1 ? [...zones][0]! : null;
  }

  function recordArbitration(input: ArbitrationInput): ArbitrationResult {
    const refuse = (code: FactIssue["code"], path: string, message: string): ArbitrationResult => ({
      ok: false,
      issues: Object.freeze([issue(code, path, message)]),
    });
    const snapshot = snapshotUntrustedFact(input);
    if (!snapshot.ok) return { ok: false, issues: Object.freeze([...snapshot.issues]) };
    const record = snapshot.value;
    for (const key of Object.keys(record)) {
      if (!["factId", "revokedFactIds", "arbiter", "decidedAt", "note"].includes(key)) return refuse("unknown_key", "<unknown>", "Unknown key.");
    }
    const fact = typeof record.factId === "string" ? facts.get(record.factId as FactId) : undefined;
    if (fact === undefined) return refuse("arbitration_invalid", "factId", "The arbitrated fact is not registered.");
    const ids = record.revokedFactIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20 || !ids.every((id) => typeof id === "string")) {
      return refuse("arbitration_invalid", "revokedFactIds", "A non-empty list of revoked fact ids is required.");
    }
    if (typeof record.arbiter !== "string" || record.arbiter.trim() === "" || typeof record.note !== "string" || record.note.trim() === "") {
      return refuse("arbitration_invalid", "arbiter", "An arbiter and a note are required.");
    }
    const decidedAt = parseDateTime(record.decidedAt);
    if (decidedAt === null) return refuse("invalid_date", "decidedAt", "decidedAt is not a real date-time with a time zone.");
    const overlaps = new Set(revokedOverlaps(fact));
    for (const id of ids as FactId[]) {
      const revoked = facts.get(id);
      if (!overlaps.has(id) || revoked === undefined || revoked.validation.status !== "revoked") {
        return refuse("arbitration_invalid", "revokedFactIds", "Every id must be a revoked fact that this observation really overlaps.");
      }
      const revokedAt = parseDateTime(revoked.validation.revokedAt);
      if (revokedAt === null || decidedAt < revokedAt) return refuse("chronology", "decidedAt", "The arbitration cannot precede the revocation.");
    }
    const collectedAt = parseDateTime(fact.collectedAt);
    if (collectedAt !== null && decidedAt < collectedAt) return refuse("chronology", "decidedAt", "The arbitration cannot precede the observation.");
    arbitrations.push({ factId: fact.factId, revokedFactIds: Object.freeze([...(ids as FactId[])]), decidedAtMs: decidedAt });
    return { ok: true };
  }

  return Object.freeze({
    register,
    get: (factId) => facts.get(factId),
    list: () => Object.freeze(sorted()),
    size: () => facts.size,
    findFacts: (query) => Object.freeze(sorted().filter((fact) => matchesQuery(fact, query))),
    getVersionChain,
    isSuperseded: (factId) => successors.has(factId),
    getSuccessor: (factId) => {
      const next = successors.get(factId);
      return next === undefined ? undefined : facts.get(next);
    },
    assess: (factId, params) => {
      const fact = facts.get(factId);
      if (fact === undefined) return null;
      return assessFactUse(fact, {
        ...params,
        superseded: successors.has(factId),
        timeZone: fact.kind === "regulatory" ? resolveTimeZone(fact.scope, params.asOf) : null,
        unresolvedRevokedOverlap: unresolvedRevokedOverlaps(factId, params.asOf).length > 0,
      });
    },
    resolveTimeZone,
    unresolvedRevokedOverlaps,
    recordArbitration,
  });
}
