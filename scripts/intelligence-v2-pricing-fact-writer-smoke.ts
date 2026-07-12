import {
  INTELLIGENCE_FACT_IDENTITY_SECRET,
  buildOpaqueFactKey,
} from "../lib/intelligenceV2/opaqueFactIdentity";
import {
  writeAnonymousPricingFacts,
  type AnonymousFactGroupInsertRow,
  type PrivatePricingObservation,
  type PricingFactWriterResult,
  type WriteAnonymousPricingFactsInput,
} from "../lib/intelligenceV2/pricingFactWriter";
import {
  ENABLE_INTELLIGENCE_FACT_CONTRIBUTION,
  ENABLE_INTELLIGENCE_FACT_TRANSFORMATION,
  DEBUG_INTELLIGENCE_V2,
} from "../lib/intelligenceV2/featureFlags";

type ScenarioResult = {
  scenario: string;
  status: "pass" | "fail";
  reason?: string;
};

type CapturedUpsert = {
  rows: ReadonlyArray<AnonymousFactGroupInsertRow>;
};

function fail(message: string): never {
  throw new Error(message);
}

function expect(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function logScenario(result: ScenarioResult): void {
  console.log(JSON.stringify(result));
}

function buildBaseObservation(
  overrides: Partial<PrivatePricingObservation> = {},
): PrivatePricingObservation {
  return {
    privateComparableSignature: "cmp|booking|abc123",
    capturedAt: "2026-07-01T12:34:56.000Z",
    platform: "booking",
    country: "Morocco",
    city: "Marrakech",
    propertyType: "apartment",
    capacity: 4,
    guestCapacity: 4,
    currency: "EUR",
    nightlyPrice: 182.45,
    sourceKind: "live_comparable",
    comparableQuality: "pricing_grade",
    ...overrides,
  };
}

function buildBaseWriterInput(
  overrides: Partial<WriteAnonymousPricingFactsInput> = {},
): WriteAnonymousPricingFactsInput {
  return {
    sourceClass: "authenticated_audit",
    collectionMode: "live",
    observations: [buildBaseObservation()],
    ...overrides,
  };
}

function buildEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    [ENABLE_INTELLIGENCE_FACT_TRANSFORMATION]: "true",
    [ENABLE_INTELLIGENCE_FACT_CONTRIBUTION]: "true",
    [INTELLIGENCE_FACT_IDENTITY_SECRET]: "super-secret-v1",
    [DEBUG_INTELLIGENCE_V2]: "false",
    ...overrides,
  };
}

function expectResultStatus(
  result: PricingFactWriterResult,
  status: PricingFactWriterResult["status"],
  message: string,
): void {
  expect(result.status === status, `${message}: expected ${status}, got ${result.status}`);
}

function captureUpsertStore() {
  const captured: CapturedUpsert[] = [];
  return {
    captured,
    upsertFacts: async (
      rows: ReadonlyArray<AnonymousFactGroupInsertRow>,
    ): Promise<{ ok: true }> => {
      captured.push({ rows });
      return { ok: true };
    },
  };
}

async function main() {
  const scenarioResults: ScenarioResult[] = [];
  const originalConsoleInfo = console.info;
  const originalEnvValues = new Map<string, string | undefined>();
  const trackedEnvKeys = [
    ENABLE_INTELLIGENCE_FACT_TRANSFORMATION,
    ENABLE_INTELLIGENCE_FACT_CONTRIBUTION,
    INTELLIGENCE_FACT_IDENTITY_SECRET,
    DEBUG_INTELLIGENCE_V2,
  ];

  for (const key of trackedEnvKeys) {
    originalEnvValues.set(key, process.env[key]);
  }

  const run = async (scenario: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      const result: ScenarioResult = { scenario, status: "pass" };
      scenarioResults.push(result);
      logScenario(result);
    } catch (error) {
      const result: ScenarioResult = {
        scenario,
        status: "fail",
        reason: error instanceof Error ? error.message : String(error),
      };
      scenarioResults.push(result);
      logScenario(result);
    }
  };

  try {
    await run("transformation_off_no_write", async () => {
      let writes = 0;
      const result = await writeAnonymousPricingFacts(buildBaseWriterInput(), {
        env: buildEnv({
          [ENABLE_INTELLIGENCE_FACT_TRANSFORMATION]: "false",
        }),
        upsertFacts: async () => {
          writes += 1;
          return { ok: true };
        },
      });
      expectResultStatus(result, "disabled", "transformation_off_no_write");
      expect(writes === 0, "database should not be accessed");
      expect(
        result.reasonCodes.includes("transformation_disabled"),
        "missing transformation_disabled reason",
      );
    });

    await run("transformation_on_contribution_off", async () => {
      let writes = 0;
      const result = await writeAnonymousPricingFacts(buildBaseWriterInput(), {
        env: buildEnv({
          [ENABLE_INTELLIGENCE_FACT_CONTRIBUTION]: "false",
        }),
        upsertFacts: async () => {
          writes += 1;
          return { ok: true };
        },
      });
      expectResultStatus(result, "transformed_only", "transformation_on_contribution_off");
      expect(result.accepted === 1, "expected one transformed fact");
      expect(writes === 0, "database should not be accessed");
      expect(
        result.reasonCodes.includes("contribution_disabled"),
        "missing contribution_disabled reason",
      );
    });

    await run("secret_absent_fail_closed", async () => {
      const result = await writeAnonymousPricingFacts(buildBaseWriterInput(), {
        env: buildEnv({
          [INTELLIGENCE_FACT_IDENTITY_SECRET]: undefined,
        }),
      });
      expectResultStatus(result, "failed", "secret_absent_fail_closed");
      expect(
        result.reasonCodes.includes("missing_identity_secret"),
        "missing missing_identity_secret reason",
      );
    });

    await run("authenticated_audit_valid_batch_submitted", async () => {
      const store = captureUpsertStore();
      const result = await writeAnonymousPricingFacts(buildBaseWriterInput(), {
        env: buildEnv(),
        upsertFacts: store.upsertFacts,
      });
      expectResultStatus(result, "success", "authenticated_audit_valid_batch_submitted");
      expect(result.submitted === 1, "expected one submitted row");
      expect(store.captured.length === 1, "expected one upsert batch");
      expect(store.captured[0]?.rows.length === 1, "expected one upsert row");
    });

    await run("authenticated_listing_valid_batch_submitted", async () => {
      const store = captureUpsertStore();
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({ sourceClass: "authenticated_listing" }),
        {
          env: buildEnv(),
          upsertFacts: store.upsertFacts,
        },
      );
      expectResultStatus(result, "success", "authenticated_listing_valid_batch_submitted");
      expect(result.submitted === 1, "expected one submitted row");
    });

    await run("memory_reuse_skipped", async () => {
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({ collectionMode: "memory_reuse" }),
        {
          env: buildEnv(),
        },
      );
      expectResultStatus(result, "skipped", "memory_reuse_skipped");
      expect(
        result.reasonCodes.includes("memory_reuse_skipped"),
        "missing memory_reuse_skipped reason",
      );
    });

    await run("market_memory_seed_rejected", async () => {
      const store = captureUpsertStore();
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [buildBaseObservation({ sourceKind: "market_memory_seed" })],
        }),
        {
          env: buildEnv(),
          upsertFacts: store.upsertFacts,
        },
      );
      expectResultStatus(result, "skipped", "market_memory_seed_rejected");
      expect(result.rejected === 1, "expected one rejected observation");
      expect(result.submitted === 0, "expected zero submitted rows");
    });

    await run("missing_private_signature_rejected", async () => {
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [buildBaseObservation({ privateComparableSignature: null })],
        }),
        { env: buildEnv() },
      );
      expectResultStatus(result, "skipped", "missing_private_signature_rejected");
      expect(
        result.reasonCodes.includes("missing_private_signature"),
        "missing missing_private_signature reason",
      );
    });

    await run("privacy_violation_rejected", async () => {
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [
            buildBaseObservation({
              country: "https://private.example.com/internal",
            }),
          ],
        }),
        { env: buildEnv() },
      );
      expectResultStatus(result, "skipped", "privacy_violation_rejected");
      expect(
        result.reasonCodes.includes("privacy_validation_failed"),
        "missing privacy_validation_failed reason",
      );
    });

    await run("invalid_price_rejected", async () => {
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [buildBaseObservation({ nightlyPrice: 0 })],
        }),
        { env: buildEnv() },
      );
      expectResultStatus(result, "skipped", "invalid_price_rejected");
      expect(
        result.reasonCodes.includes("invalid_candidate"),
        "missing invalid_candidate reason",
      );
    });

    await run("duplicate_in_same_batch_deduplicated", async () => {
      const store = captureUpsertStore();
      const duplicate = buildBaseObservation();
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [duplicate, duplicate],
        }),
        {
          env: buildEnv(),
          upsertFacts: store.upsertFacts,
        },
      );
      expectResultStatus(result, "success", "duplicate_in_same_batch_deduplicated");
      expect(result.deduplicatedInBatch === 1, "expected one duplicate in batch");
      expect(result.submitted === 1, "expected one unique submitted row");
      expect(
        result.reasonCodes.includes("duplicate_in_batch"),
        "missing duplicate_in_batch reason",
      );
    });

    await run("different_signatures_same_price_submit_two_rows", async () => {
      const store = captureUpsertStore();
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [
            buildBaseObservation({ privateComparableSignature: "cmp|booking|one" }),
            buildBaseObservation({ privateComparableSignature: "cmp|booking|two" }),
          ],
        }),
        {
          env: buildEnv(),
          upsertFacts: store.upsertFacts,
        },
      );
      expectResultStatus(result, "success", "different_signatures_same_price_submit_two_rows");
      expect(result.submitted === 2, "expected two submitted rows");
      const rows = store.captured[0]?.rows ?? [];
      expect(rows.length === 2, "expected two rows in upsert batch");
      expect(rows[0]?.fact_key !== rows[1]?.fact_key, "fact keys should differ");
    });

    await run("same_signature_new_month_new_fact_key", async () => {
      const left = buildOpaqueFactKey(
        {
          privateComparableSignature: "cmp|booking|abc123",
          marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
          capturePeriodBucket: "2026-07",
          normalizedNightlyPrice: 182.45,
          transformationPolicyVersion: "v1",
        },
        buildEnv(),
      );
      const right = buildOpaqueFactKey(
        {
          privateComparableSignature: "cmp|booking|abc123",
          marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
          capturePeriodBucket: "2026-08",
          normalizedNightlyPrice: 182.45,
          transformationPolicyVersion: "v1",
        },
        buildEnv(),
      );
      expect(left.ok && right.ok, "expected both opaque keys to succeed");
      if (!left.ok || !right.ok) fail("opaque key generation failed");
      expect(left.factKey !== right.factKey, "fact keys should differ by month");
    });

    await run("same_signature_different_price_same_month_new_fact_key", async () => {
      const left = buildOpaqueFactKey(
        {
          privateComparableSignature: "cmp|booking|abc123",
          marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
          capturePeriodBucket: "2026-07",
          normalizedNightlyPrice: 182.45,
          transformationPolicyVersion: "v1",
        },
        buildEnv(),
      );
      const right = buildOpaqueFactKey(
        {
          privateComparableSignature: "cmp|booking|abc123",
          marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
          capturePeriodBucket: "2026-07",
          normalizedNightlyPrice: 190.0,
          transformationPolicyVersion: "v1",
        },
        buildEnv(),
      );
      expect(left.ok && right.ok, "expected both opaque keys to succeed");
      if (!left.ok || !right.ok) fail("opaque key generation failed");
      expect(left.factKey !== right.factKey, "fact keys should differ by price");
    });

    await run("same_observation_different_source_class_same_fact_key", async () => {
      const auditStore = captureUpsertStore();
      const listingStore = captureUpsertStore();
      const input = buildBaseWriterInput();
      const auditResult = await writeAnonymousPricingFacts(input, {
        env: buildEnv(),
        upsertFacts: auditStore.upsertFacts,
      });
      const listingResult = await writeAnonymousPricingFacts(
        {
          ...input,
          sourceClass: "authenticated_listing",
        },
        {
          env: buildEnv(),
          upsertFacts: listingStore.upsertFacts,
        },
      );
      expectResultStatus(auditResult, "success", "audit result should succeed");
      expectResultStatus(listingResult, "success", "listing result should succeed");
      const auditFactKey = auditStore.captured[0]?.rows[0]?.fact_key;
      const listingFactKey = listingStore.captured[0]?.rows[0]?.fact_key;
      expect(
        auditFactKey === listingFactKey,
        "fact key should be stable across source class",
      );
    });

    await run("hmac_token_is_stable", async () => {
      const left = buildOpaqueFactKey(
        {
          privateComparableSignature: "cmp|booking|stable",
          marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
          capturePeriodBucket: "2026-07",
          normalizedNightlyPrice: 182.45,
          transformationPolicyVersion: "v1",
        },
        buildEnv(),
      );
      const right = buildOpaqueFactKey(
        {
          privateComparableSignature: "cmp|booking|stable",
          marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
          capturePeriodBucket: "2026-07",
          normalizedNightlyPrice: 182.45,
          transformationPolicyVersion: "v1",
        },
        buildEnv(),
      );
      expect(left.ok && right.ok, "expected stable opaque keys");
      if (!left.ok || !right.ok) fail("opaque key generation failed");
      expect(left.factKey === right.factKey, "fact key should be stable");
    });

    await run("secret_change_changes_token", async () => {
      const baseInput = {
        privateComparableSignature: "cmp|booking|stable",
        marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
        capturePeriodBucket: "2026-07",
        normalizedNightlyPrice: 182.45,
        transformationPolicyVersion: "v1",
      };
      const left = buildOpaqueFactKey(baseInput, buildEnv());
      const right = buildOpaqueFactKey(
        baseInput,
        buildEnv({
          [INTELLIGENCE_FACT_IDENTITY_SECRET]: "super-secret-v2",
        }),
      );
      expect(left.ok && right.ok, "expected both opaque keys");
      if (!left.ok || !right.ok) fail("opaque key generation failed");
      expect(left.factKey !== right.factKey, "fact key should change with secret");
    });

    await run("result_never_contains_private_signature", async () => {
      const privateSignature = "cmp|booking|never-return-me";
      const result = await writeAnonymousPricingFacts(
        buildBaseWriterInput({
          observations: [
            buildBaseObservation({
              privateComparableSignature: privateSignature,
            }),
          ],
        }),
        {
          env: buildEnv(),
          upsertFacts: async () => ({ ok: true }),
        },
      );
      expect(
        !JSON.stringify(result).includes(privateSignature),
        "writer result should not expose private signature",
      );
    });

    await run("database_error_returns_failed_without_throw", async () => {
      const result = await writeAnonymousPricingFacts(buildBaseWriterInput(), {
        env: buildEnv(),
        upsertFacts: async () => ({ ok: false }),
      });
      expectResultStatus(result, "failed", "database_error_returns_failed_without_throw");
      expect(
        result.reasonCodes.includes("database_error"),
        "missing database_error reason",
      );
    });

    await run("debug_logging_contains_no_private_data", async () => {
      const logs: string[] = [];
      console.info = (...args: unknown[]) => {
        logs.push(args.map((value) => String(value)).join(" "));
      };

      const privateSignature = "cmp|booking|private-log-check";
      const result = await writeAnonymousPricingFacts(buildBaseWriterInput(), {
        env: buildEnv({
          [DEBUG_INTELLIGENCE_V2]: "true",
        }),
        upsertFacts: async (rows) => {
          const clonedRows = rows.map((row) => ({ ...row }));
          expect(deepEqual(rows, clonedRows), "rows should be serializable");
          return { ok: true };
        },
      });

      expectResultStatus(result, "success", "debug_logging_contains_no_private_data");
      const serializedLogs = logs.join("\n");
      expect(
        !serializedLogs.includes(privateSignature),
        "debug logs should not contain private signature",
      );
      expect(!serializedLogs.includes("Marrakech"), "debug logs should not contain city");
      expect(!serializedLogs.includes("Morocco"), "debug logs should not contain country");
      expect(!serializedLogs.includes("182.45"), "debug logs should not contain price");
      expect(!serializedLogs.includes("ifv2_"), "debug logs should not contain fact key");
    });
  } finally {
    console.info = originalConsoleInfo;
    for (const [key, value] of originalEnvValues.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  const failures = scenarioResults.filter((result) => result.status === "fail");
  if (failures.length > 0) {
    console.error(
      JSON.stringify({
        summary: "FAIL",
        failedScenarios: failures.map((item) => item.scenario),
      }),
    );
    process.exit(1);
  }

  console.log("PASS — Intelligence v2 Pricing Fact Writer smoke");
}

void main();
