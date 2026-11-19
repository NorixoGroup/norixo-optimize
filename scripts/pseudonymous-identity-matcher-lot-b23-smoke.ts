import assert from "node:assert/strict";

import {
  analyzePseudonymousObservations,
  comparePseudonymousObservations,
  type PseudonymousObservationInput,
} from "../lib/intelligenceV2/pseudonymousIdentityMatcher";

function obs(
  observationId: string,
  tokens: readonly { keyVersion: string; value: string }[],
): PseudonymousObservationInput {
  return { observationId, tokens };
}

function main() {
  // 1. Two observations, same key, same (fictional) token -> MATCH.
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const b = obs("obs-b", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const result = comparePseudonymousObservations(a, b);
    assert.equal(result.outcome, "MATCH");
    assert.deepEqual(result.comparedKeyVersions, ["v1"]);

    const analysis = analyzePseudonymousObservations({ observations: [a, b] });
    assert.equal(analysis.rawObservationCount, 2);
    assert.equal(analysis.pseudonymousComponentCount, 1);
    assert.equal(analysis.unknownIndependenceObservationCount, 0);
    assert.equal(analysis.groups.length, 1);
    assert.deepEqual(analysis.groups[0].observationIds, ["obs-a", "obs-b"]);
  }

  // 2. Two observations, same key, different (fictional) tokens ->
  // DISTINCT_SIGNATURE, certain and decisive, never treated as "no info".
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const b = obs("obs-b", [{ keyVersion: "v1", value: "tok_fake_bbb" }]);
    const result = comparePseudonymousObservations(a, b);
    assert.equal(result.outcome, "DISTINCT_SIGNATURE");

    const analysis = analyzePseudonymousObservations({ observations: [a, b] });
    assert.equal(analysis.pseudonymousComponentCount, 2);
    assert.equal(analysis.distinctSignatureConflicts.length, 1);
    assert.equal(analysis.distinctSignatureConflicts[0].observationIdA, "obs-a");
    assert.equal(analysis.distinctSignatureConflicts[0].observationIdB, "obs-b");
  }

  // 3. Two observations, no common key at all -> INCOMPARABLE, but each
  // still counts as its own verified (singleton) component, not "unknown".
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const b = obs("obs-b", [{ keyVersion: "v2", value: "tok_fake_bbb" }]);
    const result = comparePseudonymousObservations(a, b);
    assert.equal(result.outcome, "INCOMPARABLE");

    const analysis = analyzePseudonymousObservations({ observations: [a, b] });
    assert.equal(analysis.pseudonymousComponentCount, 2);
    assert.equal(analysis.unknownIndependenceObservationCount, 0);
  }

  // 4. Transitive chain A-B-C: A/B share v1 (match), B/C share v2 (match),
  // A/C share nothing directly -> still one single group via closure.
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_x" }]);
    const b = obs("obs-b", [
      { keyVersion: "v1", value: "tok_fake_x" },
      { keyVersion: "v2", value: "tok_fake_y" },
    ]);
    const c = obs("obs-c", [{ keyVersion: "v2", value: "tok_fake_y" }]);

    assert.equal(comparePseudonymousObservations(a, c).outcome, "INCOMPARABLE");

    const analysis = analyzePseudonymousObservations({ observations: [a, b, c] });
    assert.equal(analysis.pseudonymousComponentCount, 1);
    assert.deepEqual(analysis.groups[0].observationIds, ["obs-a", "obs-b", "obs-c"]);
  }

  // 5. Isolated component: a comparable observation matching nobody is its
  // own verified singleton group, never folded into "unknown".
  {
    const lonely = obs("obs-lonely", [{ keyVersion: "v1", value: "tok_fake_only" }]);
    const analysis = analyzePseudonymousObservations({ observations: [lonely] });
    assert.equal(analysis.pseudonymousComponentCount, 1);
    assert.equal(analysis.unknownIndependenceObservationCount, 0);
    assert.equal(analysis.rawObservationCount, 1);
  }

  // 6a. Exact duplicate (same id, same tokens) submitted twice collapses to
  // one logical observation.
  {
    const a1 = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const a2 = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const analysis = analyzePseudonymousObservations({ observations: [a1, a2] });
    assert.equal(analysis.rawObservationCount, 1);
    assert.equal(analysis.pseudonymousComponentCount, 1);
  }

  // 6b. Order independence: shuffling the same input set yields identical
  // output (groups, counts, diagnostics).
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_x" }]);
    const b = obs("obs-b", [
      { keyVersion: "v1", value: "tok_fake_x" },
      { keyVersion: "v2", value: "tok_fake_y" },
    ]);
    const c = obs("obs-c", [{ keyVersion: "v2", value: "tok_fake_y" }]);
    const d = obs("obs-d", [{ keyVersion: "v3", value: "tok_fake_z" }]);

    const forward = analyzePseudonymousObservations({ observations: [a, b, c, d] });
    const shuffled = analyzePseudonymousObservations({ observations: [d, c, a, b] });
    assert.deepEqual(forward, shuffled);
  }

  // 7. Invalid data: missing/empty observationId is entirely excluded
  // (never exploitable); tokens absent/empty -> "no_tokens", counted as
  // unknown, never guessed into a group.
  {
    const noId = { observationId: "", tokens: [{ keyVersion: "v1", value: "x" }] };
    const noTokens = obs("obs-no-tokens", []);
    const malformedTokens = {
      observationId: "obs-malformed",
      tokens: "not-an-array" as unknown as readonly { keyVersion: string; value: string }[],
    };

    const analysis = analyzePseudonymousObservations({
      observations: [noId as PseudonymousObservationInput, noTokens, malformedTokens],
    });

    assert.equal(analysis.invalidInputCount, 1);
    assert.equal(analysis.rawObservationCount, 2);
    assert.equal(analysis.pseudonymousComponentCount, 0);
    assert.equal(analysis.unknownIndependenceObservationCount, 2);
    assert.deepEqual(
      analysis.excludedObservations.map((entry) => entry.status),
      ["no_tokens", "no_tokens"],
    );
  }

  // 8a. Self-conflicting observation (disagrees with itself on one key
  // version) is never partially trusted, even for keys it agrees on.
  {
    const selfConflicting = obs("obs-self-conflict", [
      { keyVersion: "v1", value: "tok_fake_a" },
      { keyVersion: "v1", value: "tok_fake_b" },
      { keyVersion: "v2", value: "tok_fake_shared" },
    ]);
    const other = obs("obs-other", [{ keyVersion: "v2", value: "tok_fake_shared" }]);

    const result = comparePseudonymousObservations(selfConflicting, other);
    assert.equal(result.outcome, "INCOMPARABLE");

    const analysis = analyzePseudonymousObservations({
      observations: [selfConflicting, other],
    });
    assert.equal(analysis.unknownIndependenceObservationCount, 1);
    assert.equal(analysis.pseudonymousComponentCount, 1);
    assert.deepEqual(
      analysis.excludedObservations.map((entry) => entry.observationId),
      ["obs-self-conflict"],
    );
  }

  // 8b. Conflicting evidence between two observations: they agree on one
  // shared key version but disagree on another -- disagreement is decisive
  // (DISTINCT_SIGNATURE), never diluted into MATCH by the agreeing key.
  {
    const a = obs("obs-a", [
      { keyVersion: "v1", value: "tok_fake_same" },
      { keyVersion: "v2", value: "tok_fake_a_only" },
    ]);
    const b = obs("obs-b", [
      { keyVersion: "v1", value: "tok_fake_same" },
      { keyVersion: "v2", value: "tok_fake_b_only" },
    ]);
    const result = comparePseudonymousObservations(a, b);
    assert.equal(result.outcome, "DISTINCT_SIGNATURE");
    assert.deepEqual(result.comparedKeyVersions, ["v1", "v2"]);
  }

  // 8c. Ambiguous duplicate id: same id, genuinely different token sets ->
  // every entry excluded from grouping, none collapsed or arbitrarily
  // picked, but each still counted in rawObservationCount.
  {
    const a1 = obs("obs-dup", [{ keyVersion: "v1", value: "tok_fake_aaa" }]);
    const a2 = obs("obs-dup", [{ keyVersion: "v1", value: "tok_fake_zzz" }]);
    const analysis = analyzePseudonymousObservations({ observations: [a1, a2] });
    assert.equal(analysis.rawObservationCount, 2);
    assert.equal(analysis.pseudonymousComponentCount, 0);
    assert.equal(analysis.unknownIndependenceObservationCount, 2);
    assert.ok(
      analysis.excludedObservations.every(
        (entry) => entry.status === "ambiguous_duplicate_id",
      ),
    );
  }

  // 8d. Regression (LOT B2.3 gate): A-B MATCH, B-C MATCH, but A-C
  // DISTINCT_SIGNATURE under a key they both happen to share. The
  // transitive closure of the two MATCH edges must NOT silently win over
  // the certain, direct proof that A and C are distinct -- none of A, B, C
  // may be reported as one confident group.
  {
    const a = obs("obs-a", [
      { keyVersion: "v1", value: "tok_fake_shared_ab" },
      { keyVersion: "v2", value: "tok_fake_a_only" },
    ]);
    const b = obs("obs-b", [
      { keyVersion: "v1", value: "tok_fake_shared_ab" },
      { keyVersion: "v3", value: "tok_fake_shared_bc" },
    ]);
    const c = obs("obs-c", [
      { keyVersion: "v2", value: "tok_fake_c_only" },
      { keyVersion: "v3", value: "tok_fake_shared_bc" },
    ]);

    assert.equal(comparePseudonymousObservations(a, b).outcome, "MATCH");
    assert.equal(comparePseudonymousObservations(b, c).outcome, "MATCH");
    assert.equal(comparePseudonymousObservations(a, c).outcome, "DISTINCT_SIGNATURE");

    const analysis = analyzePseudonymousObservations({ observations: [a, b, c] });

    // The old (buggy) behaviour would have produced exactly one group of
    // size 3 here. It must not.
    assert.notEqual(analysis.pseudonymousComponentCount, 1);
    assert.equal(
      analysis.groups.some((group) => group.observationIds.length === 3),
      false,
    );
    assert.equal(analysis.pseudonymousComponentCount, 0);
    assert.equal(analysis.unknownIndependenceObservationCount, 3);
    assert.ok(
      analysis.excludedObservations.every(
        (entry) => entry.status === "contradictory_evidence",
      ),
    );
    assert.deepEqual(
      analysis.excludedObservations.map((entry) => entry.observationId),
      ["obs-a", "obs-b", "obs-c"],
    );
  }

  // 9. Determinism: identical input analyzed twice yields byte-identical
  // (deep-equal) results; repeated pairwise comparisons are stable.
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_x" }]);
    const b = obs("obs-b", [{ keyVersion: "v1", value: "tok_fake_x" }]);
    const first = analyzePseudonymousObservations({ observations: [a, b] });
    const second = analyzePseudonymousObservations({ observations: [a, b] });
    assert.deepEqual(first, second);

    for (let i = 0; i < 20; i += 1) {
      assert.equal(comparePseudonymousObservations(a, b).outcome, "MATCH");
    }
  }

  // effectiveSampleSizeNeff: pass-through only, never recomputed, never
  // equated to pseudonymousComponentCount.
  {
    const a = obs("obs-a", [{ keyVersion: "v1", value: "tok_fake_x" }]);
    const b = obs("obs-b", [{ keyVersion: "v1", value: "tok_fake_x" }]);
    const c = obs("obs-c", [{ keyVersion: "v1", value: "tok_fake_x" }]);

    const withNeff = analyzePseudonymousObservations({
      observations: [a, b, c],
      effectiveSampleSizeNeff: 2.4,
    });
    assert.equal(withNeff.effectiveSampleSizeNeff, 2.4);
    assert.equal(withNeff.pseudonymousComponentCount, 1);
    assert.notEqual(withNeff.effectiveSampleSizeNeff, withNeff.pseudonymousComponentCount);

    const withInvalidNeff = analyzePseudonymousObservations({
      observations: [a, b],
      effectiveSampleSizeNeff: Number.NaN,
    });
    assert.equal(withInvalidNeff.effectiveSampleSizeNeff, null);

    const withoutNeff = analyzePseudonymousObservations({ observations: [a, b] });
    assert.equal(withoutNeff.effectiveSampleSizeNeff, null);
  }

  // Empty input.
  {
    const analysis = analyzePseudonymousObservations({ observations: [] });
    assert.equal(analysis.rawObservationCount, 0);
    assert.equal(analysis.pseudonymousComponentCount, 0);
    assert.equal(analysis.unknownIndependenceObservationCount, 0);
    assert.equal(analysis.invalidInputCount, 0);
  }

  console.log("PASS -- pseudonymous identity matcher (Lot B2.3)");
}

main();
