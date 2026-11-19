import assert from "node:assert/strict";

import {
  HYBRID_IDENTITY_LINK_SCOPE_DAYS,
  HYBRID_IDENTITY_ROTATION_DAYS,
  canCompareOrUnionWithinHybridIdentityScope,
  epochBelongsToHybridIdentityLinkScope,
  getHybridIdentityLinkScope,
  getHybridIdentityRotationEpoch,
  validateHybridIdentityCalendarConfig,
} from "../lib/intelligenceV2/hybridIdentityCalendar";

const config = Object.freeze({
  originUtc: "2026-01-01T00:00:00.000Z",
  rotationDays: HYBRID_IDENTITY_ROTATION_DAYS,
  linkScopeDays: HYBRID_IDENTITY_LINK_SCOPE_DAYS,
});

function epoch(instantUtc: string) {
  const result = getHybridIdentityRotationEpoch(config, instantUtc);
  assert.ok(result, `expected epoch for ${instantUtc}`);
  return result;
}

function scope(instantUtc: string) {
  const result = getHybridIdentityLinkScope(config, instantUtc);
  assert.ok(result, `expected scope for ${instantUtc}`);
  return result;
}

function main() {
  // 1. Beginning of the first epoch belongs to epoch and scope zero.
  {
    const value = epoch("2026-01-01T00:00:00.000Z");
    assert.equal(value.epochIndex, 0);
    assert.equal(value.startsAt, "2026-01-01T00:00:00.000Z");
    assert.equal(value.endsAt, "2026-04-01T00:00:00.000Z");
    assert.equal(value.linkScopeIndex, 0);
  }

  // 2. Just before the half-open epoch boundary remains in epoch zero.
  {
    const value = epoch("2026-03-31T23:59:59.999Z");
    assert.equal(value.epochIndex, 0);
  }

  // 3. Exactly at 90 days starts epoch one, still in scope zero.
  {
    const value = epoch("2026-04-01T00:00:00.000Z");
    assert.equal(value.epochIndex, 1);
    assert.equal(value.linkScopeIndex, 0);
  }

  // 4. Exactly at 180 days starts the next scope and its first epoch.
  {
    const boundaryEpoch = epoch("2026-06-30T00:00:00.000Z");
    const boundaryScope = scope("2026-06-30T00:00:00.000Z");
    assert.equal(boundaryEpoch.epochIndex, 2);
    assert.equal(boundaryScope.linkScopeIndex, 1);
    assert.equal(boundaryScope.startsAt, "2026-06-30T00:00:00.000Z");
  }

  // 5. Both epochs in a block belong to the same and only that block.
  {
    const first = epoch("2026-01-15T00:00:00.000Z");
    const second = epoch("2026-04-15T00:00:00.000Z");
    const firstScope = scope("2026-01-15T00:00:00.000Z");
    const secondScope = scope("2026-04-15T00:00:00.000Z");
    assert.equal(first.linkScopeId, second.linkScopeId);
    assert.ok(epochBelongsToHybridIdentityLinkScope(first, firstScope));
    assert.ok(epochBelongsToHybridIdentityLinkScope(second, secondScope));
  }

  // 6. Comparison/union across distinct scopes is always refused.
  {
    const firstScope = scope("2026-01-15T00:00:00.000Z");
    const secondScope = scope("2026-06-30T00:00:00.000Z");
    assert.ok(canCompareOrUnionWithinHybridIdentityScope(firstScope, firstScope));
    assert.equal(canCompareOrUnionWithinHybridIdentityScope(firstScope, secondScope), false);
    assert.equal(canCompareOrUnionWithinHybridIdentityScope(firstScope, null), false);
  }

  // 7. Fail closed for invalid dates, missing timezone, and incoherent config.
  {
    assert.equal(getHybridIdentityRotationEpoch(config, "2026-01-01"), null);
    assert.equal(getHybridIdentityRotationEpoch(config, "2026-01-01T00:00:00.000"), null);
    assert.equal(getHybridIdentityRotationEpoch(config, "not-a-date"), null);
    assert.equal(
      validateHybridIdentityCalendarConfig({ ...config, rotationDays: 91 }).ok,
      false,
    );
    assert.equal(
      validateHybridIdentityCalendarConfig({ ...config, linkScopeDays: 181 }).ok,
      false,
    );
  }

  // 8. H1.0 has no negative historical epoch: pre-origin input is refused.
  {
    assert.equal(getHybridIdentityRotationEpoch(config, "2025-12-31T23:59:59.999Z"), null);
    assert.equal(getHybridIdentityLinkScope(config, "2025-12-31T23:59:59.999Z"), null);
  }

  // 9. Determinism / replay invariance. No implicit clock is involved.
  {
    const instant = "2026-08-15T12:34:56.789Z";
    assert.deepEqual(getHybridIdentityRotationEpoch(config, instant), getHybridIdentityRotationEpoch(config, instant));
    assert.deepEqual(getHybridIdentityLinkScope(config, instant), getHybridIdentityLinkScope(config, instant));
  }

  // 10. The module is pure: supplied objects are neither changed nor enriched.
  {
    const input = { ...config };
    const before = JSON.stringify(input);
    void getHybridIdentityRotationEpoch(input, "2026-01-01T00:00:00.000Z");
    assert.equal(JSON.stringify(input), before);
  }

  console.log("PASS -- hybrid identity calendar (Lot H1.0)");
}

main();
