// Lot B2.3 (NORIXO 24-month benchmark project): a pure, local comparison and
// grouping engine over FICTIONAL, caller-supplied pseudonymized tokens.
//
// This module does NOT implement the real key-rotation, HMAC construction,
// or anonymization mechanisms designed in the LOT B2 / B2.1 / B2.2 reports.
// It only implements the comparison/grouping LOGIC those reports specify
// (MATCH / DISTINCT_SIGNATURE / INCOMPARABLE, transitive grouping, the four
// statistical counters), operating purely on whatever opaque
// { keyVersion, value } token strings the caller provides. No real listing
// identifiers, secrets, or HMAC computation occur here.
//
// Deliberately isolated: no imports from, and no importers in, Lot A
// (publicMarketOverviewAdaptiveWindow.ts), Lot B1 (weightedPercentile.ts),
// or any active pipeline module. No Supabase, no network, no clock, no I/O.
//
// IMPORTANT, reiterated at the exported field itself:
// `pseudonymousComponentCount` is a count of connected components formed
// from the token values the caller happened to supply. It is NEVER a
// guaranteed count of independent real-world listings over 365 or 730
// days -- that guarantee depends entirely on the caller's own key-rotation
// design (cadence, retained-key count, retention window), which this module
// has no knowledge of and does not validate.

export type PseudonymousTokenEntry = Readonly<{
  keyVersion: string;
  value: string;
}>;

export type PseudonymousObservationInput = Readonly<{
  observationId: string;
  tokens: readonly PseudonymousTokenEntry[];
}>;

export type PseudonymousComparisonOutcome =
  | "MATCH"
  | "DISTINCT_SIGNATURE"
  | "INCOMPARABLE";

export type PseudonymousComparisonResult = Readonly<{
  outcome: PseudonymousComparisonOutcome;
  comparedKeyVersions: readonly string[];
}>;

export type PseudonymousObservationStatus =
  | "comparable"
  | "no_tokens"
  | "self_conflicting"
  | "ambiguous_duplicate_id"
  | "contradictory_evidence";

export type PseudonymousIdentityGroup = Readonly<{
  groupId: string;
  observationIds: readonly string[];
}>;

export type PseudonymousDistinctSignatureConflict = Readonly<{
  observationIdA: string;
  observationIdB: string;
  comparedKeyVersions: readonly string[];
}>;

export type PseudonymousExcludedObservation = Readonly<{
  observationId: string;
  status: Exclude<PseudonymousObservationStatus, "comparable">;
}>;

export type PseudonymousIdentityAnalysisInput = Readonly<{
  observations: readonly PseudonymousObservationInput[];
  /**
   * Pass-through only. Must come from an already-computed Lot B1
   * `computeEffectiveSampleSize` result -- this module never recomputes it
   * and never treats it as equivalent to `pseudonymousComponentCount`.
   */
  effectiveSampleSizeNeff?: number | null;
}>;

export type PseudonymousIdentityAnalysisResult = Readonly<{
  rawObservationCount: number;
  /**
   * Number of connected components formed by positive MATCH edges among
   * comparable observations (singletons included). NOT a guaranteed count
   * of independent real-world listings over any horizon -- see module
   * header comment.
   */
  pseudonymousComponentCount: number;
  unknownIndependenceObservationCount: number;
  effectiveSampleSizeNeff: number | null;
  groups: readonly PseudonymousIdentityGroup[];
  distinctSignatureConflicts: readonly PseudonymousDistinctSignatureConflict[];
  excludedObservations: readonly PseudonymousExcludedObservation[];
  invalidInputCount: number;
}>;

function normalizeToken(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUsableTokenEntry(entry: PseudonymousTokenEntry | null | undefined): boolean {
  if (entry == null || typeof entry !== "object") return false;
  return (
    normalizeToken(entry.keyVersion) != null && normalizeToken(entry.value) != null
  );
}

/**
 * Builds keyVersion -> value for one observation's own token list.
 * Returns null if the observation disagrees with itself (the same
 * keyVersion appears more than once with a different value) -- a
 * self-conflicting observation is never partially trusted, not even for
 * the keys it agrees with itself on.
 */
function buildTokenMap(
  tokens: readonly PseudonymousTokenEntry[] | null | undefined,
): ReadonlyMap<string, string> | null {
  if (!Array.isArray(tokens)) return new Map();

  const map = new Map<string, string>();
  for (const entry of tokens) {
    if (!isUsableTokenEntry(entry)) continue;
    const keyVersion = normalizeToken(entry.keyVersion) as string;
    const value = normalizeToken(entry.value) as string;
    const existing = map.get(keyVersion);
    if (existing != null && existing !== value) {
      return null;
    }
    map.set(keyVersion, value);
  }
  return map;
}

/**
 * Compares two already-built token maps. A single disagreement on any
 * shared key version is decisive proof of distinct signatures (a
 * deterministic function cannot produce different outputs from the same
 * input), and takes precedence over agreement found on any other shared
 * key version -- the latter is recorded only via the richer
 * `comparedKeyVersions` list for diagnostic purposes, never silently
 * dropped.
 */
export function comparePseudonymousTokenMaps(
  a: ReadonlyMap<string, string>,
  b: ReadonlyMap<string, string>,
): PseudonymousComparisonResult {
  const comparedKeyVersions: string[] = [];
  let sawDisagreement = false;

  for (const [keyVersion, valueA] of a) {
    const valueB = b.get(keyVersion);
    if (valueB === undefined) continue;
    comparedKeyVersions.push(keyVersion);
    if (valueA !== valueB) {
      sawDisagreement = true;
    }
  }

  if (comparedKeyVersions.length === 0) {
    return Object.freeze({
      outcome: "INCOMPARABLE",
      comparedKeyVersions: Object.freeze([]),
    });
  }

  comparedKeyVersions.sort();

  return Object.freeze({
    outcome: sawDisagreement ? "DISTINCT_SIGNATURE" : "MATCH",
    comparedKeyVersions: Object.freeze(comparedKeyVersions),
  });
}

/**
 * Compares two raw observations directly. Either side being
 * self-conflicting (disagrees with itself across its own tokens) makes the
 * pair INCOMPARABLE -- a self-contradictory token set is never trusted
 * enough to assert a match or a distinction against anything.
 */
export function comparePseudonymousObservations(
  a: PseudonymousObservationInput,
  b: PseudonymousObservationInput,
): PseudonymousComparisonResult {
  const mapA = buildTokenMap(a?.tokens);
  const mapB = buildTokenMap(b?.tokens);
  if (mapA == null || mapB == null) {
    return Object.freeze({
      outcome: "INCOMPARABLE",
      comparedKeyVersions: Object.freeze([]),
    });
  }
  return comparePseudonymousTokenMaps(mapA, mapB);
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
    }
  }

  find(id: string): string {
    let root = id;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root) as string;
    }
    let current = id;
    while (this.parent.get(current) !== root) {
      const next = this.parent.get(current) as string;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    // Deterministic tie-break so the resulting root does not depend on
    // insertion/union order.
    if (rootA < rootB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootA, rootB);
    }
  }
}

function isValidEffectiveSampleSize(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function analyzePseudonymousObservations(
  input: PseudonymousIdentityAnalysisInput,
): PseudonymousIdentityAnalysisResult {
  const rawInputs = Array.isArray(input?.observations) ? input.observations : [];

  let invalidInputCount = 0;
  const byId = new Map<string, PseudonymousObservationInput[]>();
  const firstSeenOrder: string[] = [];

  for (const observation of rawInputs) {
    const observationId = normalizeToken(observation?.observationId);
    if (observationId == null) {
      invalidInputCount += 1;
      continue;
    }
    const bucket = byId.get(observationId);
    if (bucket == null) {
      byId.set(observationId, [observation]);
      firstSeenOrder.push(observationId);
    } else {
      bucket.push(observation);
    }
  }

  // Resolve per-id duplicates: byte-identical token sets collapse into one
  // logical observation (redundant resubmission of the same evidence,
  // mirroring the real pipeline's own exact-duplicate dedup). Differing
  // token sets under the same id are never collapsed and never arbitrarily
  // picked between -- every such entry is kept as its own raw observation
  // but excluded from grouping as "ambiguous_duplicate_id".
  type Resolved = Readonly<{
    observationId: string;
    tokens: readonly PseudonymousTokenEntry[];
    status: PseudonymousObservationStatus;
  }>;

  const resolved: Resolved[] = [];

  for (const observationId of firstSeenOrder) {
    const entries = byId.get(observationId) as PseudonymousObservationInput[];
    const maps = entries.map((entry) => buildTokenMap(entry.tokens));

    const distinctSignatures = new Set<string>();
    for (const map of maps) {
      if (map == null) {
        distinctSignatures.add(`__self_conflicting__:${distinctSignatures.size}`);
        continue;
      }
      const canonical = [...map.entries()]
        .sort(([ka], [kb]) => (ka < kb ? -1 : ka > kb ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      distinctSignatures.add(canonical);
    }

    if (entries.length === 1 || distinctSignatures.size === 1) {
      // Either a single submission, or every duplicate agrees byte-for-byte
      // -- collapse to one logical observation.
      const tokens = entries[0].tokens;
      const map = maps[0];
      resolved.push({
        observationId,
        tokens,
        status:
          map == null
            ? "self_conflicting"
            : map.size === 0
              ? "no_tokens"
              : "comparable",
      });
    } else {
      for (const entry of entries) {
        resolved.push({
          observationId,
          tokens: entry.tokens,
          status: "ambiguous_duplicate_id",
        });
      }
    }
  }

  const rawObservationCount = resolved.length;

  const comparableMaps = new Map<string, ReadonlyMap<string, string>>();
  for (const entry of resolved) {
    if (entry.status !== "comparable") continue;
    // Safe: "comparable" status was only assigned when buildTokenMap
    // succeeded and was non-empty.
    comparableMaps.set(entry.observationId, buildTokenMap(entry.tokens) as ReadonlyMap<string, string>);
  }

  const comparableIds = [...comparableMaps.keys()].sort();
  const unionFind = new UnionFind();
  for (const id of comparableIds) {
    unionFind.add(id);
  }

  const distinctSignatureConflicts: PseudonymousDistinctSignatureConflict[] = [];

  for (let i = 0; i < comparableIds.length; i += 1) {
    for (let j = i + 1; j < comparableIds.length; j += 1) {
      const idA = comparableIds[i];
      const idB = comparableIds[j];
      const result = comparePseudonymousTokenMaps(
        comparableMaps.get(idA) as ReadonlyMap<string, string>,
        comparableMaps.get(idB) as ReadonlyMap<string, string>,
      );
      if (result.outcome === "MATCH") {
        unionFind.union(idA, idB);
      } else if (result.outcome === "DISTINCT_SIGNATURE") {
        distinctSignatureConflicts.push(
          Object.freeze({
            observationIdA: idA,
            observationIdB: idB,
            comparedKeyVersions: result.comparedKeyVersions,
          }),
        );
      }
    }
  }

  // A MATCH edge is transitive evidence (A-B and B-C matching implies A, B,
  // C share one signature), but a DISTINCT_SIGNATURE edge is certain,
  // decisive proof against that for its own pair. If the two kinds of
  // evidence land in the same connected component (e.g. A-B MATCH, B-C
  // MATCH, but A-C DISTINCT_SIGNATURE under a key they both happen to
  // share), the component is internally contradictory: the transitive
  // closure cannot be trusted for any observation in it, and none of them
  // may be silently reported as one confident group, nor assumed proven
  // distinct from each other either -- they are quarantined as
  // "contradictory_evidence" instead, never folded into a group.
  const taintedRoots = new Set<string>();
  for (const conflict of distinctSignatureConflicts) {
    if (unionFind.find(conflict.observationIdA) === unionFind.find(conflict.observationIdB)) {
      taintedRoots.add(unionFind.find(conflict.observationIdA));
    }
  }

  const groupedByRoot = new Map<string, string[]>();
  const contradictoryIds: string[] = [];
  for (const id of comparableIds) {
    const root = unionFind.find(id);
    if (taintedRoots.has(root)) {
      contradictoryIds.push(id);
      continue;
    }
    const bucket = groupedByRoot.get(root);
    if (bucket == null) {
      groupedByRoot.set(root, [id]);
    } else {
      bucket.push(id);
    }
  }

  const sortedGroups = [...groupedByRoot.values()]
    .map((ids) => [...ids].sort())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const groups: PseudonymousIdentityGroup[] = sortedGroups.map((ids, index) =>
    Object.freeze({
      groupId: `group_${index + 1}`,
      observationIds: Object.freeze(ids),
    }),
  );

  const excludedObservations: PseudonymousExcludedObservation[] = resolved
    .filter((entry) => entry.status !== "comparable")
    .map((entry) =>
      Object.freeze({
        observationId: entry.observationId,
        status: entry.status as Exclude<PseudonymousObservationStatus, "comparable">,
      }),
    )
    .concat(
      contradictoryIds.map((observationId) =>
        Object.freeze({
          observationId,
          status: "contradictory_evidence" as const,
        }),
      ),
    )
    .sort((a, b) =>
      a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0,
    );

  const unknownIndependenceObservationCount = excludedObservations.length;

  return Object.freeze({
    rawObservationCount,
    pseudonymousComponentCount: groups.length,
    unknownIndependenceObservationCount,
    effectiveSampleSizeNeff: isValidEffectiveSampleSize(input.effectiveSampleSizeNeff)
      ? input.effectiveSampleSizeNeff
      : null,
    groups: Object.freeze(groups),
    distinctSignatureConflicts: Object.freeze(distinctSignatureConflicts),
    excludedObservations: Object.freeze(excludedObservations),
    invalidInputCount,
  });
}
