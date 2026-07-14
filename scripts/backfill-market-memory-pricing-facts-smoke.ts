import { readFileSync } from "node:fs";
import {
  analyzeMarketMemoryPricingBackfillDryRun,
  buildMarketMemoryPricingBackfillApplyReport,
  formatMarketMemoryPricingBackfillApplyReport,
  formatMarketMemoryPricingBackfillDryRunReport,
  parseMarketMemoryPricingBackfillCliArgs,
  type MarketMemoryPricingBackfillCliOptions,
  type MarketMemoryPricingBackfillComparableRow,
  type MarketMemoryPricingBackfillPreparedWrite,
  type MarketMemoryPricingBackfillSnapshotRow,
  type MarketMemoryPricingBackfillSourceClass,
} from "../lib/intelligenceV2/marketMemoryPricingBackfill";

function fail(message: string): never {
  throw new Error(message);
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    fail(`${message}: expected ${expected}, got ${actual}`);
  }
}

function expectThrows(
  callback: () => unknown,
  expectedMessage: string,
  message: string,
): void {
  try {
    callback();
  } catch (error) {
    const actualMessage =
      error instanceof Error ? error.message : String(error);
    expect(
      actualMessage.includes(expectedMessage),
      `${message}: expected error containing "${expectedMessage}", got "${actualMessage}"`,
    );
    return;
  }

  fail(`${message}: expected an error.`);
}

function buildOptions(
  overrides: Partial<MarketMemoryPricingBackfillCliOptions> = {},
): MarketMemoryPricingBackfillCliOptions {
  return {
    country: null,
    city: null,
    platform: null,
    limit: null,
    snapshotId: null,
    from: null,
    to: null,
    mode: "dry_run",
    confirmWrite: false,
    ...overrides,
  };
}

function buildSnapshot(
  id: string,
  route: string,
  overrides: Partial<MarketMemoryPricingBackfillSnapshotRow> = {},
): MarketMemoryPricingBackfillSnapshotRow {
  return {
    id,
    country: "Morocco",
    city: "Marrakech",
    platform: "airbnb",
    property_type: "apartment",
    created_at: "2026-05-15T10:00:00.000Z",
    metadata: { route },
    ...overrides,
  };
}

function buildComparable(
  id: string,
  snapshotId: string,
  overrides: Partial<MarketMemoryPricingBackfillComparableRow> = {},
): MarketMemoryPricingBackfillComparableRow {
  return {
    id,
    snapshot_id: snapshotId,
    platform: "airbnb",
    city: "Marrakech",
    country: "Morocco",
    property_type: "apartment",
    nightly_price: 120,
    currency: "EUR",
    created_at: "2026-05-20T11:00:00.000Z",
    raw: {
      canonicalUrl: `https://example.com/canonical/${id}`,
      sourceUrl: `https://example.com/source/${id}`,
      externalId: `external-${id}`,
      locationLabel: "Marrakech, Morocco",
      comparableQuality: "pricing_grade",
    },
    url: `https://example.com/listing/${id}`,
    title: `Private title ${id}`,
    latitude: 31.6295,
    longitude: -7.9811,
    ...overrides,
  };
}

function runAnalysis(
  snapshots: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>,
  comparables: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>,
  options: Partial<MarketMemoryPricingBackfillCliOptions> = {},
) {
  return analyzeMarketMemoryPricingBackfillDryRun({
    options: buildOptions(options),
    snapshots,
    comparables,
    identityEnv: {
      INTELLIGENCE_FACT_IDENTITY_SECRET: "test-secret",
    },
    referenceNow: "2026-07-15T00:00:00.000Z",
    includeDiagnostics: true,
  });
}

type FakeWriterInvocation = Readonly<{
  sourceClass: MarketMemoryPricingBackfillSourceClass;
  writes: ReadonlyArray<MarketMemoryPricingBackfillPreparedWrite>;
}>;

type FakeWriterOutcome = Readonly<{
  rejected?: number;
  fail?: boolean;
  insertedKeys?: ReadonlyArray<string>;
}>;

function groupPreparedWritesBySourceClass(
  preparedWrites: ReadonlyArray<MarketMemoryPricingBackfillPreparedWrite>,
): Map<
  MarketMemoryPricingBackfillSourceClass,
  MarketMemoryPricingBackfillPreparedWrite[]
> {
  const grouped = new Map<
    MarketMemoryPricingBackfillSourceClass,
    MarketMemoryPricingBackfillPreparedWrite[]
  >();

  for (const preparedWrite of preparedWrites) {
    const current = grouped.get(preparedWrite.sourceClass);
    if (current) {
      current.push(preparedWrite);
      continue;
    }
    grouped.set(preparedWrite.sourceClass, [preparedWrite]);
  }

  return grouped;
}

function runApplySimulation(input: {
  snapshots: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>;
  comparables: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>;
  existingFactKeys?: Set<string>;
  writer?:
    | ((
        invocation: FakeWriterInvocation,
      ) => FakeWriterOutcome)
    | undefined;
}) {
  const analysis = runAnalysis(input.snapshots, input.comparables, {
    mode: "apply",
    confirmWrite: true,
    country: "ma",
    city: "marrakech",
    platform: "airbnb",
  });
  const preparedWrites = analysis.diagnostics?.preparedWrites ?? [];
  const existingBefore = new Set(input.existingFactKeys ?? new Set<string>());
  const relevantExisting = new Set(
    preparedWrites
      .map((preparedWrite) => preparedWrite.opaqueFactKeyPreview)
      .filter((factKey) => existingBefore.has(factKey)),
  );
  const pendingWrites = preparedWrites.filter(
    (preparedWrite) =>
      !relevantExisting.has(preparedWrite.opaqueFactKeyPreview),
  );
  const grouped = groupPreparedWritesBySourceClass(pendingWrites);
  const invocations: FakeWriterInvocation[] = [];
  const existingAfter = new Set(existingBefore);
  let rejected = 0;

  for (const [sourceClass, writes] of grouped) {
    const invocation: FakeWriterInvocation = { sourceClass, writes };
    invocations.push(invocation);
    const outcome = input.writer?.(invocation) ?? {
      insertedKeys: writes.map((write) => write.opaqueFactKeyPreview),
    };
    rejected += outcome.rejected ?? 0;

    if (outcome.fail) {
      continue;
    }

    const insertedKeys =
      outcome.insertedKeys ??
      writes
        .slice(0, Math.max(0, writes.length - (outcome.rejected ?? 0)))
        .map((write) => write.opaqueFactKeyPreview);

    for (const factKey of insertedKeys) {
      existingAfter.add(factKey);
    }
  }

  let inserted = 0;
  for (const factKey of existingAfter) {
    if (!relevantExisting.has(factKey)) {
      const belongsToRun = preparedWrites.some(
        (preparedWrite) => preparedWrite.opaqueFactKeyPreview === factKey,
      );
      if (belongsToRun) {
        inserted += 1;
      }
    }
  }

  const report = buildMarketMemoryPricingBackfillApplyReport({
    dryRunReport: analysis.report,
    writeAttempted: pendingWrites.length,
    inserted,
    alreadyExisting: relevantExisting.size,
    rejected,
  });

  return {
    analysis,
    report,
    existingAfter,
    invocations,
  };
}

async function main() {
  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000001", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000101",
          "00000000-0000-4000-8000-000000000001",
        ),
      ],
    );
    expectEqual(result.report.uniqueFactKeys, 1, "api_audits should be eligible");
    expectEqual(
      result.report.bySourceClass.authenticated_audit,
      1,
      "api_audits should map to authenticated_audit",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000002", "api_listings")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000102",
          "00000000-0000-4000-8000-000000000002",
        ),
      ],
    );
    expectEqual(
      result.report.bySourceClass.authenticated_listing,
      1,
      "api_listings should map to authenticated_listing",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000003", "guest_audit")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000103",
          "00000000-0000-4000-8000-000000000003",
        ),
      ],
    );
    expectEqual(
      result.report.exclusions.unsupported_snapshot_source,
      1,
      "guest_audit should be excluded",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000004", "manual_patch")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000104",
          "00000000-0000-4000-8000-000000000004",
        ),
      ],
    );
    expectEqual(
      result.report.exclusions.unsupported_snapshot_source,
      1,
      "manual_* should be excluded",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000005", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000105",
          "00000000-0000-4000-8000-000000000005",
          {
            raw: {
              _marketMemory: {
                comparableOrigin: "fallback_observed_only",
                observedOnly: true,
              },
            },
          },
        ),
      ],
    );
    expectEqual(
      result.report.exclusions.fallback_observed_only,
      1,
      "fallback observed rows should be excluded",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000006", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000106",
          "00000000-0000-4000-8000-000000000006",
          { nightly_price: 0 },
        ),
      ],
    );
    expectEqual(
      result.report.exclusions.invalid_price,
      1,
      "invalid price should be excluded",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000007", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000107",
          "00000000-0000-4000-8000-000000000007",
          { currency: "EURO" },
        ),
      ],
    );
    expectEqual(
      result.report.exclusions.invalid_currency,
      1,
      "invalid currency should be excluded",
    );
  }

  {
    const result = runAnalysis(
      [
        buildSnapshot("00000000-0000-4000-8000-000000000008", "api_audits", {
          country: "Morocco",
          city: "Marrakech",
        }),
      ],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000108",
          "00000000-0000-4000-8000-000000000008",
          {
            country: null,
            city: null,
          },
        ),
      ],
    );
    const candidate = result.diagnostics?.candidates[0];
    expect(candidate != null, "snapshot fallback candidate should exist");
    expectEqual(
      candidate?.country,
      "ma",
      "country should fallback to snapshot and normalize",
    );
    expectEqual(
      candidate?.city,
      "marrakech",
      "city should fallback to snapshot and normalize",
    );
  }

  {
    const result = runAnalysis(
      [
        buildSnapshot("00000000-0000-4000-8000-000000000009", "api_audits", {
          property_type: null,
        }),
      ],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000109",
          "00000000-0000-4000-8000-000000000009",
          { property_type: null, raw: {} },
        ),
      ],
    );
    expectEqual(
      result.report.byPropertyType.unknown,
      1,
      "unknown property type should be accepted",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000010", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000110",
          "00000000-0000-4000-8000-000000000010",
          {
            raw: {
              comparableQuality: "pricing_grade",
            },
          },
        ),
      ],
    );
    expectEqual(
      result.report.byCapacityBand.unknown,
      1,
      "missing capacity should map to unknown band",
    );
    expectEqual(
      result.report.explicitStructuredCapacityCandidates,
      0,
      "missing capacity should not count as explicit",
    );
  }

  {
    const result = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000011", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000111",
          "00000000-0000-4000-8000-000000000011",
          {
            created_at: "2026-03-09T08:00:00.000Z",
          },
        ),
      ],
    );
    expectEqual(
      result.report.byCapturePeriod["2026-03"],
      1,
      "capture period should use comparable month",
    );
  }

  {
    const snapshot = buildSnapshot(
      "00000000-0000-4000-8000-000000000012",
      "api_audits",
    );
    const comparable = buildComparable(
      "00000000-0000-4000-8000-000000000112",
      "00000000-0000-4000-8000-000000000012",
    );
    const duplicate = buildComparable(
      "00000000-0000-4000-8000-000000000113",
      "00000000-0000-4000-8000-000000000012",
      {
        created_at: comparable.created_at,
        nightly_price: comparable.nightly_price,
        currency: comparable.currency,
        url: comparable.url,
        title: comparable.title,
        latitude: comparable.latitude,
        longitude: comparable.longitude,
        raw: comparable.raw,
      },
    );
    const result = runAnalysis([snapshot], [comparable, duplicate]);
    expectEqual(result.report.eligibleCandidates, 2, "duplicates remain eligible");
    expectEqual(result.report.uniqueFactKeys, 1, "duplicate rows should share a fact key");
    expectEqual(result.report.duplicateFactKeys, 1, "duplicate rows should be counted");
  }

  {
    const snapshot = buildSnapshot(
      "00000000-0000-4000-8000-000000000013",
      "api_audits",
    );
    const left = buildComparable(
      "00000000-0000-4000-8000-000000000114",
      "00000000-0000-4000-8000-000000000013",
      { nightly_price: 120 },
    );
    const right = buildComparable(
      "00000000-0000-4000-8000-000000000115",
      "00000000-0000-4000-8000-000000000013",
      { nightly_price: 140 },
    );
    const result = runAnalysis([snapshot], [left, right]);
    expectEqual(result.report.uniqueFactKeys, 2, "price changes should create two keys");
  }

  {
    const snapshot = buildSnapshot(
      "00000000-0000-4000-8000-000000000014",
      "api_audits",
    );
    const comparable = buildComparable(
      "00000000-0000-4000-8000-000000000116",
      "00000000-0000-4000-8000-000000000014",
    );
    const result = analyzeMarketMemoryPricingBackfillDryRun({
      options: buildOptions(),
      snapshots: [snapshot],
      comparables: [comparable],
      identityEnv: {
        INTELLIGENCE_FACT_IDENTITY_SECRET: "test-secret",
      },
      referenceNow: "2026-07-15T00:00:00.000Z",
      dependencies: {
        privacyValidator: () => ({
          valid: false,
          violations: [{ path: "$.marketCell", code: "forbidden_key" }],
        }),
      },
    });
    expectEqual(
      result.report.exclusions.privacy_validation_failed,
      1,
      "privacy validation failures should exclude the row",
    );
  }

  {
    const snapshot = buildSnapshot(
      "00000000-0000-4000-8000-000000000015",
      "api_audits",
    );
    const comparable = buildComparable(
      "00000000-0000-4000-8000-000000000117",
      "00000000-0000-4000-8000-000000000015",
      {
        raw: {
          comparableQuality: "pricing_grade",
          capacity: 4,
          guestCapacity: 4,
        },
      },
    );
    const result = runAnalysis([snapshot], [comparable]);
    expectEqual(
      result.report.explicitStructuredCapacityCandidates,
      1,
      "explicit capacity should be counted",
    );
    expectEqual(
      result.report.byCapacityBand["4_6"],
      1,
      "explicit capacity should produce a capacity band",
    );
  }

  {
    const snapshot = buildSnapshot(
      "00000000-0000-4000-8000-000000000016",
      "api_audits",
    );
    const comparable = buildComparable(
      "00000000-0000-4000-8000-000000000118",
      "00000000-0000-4000-8000-000000000016",
    );
    const reportText = formatMarketMemoryPricingBackfillDryRunReport(
      runAnalysis([snapshot], [comparable]).report,
      buildOptions(),
    );
    expect(
      !reportText.includes("https://example.com"),
      "rendered report must not include URLs",
    );
    expect(
      !reportText.includes("Private title"),
      "rendered report must not include titles",
    );
    expect(
      !reportText.includes("external-"),
      "rendered report must not include private ids",
    );
  }

  {
    const left = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000017", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000119",
          "00000000-0000-4000-8000-000000000017",
        ),
      ],
    ).report;
    const right = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000017", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000119",
          "00000000-0000-4000-8000-000000000017",
        ),
      ],
    ).report;
    expectEqual(
      JSON.stringify(left),
      JSON.stringify(right),
      "analysis should be deterministic",
    );
  }

  {
    const simulation = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000018", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000120",
          "00000000-0000-4000-8000-000000000018",
        ),
      ],
    });
    expectEqual(
      simulation.report.writeAttempted,
      1,
      "apply should attempt one write for one unique candidate",
    );
    expectEqual(
      simulation.report.inserted,
      1,
      "apply should insert one new fact",
    );
    expectEqual(
      simulation.invocations.length,
      1,
      "writer should be called for apply mode",
    );
    expectEqual(
      simulation.invocations[0]?.writes.length,
      1,
      "native upsert path should receive one pending write",
    );
  }

  {
    const existingFactKeys = new Set<string>();
    const first = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000019", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000121",
          "00000000-0000-4000-8000-000000000019",
        ),
      ],
      existingFactKeys,
    });
    const second = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000019", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000121",
          "00000000-0000-4000-8000-000000000019",
        ),
      ],
      existingFactKeys: first.existingAfter,
    });
    expectEqual(first.report.inserted, 1, "first apply should insert");
    expectEqual(second.report.inserted, 0, "second apply should be idempotent");
    expectEqual(
      second.report.alreadyExisting,
      1,
      "second apply should classify the fact as already existing",
    );
    expectEqual(
      second.report.writeAttempted,
      0,
      "second apply should not attempt a new write",
    );
  }

  {
    const baseAnalysis = runAnalysis(
      [buildSnapshot("00000000-0000-4000-8000-000000000020", "api_audits")],
      [
        buildComparable(
          "00000000-0000-4000-8000-000000000122",
          "00000000-0000-4000-8000-000000000020",
        ),
      ],
    );
    const existing = new Set<string>([
      baseAnalysis.diagnostics?.preparedWrites[0]?.opaqueFactKeyPreview ?? "",
    ]);
    const simulation = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000020", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000122",
          "00000000-0000-4000-8000-000000000020",
        ),
      ],
      existingFactKeys: existing,
    });
    expectEqual(
      simulation.report.alreadyExisting,
      1,
      "pre-existing keys should be counted as already existing",
    );
    expectEqual(
      simulation.report.writeAttempted,
      0,
      "pre-existing keys should not be rewritten",
    );
  }

  {
    const simulation = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000021", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000123",
          "00000000-0000-4000-8000-000000000021",
        ),
      ],
      writer: (invocation) => ({
        rejected: 1,
        insertedKeys: [],
      }),
    });
    expectEqual(simulation.report.rejected, 1, "writer rejections should be counted");
    expectEqual(simulation.report.inserted, 0, "rejected rows should not insert");
  }

  {
    const simulation = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000022", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000124",
          "00000000-0000-4000-8000-000000000022",
        ),
      ],
      writer: () => ({
        fail: true,
      }),
    });
    expectEqual(simulation.report.failed, 1, "writer failures should be counted");
    expectEqual(simulation.report.inserted, 0, "failed writes should not insert");
  }

  {
    const dryRunOptions = parseMarketMemoryPricingBackfillCliArgs(["--dry-run"]);
    expectEqual(dryRunOptions.mode, "dry_run", "dry-run should not enable apply");
  }

  {
    const simulation = runApplySimulation({
      snapshots: [
        buildSnapshot("00000000-0000-4000-8000-000000000023", "api_audits"),
      ],
      comparables: [
        buildComparable(
          "00000000-0000-4000-8000-000000000125",
          "00000000-0000-4000-8000-000000000023",
        ),
      ],
    });
    const reportText = formatMarketMemoryPricingBackfillApplyReport(
      simulation.report,
      buildOptions({
        mode: "apply",
        confirmWrite: true,
        country: "ma",
        city: "marrakech",
        platform: "airbnb",
      }),
    );
    expect(
      !reportText.includes("https://example.com"),
      "apply report must not include URLs",
    );
    expect(
      !reportText.includes("Private title"),
      "apply report must not include titles",
    );
    expect(
      !reportText.includes("external-"),
      "apply report must not include private ids",
    );
  }

  {
    const writerSource = readFileSync(
      "lib/intelligenceV2/pricingFactWriter.ts",
      "utf8",
    );
    expect(
      writerSource.includes('.upsert(rows, {'),
      "writer should use native upsert",
    );
    expect(
      !writerSource.includes('.select("fact_key")') &&
        !writerSource.includes(".select('fact_key')"),
      "writer should not pre-read fact_key for idempotence",
    );
    expect(
      !writerSource.includes(".insert(row)"),
      "writer should not keep the non-atomic row-by-row fallback",
    );
  }

  {
    const parsed = parseMarketMemoryPricingBackfillCliArgs([]);
    expectEqual(parsed.mode, "dry_run", "dry-run should be the default");
    expectEqual(parsed.confirmWrite, false, "confirm-write should default to false");
    expectEqual(parsed.limit, null, "no limit should be accepted");
  }

  {
    const parsed = parseMarketMemoryPricingBackfillCliArgs([
      "--country=ma",
      "--city=marrakech",
      "--platform=airbnb",
      "--limit=1000",
      "--from=2026-01-01",
      "--to=2026-07-01",
      "--dry-run",
    ]);
    expectEqual(parsed.mode, "dry_run", "dry-run mode should parse");
    expectEqual(parsed.country, "ma", "country should parse");
    expectEqual(parsed.city, "marrakech", "city should parse");
    expectEqual(parsed.platform, "airbnb", "platform should parse");
    expectEqual(parsed.limit, 1000, "limit should parse");
  }

  expectThrows(
    () => parseMarketMemoryPricingBackfillCliArgs(["--from=2026-13-01"]),
    "`--from` must be a valid ISO date",
    "invalid from date should fail",
  );

  expectThrows(
    () =>
      parseMarketMemoryPricingBackfillCliArgs([
        "--snapshot-id=not-a-uuid",
      ]),
    "`--snapshot-id` must be a valid UUID.",
    "invalid UUID should fail",
  );

  expectThrows(
    () => parseMarketMemoryPricingBackfillCliArgs(["--apply"]),
    "Apply mode requires --confirm-write.",
    "--apply should require confirm-write",
  );

  expectThrows(
    () =>
      parseMarketMemoryPricingBackfillCliArgs([
        "--apply",
        "--confirm-write",
      ]),
    "Apply mode requires an explicit perimeter",
    "--apply should require explicit filters",
  );

  {
    const parsed = parseMarketMemoryPricingBackfillCliArgs([
      "--apply",
      "--confirm-write",
      "--country=ma",
      "--city=marrakech",
      "--platform=airbnb",
      "--limit=1000",
    ]);
    expectEqual(parsed.mode, "apply", "apply mode should parse");
    expectEqual(parsed.confirmWrite, true, "confirm-write should parse");
  }

  expectThrows(
    () =>
      parseMarketMemoryPricingBackfillCliArgs([
        "--dry-run",
        "--apply",
        "--confirm-write",
        "--country=ma",
        "--city=marrakech",
        "--platform=airbnb",
      ]),
    "`--dry-run` and `--apply` cannot be used together.",
    "dry-run and apply together should fail",
  );

  expectThrows(
    () => parseMarketMemoryPricingBackfillCliArgs(["--unknown=value"]),
    "Unknown argument",
    "unknown arguments should fail",
  );

  console.log("PASS — Market Memory pricing backfill apply smoke");
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown smoke failure.";
  console.error(message);
  process.exitCode = 1;
});
