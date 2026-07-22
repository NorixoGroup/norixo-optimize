import assert from "node:assert/strict";

import {
  INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION,
  INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION,
  buildIntelligencePublishingBatchPlan,
  buildRetryIntelligencePublishingBatchPlan,
  executeIntelligencePublishingBatch,
  recomputeIntelligencePublishingBatchPlanFingerprint,
  validateIntelligencePublishingBatchPlan,
  type IntelligencePublishingBatchCandidate,
  type IntelligencePublishingBatchHandlerResult,
  type IntelligencePublishingBatchPlan,
} from "../lib/intelligencePublishing/batchPlanning";

const CREATED_AT = "2026-07-21T12:00:00.000Z";

function buildCandidate(
  overrides: Partial<IntelligencePublishingBatchCandidate> = {},
): IntelligencePublishingBatchCandidate {
  return {
    candidateId: "candidate_paris_en_airbnb_apartment",
    reportKey: "market-report-paris-airbnb-apartment",
    locale: "en",
    country: "fr",
    city: "Paris",
    platform: "airbnb",
    propertyType: "apartment",
    priority: 100,
    requestedAction: "publish",
    sourceFingerprint: "source_fp_paris_airbnb_apartment_v1",
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectBatchError(
  fn: () => unknown,
  code: string,
): Error {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error);
    assert.equal((error as { code?: string }).code, code);
    return error;
  }
  throw new Error(`Expected batch error ${code}.`);
}

async function main() {
  const emptyPlan = buildIntelligencePublishingBatchPlan({
    candidates: [],
    mode: "dry_run",
    createdAt: CREATED_AT,
  });
  assert.equal(emptyPlan.schemaVersion, INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION);
  assert.equal(emptyPlan.plannerVersion, INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION);
  assert.equal(emptyPlan.itemCount, 0);
  assert.equal(emptyPlan.candidateCount, 0);
  assert.equal(emptyPlan.duplicateCount, 0);
  const emptyPlanAgain = buildIntelligencePublishingBatchPlan({
    candidates: [],
    mode: "dry_run",
    createdAt: "2026-07-21T13:00:00.000Z",
  });
  assert.equal(emptyPlan.planFingerprint, emptyPlanAgain.planFingerprint);

  const singlePlan = buildIntelligencePublishingBatchPlan({
    candidates: [buildCandidate()],
    mode: "execute",
    createdAt: CREATED_AT,
  });
  assert.equal(singlePlan.itemCount, 1);
  assert.equal(singlePlan.items[0]?.plannedStatus, "planned");
  assert.equal(singlePlan.items[0]?.itemKey.length! > 0, true);

  const multipleCandidates = [
    buildCandidate({
      candidateId: "candidate_barcelona_fr_airbnb_apartment",
      reportKey: "market-report-barcelona-airbnb-apartment",
      locale: "fr",
      country: "es",
      city: "Barcelona",
      priority: 200,
      sourceFingerprint: "source_fp_barcelona_airbnb_apartment_v1",
    }),
    buildCandidate({
      candidateId: "candidate_madrid_en_booking_house",
      reportKey: "market-report-madrid-booking-house",
      locale: "en",
      country: "es",
      city: "Madrid",
      platform: "booking",
      propertyType: "house",
      priority: 50,
      sourceFingerprint: "source_fp_madrid_booking_house_v1",
    }),
    buildCandidate(),
  ];
  const orderedPlan = buildIntelligencePublishingBatchPlan({
    candidates: multipleCandidates,
    mode: "execute",
    createdAt: CREATED_AT,
  });
  const reversedPlan = buildIntelligencePublishingBatchPlan({
    candidates: [...multipleCandidates].reverse(),
    mode: "execute",
    createdAt: "2026-07-21T15:00:00.000Z",
  });
  assert.equal(orderedPlan.planFingerprint, reversedPlan.planFingerprint);
  assert.deepEqual(
    orderedPlan.items.map((item) => item.itemKey),
    reversedPlan.items.map((item) => item.itemKey),
  );
  assert.deepEqual(
    orderedPlan.items.map((item) => item.sequence),
    [1, 2, 3],
  );

  const exactDuplicatePlan = buildIntelligencePublishingBatchPlan({
    candidates: [
      buildCandidate(),
      buildCandidate({
        candidateId: "candidate_paris_en_airbnb_apartment_duplicate",
      }),
    ],
    mode: "execute",
    createdAt: CREATED_AT,
  });
  assert.equal(exactDuplicatePlan.candidateCount, 2);
  assert.equal(exactDuplicatePlan.itemCount, 1);
  assert.equal(exactDuplicatePlan.duplicateCount, 1);
  assert.equal(
    exactDuplicatePlan.diagnostics.some((diagnostic) => diagnostic.code === "duplicate_exact"),
    true,
  );

  expectBatchError(
    () =>
      buildIntelligencePublishingBatchPlan({
        candidates: [
          buildCandidate(),
          buildCandidate({
            candidateId: "candidate_paris_en_airbnb_apartment_priority_conflict",
            priority: 5,
          }),
        ],
        mode: "execute",
        createdAt: CREATED_AT,
      }),
    "identity_collision",
  );

  const localePlan = buildIntelligencePublishingBatchPlan({
    candidates: [
      buildCandidate(),
      buildCandidate({
        candidateId: "candidate_paris_fr_airbnb_apartment",
        locale: "fr",
      }),
    ],
    mode: "execute",
    createdAt: CREATED_AT,
  });
  assert.equal(localePlan.itemCount, 2);

  const platformPlan = buildIntelligencePublishingBatchPlan({
    candidates: [
      buildCandidate(),
      buildCandidate({
        candidateId: "candidate_paris_en_booking_apartment",
        platform: "booking",
      }),
    ],
    mode: "execute",
    createdAt: CREATED_AT,
  });
  assert.equal(platformPlan.itemCount, 2);

  const actionPlan = buildIntelligencePublishingBatchPlan({
    candidates: [
      buildCandidate(),
      buildCandidate({
        candidateId: "candidate_paris_en_airbnb_apartment_generate",
        requestedAction: "generate",
      }),
    ],
    mode: "execute",
    createdAt: CREATED_AT,
  });
  assert.equal(actionPlan.itemCount, 2);

  const priorityPlan = buildIntelligencePublishingBatchPlan({
    candidates: [
      buildCandidate({
        candidateId: "priority_low",
        priority: 100,
      }),
      buildCandidate({
        candidateId: "priority_high",
        reportKey: "market-report-london-airbnb-room",
        city: "London",
        country: "gb",
        propertyType: "room",
        priority: 10,
        sourceFingerprint: "source_fp_london_airbnb_room_v1",
      }),
    ],
    mode: "execute",
    createdAt: CREATED_AT,
  });
  assert.equal(priorityPlan.items[0]?.candidate.candidateId, "priority_high");

  const forgedFingerprintPlan = clone(singlePlan) as IntelligencePublishingBatchPlan;
  (forgedFingerprintPlan as { planFingerprint: string }).planFingerprint = "forged";
  const forgedFingerprintValidation = validateIntelligencePublishingBatchPlan(
    forgedFingerprintPlan,
  );
  assert.equal(forgedFingerprintValidation.ok, false);

  const unknownSchemaPlan = {
    ...clone(singlePlan),
    schemaVersion: "unknown",
  } as unknown as IntelligencePublishingBatchPlan;
  assert.equal(validateIntelligencePublishingBatchPlan(unknownSchemaPlan).ok, false);

  const unknownPlannerPlan = {
    ...clone(singlePlan),
    plannerVersion: "unknown",
  } as unknown as IntelligencePublishingBatchPlan;
  assert.equal(validateIntelligencePublishingBatchPlan(unknownPlannerPlan).ok, false);

  const duplicateSequencePlan = {
    ...clone(singlePlan),
    items: [
      ...singlePlan.items,
      clone({
        ...singlePlan.items[0]!,
        itemKey: `${singlePlan.items[0]!.itemKey}_duplicate`,
        sequence: 1,
      }),
    ],
    itemCount: 2,
    planFingerprint: "forged",
  } as unknown as IntelligencePublishingBatchPlan;
  assert.equal(validateIntelligencePublishingBatchPlan(duplicateSequencePlan).ok, false);

  const duplicateItemKeyPlan = {
    ...clone(singlePlan),
    items: [
      ...singlePlan.items,
      clone({
        ...singlePlan.items[0]!,
        sequence: 2,
      }),
    ],
    itemCount: 2,
    planFingerprint: "forged",
  } as unknown as IntelligencePublishingBatchPlan;
  assert.equal(validateIntelligencePublishingBatchPlan(duplicateItemKeyPlan).ok, false);

  expectBatchError(
    () =>
      buildIntelligencePublishingBatchPlan({
        candidates: [
          {
            ...buildCandidate(),
            userId: "private-user",
          } as unknown as IntelligencePublishingBatchCandidate,
        ],
        mode: "execute",
        createdAt: CREATED_AT,
      }),
    "private_field_detected",
  );

  let dryRunHandlerCalls = 0;
  const dryRunResult = await executeIntelligencePublishingBatch({
    plan: buildIntelligencePublishingBatchPlan({
      candidates: [buildCandidate()],
      mode: "dry_run",
      createdAt: CREATED_AT,
    }),
    now: () => CREATED_AT,
    executeItem: async () => {
      dryRunHandlerCalls += 1;
      return { status: "succeeded" };
    },
  });
  assert.equal(dryRunHandlerCalls, 0);
  assert.equal(dryRunResult.status, "dry_run_completed");
  assert.equal(dryRunResult.itemResults[0]?.status, "dry_run_validated");

  const successPlan = buildIntelligencePublishingBatchPlan({
    candidates: multipleCandidates,
    mode: "execute",
    createdAt: CREATED_AT,
  });
  const alwaysSuccess = async (): Promise<IntelligencePublishingBatchHandlerResult> => ({
    status: "succeeded",
    metadata: {
      simulated: true,
    },
  });
  const successResult = await executeIntelligencePublishingBatch({
    plan: successPlan,
    now: () => CREATED_AT,
    executeItem: alwaysSuccess,
  });
  assert.equal(successResult.status, "completed");
  assert.equal(successResult.summary.succeededItems, 3);

  const mixedResult = await executeIntelligencePublishingBatch({
    plan: successPlan,
    now: () => CREATED_AT,
    executeItem: async (item) => {
      if (item.sequence === 1) {
        return { status: "succeeded" };
      }
      if (item.sequence === 2) {
        return { status: "failed", retryable: true };
      }
      return { status: "succeeded" };
    },
  });
  assert.equal(mixedResult.status, "completed_with_failures");
  assert.deepEqual(
    mixedResult.itemResults.map((item) => item.status),
    ["succeeded", "failed", "succeeded"],
  );

  const allFailedResult = await executeIntelligencePublishingBatch({
    plan: successPlan,
    now: () => CREATED_AT,
    executeItem: async () => ({ status: "failed", retryable: true }),
  });
  assert.equal(allFailedResult.status, "completed_with_failures");
  assert.equal(allFailedResult.summary.failedItems, 3);

  let blockedHandlerCalls = 0;
  const blockedPlanItems = successPlan.items.map((item) =>
    item.sequence === 2
      ? {
          ...item,
          plannedStatus: "blocked_input" as const,
          executable: false,
          blockedReasons: Object.freeze(["blocked_by_smoke"]),
        }
      : item,
  );
  const blockedPlan = {
    ...successPlan,
    items: blockedPlanItems,
    planFingerprint: recomputeIntelligencePublishingBatchPlanFingerprint({
      mode: successPlan.mode,
      candidateCount: successPlan.candidateCount,
      duplicateCount: successPlan.duplicateCount,
      items: blockedPlanItems,
      diagnostics: successPlan.diagnostics,
    }),
  };
  const blockedExecutionResult = await executeIntelligencePublishingBatch({
    plan: blockedPlan,
    now: () => CREATED_AT,
    executeItem: async () => {
      blockedHandlerCalls += 1;
      return { status: "succeeded" };
    },
  });
  assert.equal(blockedHandlerCalls, 2);
  assert.equal(
    blockedExecutionResult.itemResults.some((item) => item.status === "blocked"),
    true,
  );

  const thrownResult = await executeIntelligencePublishingBatch({
    plan: successPlan,
    now: () => CREATED_AT,
    executeItem: async (item) => {
      if (item.sequence === 2) {
        throw new Error("simulated handler exception");
      }
      return { status: "succeeded" };
    },
  });
  assert.deepEqual(
    thrownResult.itemResults.map((item) => item.status),
    ["succeeded", "failed", "succeeded"],
  );

  assert.equal(
    mixedResult.summary.totalItems,
    mixedResult.itemResults.length,
  );
  assert.equal(mixedResult.summary.executableItems, successPlan.items.length);
  assert.equal(mixedResult.summary.succeededItems, 2);
  assert.equal(mixedResult.summary.failedItems, 1);

  const stableResultAgain = await executeIntelligencePublishingBatch({
    plan: successPlan,
    now: () => CREATED_AT,
    executeItem: async (item) => {
      if (item.sequence === 1) {
        return { status: "succeeded" };
      }
      if (item.sequence === 2) {
        return { status: "failed", retryable: true };
      }
      return { status: "succeeded" };
    },
  });
  assert.equal(mixedResult.resultFingerprint, stableResultAgain.resultFingerprint);

  const retryResult = buildRetryIntelligencePublishingBatchPlan({
    previousPlan: successPlan,
    previousResult: mixedResult,
    createdAt: "2026-07-21T16:00:00.000Z",
  });
  assert.equal(retryResult.plan.itemCount, 1);
  assert.deepEqual(
    retryResult.retriedItemKeys,
    [mixedResult.itemResults[1]!.itemKey],
  );
  assert.deepEqual(
    retryResult.plan.items.map((item) => item.itemKey),
    retryResult.retriedItemKeys,
  );

  const noSucceededRetry = buildRetryIntelligencePublishingBatchPlan({
    previousPlan: successPlan,
    previousResult: successResult,
    createdAt: "2026-07-21T16:10:00.000Z",
  });
  assert.equal(noSucceededRetry.plan.itemCount, 0);

  const hundredCandidates: IntelligencePublishingBatchCandidate[] = Array.from(
    { length: 100 },
    (_, index) => ({
      candidateId: `candidate_${index + 1}`,
      reportKey: `market-report-city-${Math.floor(index / 2)}`,
      locale: index % 5 === 0 ? "fr" : index % 3 === 0 ? "es" : "en",
      country: index % 4 === 0 ? "fr" : index % 4 === 1 ? "es" : "gb",
      city: `City-${Math.floor(index / 2)}`,
      platform: index % 2 === 0 ? "airbnb" : "booking",
      propertyType:
        index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room",
      priority: 100 + (index % 7),
      requestedAction: index % 4 === 0 ? "generate" : index % 4 === 1 ? "publish" : "refresh",
      sourceFingerprint: `source_fp_${Math.floor(index / 2)}_${index % 4}`,
    }),
  );
  hundredCandidates.push({
    ...clone(hundredCandidates[10]!),
    candidateId: "candidate_101_duplicate_exact",
  });
  hundredCandidates.push({
    ...clone(hundredCandidates[22]!),
    candidateId: "candidate_102_duplicate_exact",
  });

  const hundredPlan = buildIntelligencePublishingBatchPlan({
    candidates: hundredCandidates,
    mode: "execute",
    createdAt: CREATED_AT,
  });
  const hundredPlanReversed = buildIntelligencePublishingBatchPlan({
    candidates: [...hundredCandidates].reverse(),
    mode: "execute",
    createdAt: "2026-07-21T18:00:00.000Z",
  });
  assert.equal(hundredPlan.planFingerprint, hundredPlanReversed.planFingerprint);
  assert.equal(hundredPlan.duplicateCount, 2);
  assert.equal(hundredPlan.itemCount, 100);

  const hundredResult = await executeIntelligencePublishingBatch({
    plan: hundredPlan,
    now: () => CREATED_AT,
    executeItem: async (item) => {
      if (item.sequence % 17 === 0) {
        return { status: "blocked" };
      }
      if (item.sequence % 11 === 0) {
        return { status: "failed", retryable: true };
      }
      return { status: "succeeded" };
    },
  });
  assert.equal(hundredResult.itemResults.length, 100);
  assert.equal(hundredResult.summary.duplicateCandidates, 2);
  assert.equal(hundredResult.summary.failedItems > 0, true);
  assert.equal(hundredResult.summary.blockedItems > 0, true);
  assert.equal(hundredResult.status, "completed_with_failures");

  assert.equal(
    JSON.stringify(hundredPlan).includes("userId"),
    false,
  );
  assert.equal(
    JSON.stringify(hundredResult).includes("listingUrl"),
    false,
  );

  console.log("PASS — Intelligence Publishing batch planning smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
