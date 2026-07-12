import assert from "node:assert/strict";

import {
  buildOccupancyBenchmarkPreview,
} from "../lib/intelligenceV2/occupancyBenchmarkPreview";
import {
  transformCandidateToAnonymousOccupancyFact,
  type AnonymousOccupancyFact,
} from "../lib/intelligenceV2/occupancyFact";

function buildFact(
  index: number,
): AnonymousOccupancyFact {
  const transformed =
    transformCandidateToAnonymousOccupancyFact({
      sourceClass:
        index % 2 === 0
          ? "authenticated_audit"
          : "authenticated_listing",
      capturedAt:
        "2026-07-12T12:00:00.000Z",
      platform: "booking",
      country: "Morocco",
      city: "Marrakech",
      propertyType: "apartment",
      capacity: 4,
      guestCapacity: 4,
      observedDays: 30,
      unavailableDays:
        index % 3 === 0 ? 18 : 12,
      availableDays:
        index % 3 === 0 ? 12 : 18,
      windowDays: 30,
      extractionQuality: "high",
      freshness: "fresh",
    });

  if (!transformed.accepted) {
    throw new Error(
      `Fact transformation failed: ${transformed.reason}`,
    );
  }

  return transformed.fact;
}

const facts = Array.from(
  { length: 40 },
  (_, index) => buildFact(index),
);

const marketCellKey =
  facts[0]?.marketCell.marketCellKey;

assert.ok(marketCellKey);

const result =
  buildOccupancyBenchmarkPreview({
    marketCellKey,
    capturePeriodBucket: "2026-07",
    facts,
  });

if (!result.ok) {
  throw new Error(
    `Preview failed: ${result.reasonCodes.join(",")}`,
  );
}

assert.equal(result.ok, true);

assert.equal(
  result.artifact.benchmarkType,
  "occupancy_distribution",
);
assert.equal(
  result.artifact.rawSampleSize,
  40,
);
assert.equal(
  result.artifact.includedSampleSize,
  40,
);
assert.equal(
  result.artifact.sourceClassCount,
  2,
);
assert.equal(
  result.artifact.confidenceLevel,
  "very_high",
);
assert.equal(
  result.artifact.approvalStatus,
  "audit_approved",
);
assert.equal(
  result.artifact.approvedForInternal,
  true,
);
assert.equal(
  result.artifact.approvedForAudit,
  true,
);
assert.equal(
  result.artifact.currency,
  "UNKNOWN",
);
assert.equal(
  result.artifact.distribution
    .observedDaysCounts["30_59"],
  40,
);

const deterministic =
  buildOccupancyBenchmarkPreview({
    marketCellKey,
    capturePeriodBucket: "2026-07",
    facts,
  });

assert.deepEqual(result, deterministic);

const empty =
  buildOccupancyBenchmarkPreview({
    marketCellKey,
    capturePeriodBucket: "2026-07",
    facts: [],
  });

assert.equal(empty.ok, false);

if (!empty.ok) {
  assert.ok(
    empty.reasonCodes.includes(
      "no_facts_found",
    ),
  );
}

const mismatch =
  buildOccupancyBenchmarkPreview({
    marketCellKey:
      "v1|morocco|casablanca|booking|apartment|4_6|unknown",
    capturePeriodBucket: "2026-07",
    facts,
  });

assert.equal(mismatch.ok, false);

if (!mismatch.ok) {
  assert.ok(
    mismatch.reasonCodes.includes(
      "market_cell_mismatch",
    ),
  );
}

const serialized =
  JSON.stringify(result);

for (const forbidden of [
  "normalizedNightlyPrice",
  "p10Price",
  "p25Price",
  "medianPrice",
  "p75Price",
  "p90Price",
  "privateOccupancySignature",
  "workspaceId",
  "listingId",
  "auditId",
  "userId",
  "sourceUrl",
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `Preview leaks forbidden field: ${forbidden}`,
  );
}

console.log(
  "PASS — Intelligence v2 Occupancy Benchmark Preview smoke",
);
