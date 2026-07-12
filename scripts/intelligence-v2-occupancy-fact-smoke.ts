import assert from "node:assert/strict";

import {
  buildAnonymousOccupancyFactIdentityProjection,
  deriveObservedDaysBand,
  deriveUnavailabilityRateBand,
  transformCandidateToAnonymousOccupancyFact,
  type AnonymousOccupancyFact,
  type AnonymousOccupancyFactCandidate,
  type AnonymousOccupancyFactTransformResult,
} from "../lib/intelligenceV2/occupancyFact";
import { validateSharedIntelligencePrivacy } from "../lib/intelligenceV2/privacyValidator";

function buildCandidate(
  overrides: Partial<AnonymousOccupancyFactCandidate> = {},
): AnonymousOccupancyFactCandidate {
  return {
    sourceClass: "authenticated_audit",
    capturedAt: "2026-07-12T12:00:00.000Z",

    platform: "booking",
    country: "Morocco",
    city: "Marrakech",
    propertyType: "apartment",
    capacity: 4,
    guestCapacity: 4,

    observedDays: 30,
    unavailableDays: 18,
    availableDays: 12,
    windowDays: 30,

    extractionQuality: "high",
    freshness: "fresh",

    ...overrides,
  };
}

function mustAccept(
  result: AnonymousOccupancyFactTransformResult,
): AnonymousOccupancyFact {
  if (!result.accepted) {
    throw new Error(
      `Expected accepted result, got ${result.reason}`,
    );
  }

  return result.fact;
}

function mustReject(
  result: AnonymousOccupancyFactTransformResult,
  reason: string,
): void {
  assert.equal(result.accepted, false);

  if (result.accepted) {
    throw new Error("Expected rejected result");
  }

  assert.equal(result.reason, reason);
}

assert.equal(deriveObservedDaysBand(1), "1_6");
assert.equal(deriveObservedDaysBand(6), "1_6");
assert.equal(deriveObservedDaysBand(7), "7_13");
assert.equal(deriveObservedDaysBand(13), "7_13");
assert.equal(deriveObservedDaysBand(14), "14_29");
assert.equal(deriveObservedDaysBand(29), "14_29");
assert.equal(deriveObservedDaysBand(30), "30_59");
assert.equal(deriveObservedDaysBand(59), "30_59");
assert.equal(deriveObservedDaysBand(60), "60_plus");

assert.equal(
  deriveUnavailabilityRateBand(0, 30),
  "0_19",
);
assert.equal(
  deriveUnavailabilityRateBand(6, 30),
  "20_39",
);
assert.equal(
  deriveUnavailabilityRateBand(12, 30),
  "40_59",
);
assert.equal(
  deriveUnavailabilityRateBand(18, 30),
  "60_79",
);
assert.equal(
  deriveUnavailabilityRateBand(24, 30),
  "80_100",
);

const authenticatedAuditFact = mustAccept(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate(),
  ),
);

assert.equal(
  authenticatedAuditFact.sourceClass,
  "authenticated_audit",
);
assert.equal(
  authenticatedAuditFact.metricFamily,
  "occupancy",
);
assert.equal(
  authenticatedAuditFact.observedDaysBand,
  "30_59",
);
assert.equal(
  authenticatedAuditFact.unavailabilityRateBand,
  "60_79",
);
assert.equal(
  authenticatedAuditFact.capturePeriodBucket,
  "2026-07",
);
assert.equal(
  authenticatedAuditFact.sourceQualityBand,
  "high",
);

const authenticatedListingFact = mustAccept(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      sourceClass: "authenticated_listing",
    }),
  ),
);

assert.equal(
  authenticatedListingFact.sourceClass,
  "authenticated_listing",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      sourceClass: "guest_audit",
    }),
  ),
  "guest_source_not_allowed",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      sourceClass: "historical_backfill",
    }),
  ),
  "historical_backfill_disabled",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      capturedAt: "invalid-date",
    }),
  ),
  "invalid_capture_date",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      observedDays: 0,
      unavailableDays: 0,
      availableDays: 0,
    }),
  ),
  "invalid_observed_days",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      unavailableDays: 31,
    }),
  ),
  "invalid_unavailable_days",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      availableDays: 31,
    }),
  ),
  "invalid_available_days",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      observedDays: 30,
      unavailableDays: 10,
      availableDays: 10,
    }),
  ),
  "inconsistent_day_counts",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      country: null,
    }),
  ),
  "missing_country",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      city: null,
    }),
  ),
  "missing_city",
);

mustReject(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      platform: "mystery",
    }),
  ),
  "unsupported_platform",
);

const unknownCapacity = mustAccept(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate({
      capacity: null,
      guestCapacity: null,
    }),
  ),
);

assert.equal(
  unknownCapacity.marketCell.capacityBand,
  "unknown",
);

const deterministicLeft = mustAccept(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate(),
  ),
);
const deterministicRight = mustAccept(
  transformCandidateToAnonymousOccupancyFact(
    buildCandidate(),
  ),
);

assert.deepEqual(
  deterministicLeft,
  deterministicRight,
);

assert.deepEqual(
  buildAnonymousOccupancyFactIdentityProjection(
    deterministicLeft,
  ),
  buildAnonymousOccupancyFactIdentityProjection(
    deterministicRight,
  ),
);

const privacyValidation =
  validateSharedIntelligencePrivacy(
    authenticatedAuditFact,
  );

assert.equal(privacyValidation.valid, true);
assert.deepEqual(privacyValidation.violations, []);

function collectKeys(
  value: unknown,
  keys = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nestedValue, keys);
    }
  }

  return keys;
}

const factKeys = collectKeys(authenticatedAuditFact);

for (const forbidden of [
  "sourceUrl",
  "source_url",
  "url",
  "title",
  "description",
  "workspaceId",
  "workspace_id",
  "listingId",
  "listing_id",
  "auditId",
  "audit_id",
  "userId",
  "user_id",
  "latitude",
  "longitude",
  "observedDays",
  "unavailableDays",
  "availableDays",
  "windowDays",
]) {
  assert.equal(
    factKeys.has(forbidden),
    false,
    `Occupancy fact leaks forbidden field: ${forbidden}`,
  );
}

assert.deepEqual(
  Object.keys(authenticatedAuditFact).sort(),
  [
    "capturePeriodBucket",
    "deduplicationPolicyVersion",
    "duplicateStatus",
    "eligibilityPolicyVersion",
    "eligibilityStatus",
    "factContractVersion",
    "marketCell",
    "marketCellPolicyVersion",
    "metricFamily",
    "observedDaysBand",
    "sourceClass",
    "sourceQualityBand",
    "transformationPolicyVersion",
    "unavailabilityRateBand",
  ].sort(),
);

console.log(
  "PASS — Intelligence v2 Occupancy Fact smoke",
);
