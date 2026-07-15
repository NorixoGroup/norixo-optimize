import assert from "node:assert/strict";

import {
  buildPublicMarketOverviewBackfill,
  parsePublicMarketOverviewCliArgs,
  type PublicMarketOverviewBackfillOptions,
} from "../lib/intelligenceV2/publicMarketOverviewBackfill";
import type { PublicMarketOverviewFactRow } from "../lib/intelligenceV2/publicMarketOverviewBuilder";

function buildRow(
  overrides: Partial<PublicMarketOverviewFactRow> = {},
): PublicMarketOverviewFactRow {
  return {
    country: "ma",
    city: "marrakech",
    platform: "airbnb",
    property_type: "apartment",
    capacity_band: "unknown",
    currency: "EUR",
    market_cell_key: "v1|ma|marrakech|airbnb|apartment|unknown|eur",
    normalized_nightly_price: 120,
    source_class: "authenticated_audit",
    capture_period_bucket: "2026-06",
    created_at: "2026-06-15T00:00:00.000Z",
    fact_contract_version: "v1",
    transformation_policy_version: "v1",
    eligibility_policy_version: "v1",
    deduplication_policy_version: "v1",
    market_cell_policy_version: "v1",
    confidence_policy_version: "v1",
    freshness_policy_version: "v1",
    pricing_normalization_policy_version: "v1",
    ...overrides,
  };
}

function buildRows(input: {
  count: number;
  propertyType?: string;
  currency?: string;
  sourceClasses?: string[];
  periods?: string[];
  priceStart?: number;
}): PublicMarketOverviewFactRow[] {
  const sourceClasses = input.sourceClasses ?? ["authenticated_audit"];
  const periods = input.periods ?? ["2026-05", "2026-06", "2026-07"];

  return Array.from({ length: input.count }, (_, index) =>
    buildRow({
      property_type: input.propertyType ?? "apartment",
      currency: input.currency ?? "EUR",
      normalized_nightly_price: (input.priceStart ?? 100) + index * 5,
      source_class: sourceClasses[index % sourceClasses.length] ?? sourceClasses[0]!,
      capture_period_bucket: periods[index % periods.length] ?? periods[0]!,
      created_at:
        periods[index % periods.length] === "2026-05"
          ? "2026-05-20T00:00:00.000Z"
          : periods[index % periods.length] === "2026-06"
            ? "2026-06-20T00:00:00.000Z"
            : "2026-07-10T00:00:00.000Z",
      market_cell_key: `v1|ma|marrakech|airbnb|${input.propertyType ?? "apartment"}|unknown|${(input.currency ?? "EUR").toLowerCase()}`,
    }),
  );
}

function createInMemoryStore() {
  const rows = new Map<string, { id: string }>();
  let idCounter = 0;

  return {
    size() {
      return rows.size;
    },
    async queryArtifactByKey(artifactKey: string) {
      return {
        ok: true as const,
        id: rows.get(artifactKey)?.id ?? null,
      };
    },
    async insertArtifact(payload: { artifact_key: string }) {
      if (rows.has(payload.artifact_key)) {
        return true;
      }
      idCounter += 1;
      rows.set(payload.artifact_key, { id: `artifact-${idCounter}` });
      return true;
    },
  };
}

async function runBackfill(
  options: PublicMarketOverviewBackfillOptions,
  rows: ReadonlyArray<PublicMarketOverviewFactRow>,
  overrides: Partial<Parameters<typeof buildPublicMarketOverviewBackfill>[1]> = {},
) {
  return buildPublicMarketOverviewBackfill(options, {
    now: () => new Date("2026-07-15T13:42:00.000Z"),
    loadFacts: async () => ({ ok: true, rows }),
    ...overrides,
  });
}

async function main() {
  const invalidApply = parsePublicMarketOverviewCliArgs([
    "--apply",
    "--country=ma",
    "--city=marrakech",
    "--platform=airbnb",
  ]);
  assert.equal(invalidApply.ok, false);

  const missingFilters = parsePublicMarketOverviewCliArgs([
    "--apply",
    "--confirm-write",
  ]);
  assert.equal(missingFilters.ok, false);

  const conflictingModes = parsePublicMarketOverviewCliArgs([
    "--dry-run",
    "--apply",
  ]);
  assert.equal(conflictingModes.ok, false);

  const dryRunStore = createInMemoryStore();
  const dryRunResult = await runBackfill(
    {
      mode: "dry_run",
      confirmWrite: false,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    buildRows({
      count: 18,
      sourceClasses: ["authenticated_audit", "authenticated_listing"],
    }),
    {
      queryArtifactByKey: dryRunStore.queryArtifactByKey,
      insertArtifact: dryRunStore.insertArtifact,
    },
  );
  assert.equal(dryRunResult.ok, true);
  if (dryRunResult.ok) {
    assert.equal(dryRunStore.size(), 0);
    assert.equal(dryRunResult.insertedCount, 0);
  }

  const exactInsufficientRows = [
    ...buildRows({ count: 14, propertyType: "apartment", priceStart: 100 }),
    ...buildRows({ count: 3, propertyType: "villa", priceStart: 500 }),
  ];
  const oneWriteStore = createInMemoryStore();
  const oneWriteResult = await runBackfill(
    {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    exactInsufficientRows,
    {
      queryArtifactByKey: oneWriteStore.queryArtifactByKey,
      insertArtifact: oneWriteStore.insertArtifact,
    },
  );
  assert.equal(oneWriteResult.ok, true);
  if (oneWriteResult.ok) {
    assert.equal(oneWriteResult.insertedCount, 1);
    assert.equal(oneWriteStore.size(), 1);
    const statuses = oneWriteResult.candidates.map((candidate) => candidate.status);
    assert.deepEqual(statuses, ["not_public", "inserted"]);
  }

  const twoWriteRows = [
    ...buildRows({
      count: 30,
      propertyType: "apartment",
      sourceClasses: ["authenticated_audit", "authenticated_listing"],
      priceStart: 110,
    }),
    ...buildRows({
      count: 5,
      propertyType: "villa",
      sourceClasses: ["authenticated_audit", "authenticated_listing"],
      priceStart: 450,
    }),
  ];
  const twoWriteStore = createInMemoryStore();
  const twoWriteResult = await runBackfill(
    {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    twoWriteRows,
    {
      queryArtifactByKey: twoWriteStore.queryArtifactByKey,
      insertArtifact: twoWriteStore.insertArtifact,
    },
  );
  assert.equal(twoWriteResult.ok, true);
  if (twoWriteResult.ok) {
    assert.equal(twoWriteResult.insertedCount, 2);
    assert.equal(twoWriteStore.size(), 2);
    assert.notEqual(
      twoWriteResult.candidates[0]?.artifactKey,
      twoWriteResult.candidates[1]?.artifactKey,
    );
    for (const candidate of twoWriteResult.candidates) {
      assert.equal(candidate.persistableArtifact?.approved_for_audit, false);
      assert.equal(
        candidate.persistableArtifact?.intended_use,
        "public_market_overview",
      );
      assert.equal(
        candidate.persistableArtifact?.aggregation_window,
        "rolling_90_days",
      );
      assert.equal(
        candidate.persistableArtifact?.capacity_scope,
        "all_capacities",
      );
    }
  }

  const idempotentStore = createInMemoryStore();
  const firstApply = await runBackfill(
    {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    twoWriteRows,
    {
      queryArtifactByKey: idempotentStore.queryArtifactByKey,
      insertArtifact: idempotentStore.insertArtifact,
    },
  );
  const secondApply = await runBackfill(
    {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    twoWriteRows,
    {
      queryArtifactByKey: idempotentStore.queryArtifactByKey,
      insertArtifact: idempotentStore.insertArtifact,
    },
  );
  assert.equal(firstApply.ok, true);
  assert.equal(secondApply.ok, true);
  if (firstApply.ok && secondApply.ok) {
    assert.equal(firstApply.insertedCount, 2);
    assert.equal(secondApply.insertedCount, 0);
    assert.equal(secondApply.alreadyExistingCount, 2);
    assert.equal(idempotentStore.size(), 2);
    assert.deepEqual(
      firstApply.candidates.map((candidate) => candidate.artifactKey),
      secondApply.candidates.map((candidate) => candidate.artifactKey),
    );
  }

  const multiCurrency = await runBackfill(
    {
      mode: "dry_run",
      confirmWrite: false,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: null,
      windowDays: 90,
      limit: null,
    },
    [
      ...buildRows({ count: 18, currency: "EUR", priceStart: 100 }),
      ...buildRows({ count: 18, currency: "USD", priceStart: 200 }),
    ],
  );
  assert.equal(multiCurrency.ok, true);
  if (multiCurrency.ok) {
    assert.deepEqual(
      [...new Set(multiCurrency.candidates.map((candidate) => candidate.currency))],
      ["EUR", "USD"],
    );
  }

  const notPublic = await runBackfill(
    {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    buildRows({ count: 10, periods: ["2026-07"] }),
    {
      queryArtifactByKey: async () => ({ ok: true as const, id: null }),
      insertArtifact: async () => {
        throw new Error("insertArtifact should not be called for not_public");
      },
    },
  );
  assert.equal(notPublic.ok, true);
  if (notPublic.ok) {
    assert.equal(notPublic.insertedCount, 0);
    assert.equal(
      notPublic.candidates.every((candidate) => candidate.status === "not_public"),
      true,
    );
  }

  const dbFailure = await runBackfill(
    {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    buildRows({
      count: 18,
      sourceClasses: ["authenticated_audit", "authenticated_listing"],
    }),
    {
      queryArtifactByKey: async () => ({ ok: true as const, id: null }),
      insertArtifact: async () => false,
    },
  );
  assert.equal(dbFailure.ok, true);
  if (dbFailure.ok) {
    assert.equal(dbFailure.failedCount, 2);
    assert.equal(
      dbFailure.candidates.every((candidate) => candidate.status === "failed"),
      true,
    );
  }

  const stableKeysA = await runBackfill(
    {
      mode: "dry_run",
      confirmWrite: false,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    twoWriteRows,
  );
  const stableKeysB = await runBackfill(
    {
      mode: "dry_run",
      confirmWrite: false,
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      windowDays: 90,
      limit: null,
    },
    twoWriteRows,
  );
  assert.equal(stableKeysA.ok, true);
  assert.equal(stableKeysB.ok, true);
  if (stableKeysA.ok && stableKeysB.ok) {
    assert.deepEqual(
      stableKeysA.candidates.map((candidate) => candidate.artifactKey),
      stableKeysB.candidates.map((candidate) => candidate.artifactKey),
    );
    const serialized = JSON.stringify(stableKeysA);
    assert.equal(serialized.includes("\"fact_key\""), false);
    assert.equal(serialized.includes("observation"), false);
  }

  const noPrivateSelectorImport = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      "lib/intelligenceV2/publicMarketOverviewBackfill.ts",
      "utf8",
    ),
  );
  assert.equal(
    noPrivateSelectorImport.includes("pricingBenchmarkEvidenceSelector"),
    false,
  );
  assert.equal(noPrivateSelectorImport.includes("lib/freeAudit"), false);

  console.info("PASS — Public market overview backfill smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
