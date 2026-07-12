import assert from "node:assert/strict";

import {
  ENABLE_INTELLIGENCE_FACT_CONTRIBUTION,
  ENABLE_INTELLIGENCE_FACT_TRANSFORMATION,
} from "../lib/intelligenceV2/featureFlags";
import {
  buildOpaqueOccupancyFactKey,
} from "../lib/intelligenceV2/occupancyFactIdentity";
import {
  INTELLIGENCE_FACT_IDENTITY_SECRET,
} from "../lib/intelligenceV2/opaqueFactIdentity";
import {
  writeAnonymousOccupancyFacts,
  type AnonymousOccupancyFactGroupInsertRow,
  type PrivateOccupancyObservation,
  type WriteAnonymousOccupancyFactsInput,
} from "../lib/intelligenceV2/occupancyFactWriter";

function buildObservation(
  overrides: Partial<PrivateOccupancyObservation> = {},
): PrivateOccupancyObservation {
  return {
    privateOccupancySignature:
      "occupancy|booking|private-001",
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
    sourceKind: "live_observation",

    ...overrides,
  };
}

function buildInput(
  overrides: Partial<WriteAnonymousOccupancyFactsInput> = {},
): WriteAnonymousOccupancyFactsInput {
  return {
    sourceClass: "authenticated_audit",
    collectionMode: "live",
    observations: [buildObservation()],
    ...overrides,
  };
}

function buildEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    [ENABLE_INTELLIGENCE_FACT_TRANSFORMATION]:
      "true",
    [ENABLE_INTELLIGENCE_FACT_CONTRIBUTION]:
      "true",
    [INTELLIGENCE_FACT_IDENTITY_SECRET]:
      "occupancy-secret-v1",
    ...overrides,
  };
}

function captureStore() {
  const batches:
    ReadonlyArray<AnonymousOccupancyFactGroupInsertRow>[] =
      [];

  return {
    batches,
    upsertFacts: async (
      rows: ReadonlyArray<AnonymousOccupancyFactGroupInsertRow>,
    ): Promise<{ ok: true }> => {
      batches.push(rows);
      return { ok: true };
    },
  };
}

async function main(): Promise<void> {
const disabled = await writeAnonymousOccupancyFacts(
  buildInput(),
  {
    env: buildEnv({
      [ENABLE_INTELLIGENCE_FACT_TRANSFORMATION]:
        "false",
    }),
  },
);

assert.equal(disabled.status, "disabled");
assert.equal(disabled.submitted, 0);
assert.ok(
  disabled.reasonCodes.includes(
    "transformation_disabled",
  ),
);

const transformedOnly =
  await writeAnonymousOccupancyFacts(
    buildInput(),
    {
      env: buildEnv({
        [ENABLE_INTELLIGENCE_FACT_CONTRIBUTION]:
          "false",
      }),
    },
  );

assert.equal(
  transformedOnly.status,
  "transformed_only",
);
assert.equal(transformedOnly.accepted, 1);
assert.equal(transformedOnly.submitted, 0);
assert.ok(
  transformedOnly.reasonCodes.includes(
    "contribution_disabled",
  ),
);

const missingSecret =
  await writeAnonymousOccupancyFacts(
    buildInput(),
    {
      env: buildEnv({
        [INTELLIGENCE_FACT_IDENTITY_SECRET]:
          undefined,
      }),
    },
  );

assert.equal(missingSecret.status, "failed");
assert.ok(
  missingSecret.reasonCodes.includes(
    "missing_identity_secret",
  ),
);

const store = captureStore();
const success =
  await writeAnonymousOccupancyFacts(
    buildInput(),
    {
      env: buildEnv(),
      upsertFacts: store.upsertFacts,
    },
  );

assert.equal(success.status, "success");
assert.equal(success.received, 1);
assert.equal(success.accepted, 1);
assert.equal(success.rejected, 0);
assert.equal(success.submitted, 1);
assert.equal(store.batches.length, 1);
assert.equal(store.batches[0]?.length, 1);

const row = store.batches[0]?.[0];
assert.ok(row);

assert.equal(row.metric_family, "occupancy");
assert.equal(row.currency, "UNKNOWN");
assert.equal(row.normalized_nightly_price, null);
assert.equal(row.price_band, null);
assert.equal(
  row.pricing_normalization_policy_version,
  null,
);
assert.equal(row.observed_days_band, "30_59");
assert.equal(
  row.unavailability_rate_band,
  "60_79",
);
assert.equal(
  row.source_class,
  "authenticated_audit",
);

const missingSignature =
  await writeAnonymousOccupancyFacts(
    buildInput({
      observations: [
        buildObservation({
          privateOccupancySignature: null,
        }),
      ],
    }),
    {
      env: buildEnv(),
    },
  );

assert.equal(missingSignature.status, "skipped");
assert.equal(missingSignature.rejected, 1);
assert.ok(
  missingSignature.reasonCodes.includes(
    "missing_private_signature",
  ),
);

const memoryReuse =
  await writeAnonymousOccupancyFacts(
    buildInput({
      collectionMode: "memory_reuse",
    }),
    {
      env: buildEnv(),
    },
  );

assert.equal(memoryReuse.status, "skipped");
assert.ok(
  memoryReuse.reasonCodes.includes(
    "memory_reuse_skipped",
  ),
);

const memorySeed =
  await writeAnonymousOccupancyFacts(
    buildInput({
      observations: [
        buildObservation({
          sourceKind: "memory_seed",
        }),
      ],
    }),
    {
      env: buildEnv(),
    },
  );

assert.equal(memorySeed.status, "skipped");
assert.equal(memorySeed.rejected, 1);
assert.ok(
  memorySeed.reasonCodes.includes(
    "invalid_candidate",
  ),
);

const invalidCounts =
  await writeAnonymousOccupancyFacts(
    buildInput({
      observations: [
        buildObservation({
          observedDays: 30,
          unavailableDays: 10,
          availableDays: 10,
        }),
      ],
    }),
    {
      env: buildEnv(),
    },
  );

assert.equal(invalidCounts.status, "skipped");
assert.equal(invalidCounts.rejected, 1);
assert.ok(
  invalidCounts.reasonCodes.includes(
    "invalid_candidate",
  ),
);

const duplicateStore = captureStore();
const duplicate =
  buildObservation();

const duplicateResult =
  await writeAnonymousOccupancyFacts(
    buildInput({
      observations: [duplicate, duplicate],
    }),
    {
      env: buildEnv(),
      upsertFacts: duplicateStore.upsertFacts,
    },
  );

assert.equal(duplicateResult.status, "success");
assert.equal(
  duplicateResult.deduplicatedInBatch,
  1,
);
assert.equal(duplicateResult.submitted, 1);
assert.ok(
  duplicateResult.reasonCodes.includes(
    "duplicate_in_batch",
  ),
);

const differentBandsStore = captureStore();

const differentBands =
  await writeAnonymousOccupancyFacts(
    buildInput({
      observations: [
        buildObservation(),
        buildObservation({
          unavailableDays: 6,
          availableDays: 24,
        }),
      ],
    }),
    {
      env: buildEnv(),
      upsertFacts:
        differentBandsStore.upsertFacts,
    },
  );

assert.equal(differentBands.status, "success");
assert.equal(differentBands.submitted, 2);

const rows =
  differentBandsStore.batches[0] ?? [];

assert.equal(rows.length, 2);
assert.notEqual(
  rows[0]?.fact_key,
  rows[1]?.fact_key,
);

const identityLeft =
  buildOpaqueOccupancyFactKey(
    {
      privateOccupancySignature:
        "occupancy|booking|private-001",
      marketCellKey:
        "v1|morocco|marrakech|booking|apartment|4_6|unknown",
      capturePeriodBucket: "2026-07",
      observedDaysBand: "30_59",
      unavailabilityRateBand: "60_79",
      transformationPolicyVersion: "v1",
    },
    buildEnv(),
  );

const identityRight =
  buildOpaqueOccupancyFactKey(
    {
      privateOccupancySignature:
        "occupancy|booking|private-001",
      marketCellKey:
        "v1|morocco|marrakech|booking|apartment|4_6|unknown",
      capturePeriodBucket: "2026-07",
      observedDaysBand: "30_59",
      unavailabilityRateBand: "60_79",
      transformationPolicyVersion: "v1",
    },
    buildEnv(),
  );

assert.equal(identityLeft.ok, true);
assert.equal(identityRight.ok, true);

if (!identityLeft.ok || !identityRight.ok) {
  throw new Error("Identity generation failed");
}

assert.equal(
  identityLeft.factKey,
  identityRight.factKey,
);

const serialized = JSON.stringify({
  result: success,
  row,
});

for (const forbiddenValue of [
  "occupancy|booking|private-001",
  "observedDays\":30",
  "unavailableDays\":18",
  "availableDays\":12",
  "windowDays\":30",
]) {
  assert.equal(
    serialized.includes(forbiddenValue),
    false,
    `Writer output leaks private input: ${forbiddenValue}`,
  );
}

const databaseError =
  await writeAnonymousOccupancyFacts(
    buildInput(),
    {
      env: buildEnv(),
      upsertFacts: async () => ({
        ok: false,
      }),
    },
  );

assert.equal(databaseError.status, "failed");
assert.equal(
  databaseError.databaseStatus,
  "failed",
);
assert.ok(
  databaseError.reasonCodes.includes(
    "database_error",
  ),
);

console.log(
  "PASS — Intelligence v2 Occupancy Fact Writer smoke",
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
