import { createSupabaseAdminClient } from "../lib/supabase-admin";
import {
  buildMarketMemoryPricingBackfillApplyReport,
  analyzeMarketMemoryPricingBackfillDryRun,
  formatMarketMemoryPricingBackfillApplyReport,
  formatMarketMemoryPricingBackfillDryRunReport,
  parseMarketMemoryPricingBackfillCliArgs,
  type MarketMemoryPricingBackfillCliOptions,
  type MarketMemoryPricingBackfillComparableRow,
  type MarketMemoryPricingBackfillPreparedWrite,
  type MarketMemoryPricingBackfillSnapshotRow,
  type MarketMemoryPricingBackfillSourceClass,
} from "../lib/intelligenceV2/marketMemoryPricingBackfill";
import { writeAnonymousPricingFacts } from "../lib/intelligenceV2/pricingFactWriter";

const SNAPSHOT_PAGE_SIZE = 500;
const COMPARABLE_PAGE_SIZE = 500;
const SNAPSHOT_ID_CHUNK_SIZE = 200;
const FACT_KEY_CHUNK_SIZE = 200;
const WRITE_BATCH_SIZE = 100;

function applySnapshotFilters(
  query: any,
  options: MarketMemoryPricingBackfillCliOptions,
) {
  let current = query;

  if (options.snapshotId != null) {
    current = current.eq("id", options.snapshotId);
  }

  if (options.from != null) {
    current = current.gte("created_at", `${options.from}T00:00:00.000Z`);
  }

  if (options.to != null) {
    current = current.lte("created_at", `${options.to}T23:59:59.999Z`);
  }

  if (options.platform != null) {
    current = current.eq("platform", options.platform.trim().toLowerCase());
  }

  return current;
}

function chunkValues<T>(
  values: ReadonlyArray<T>,
  size: number,
): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function buildAdministrativeWriterEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    ENABLE_INTELLIGENCE_FACT_TRANSFORMATION: "true",
    ENABLE_INTELLIGENCE_FACT_CONTRIBUTION: "true",
  };
}

async function loadSnapshots(
  options: MarketMemoryPricingBackfillCliOptions,
): Promise<ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>> {
  const admin = createSupabaseAdminClient();
  const rows: MarketMemoryPricingBackfillSnapshotRow[] = [];

  for (let offset = 0; ; offset += SNAPSHOT_PAGE_SIZE) {
    const query = admin
      .from("market_snapshots")
      .select("id,country,city,platform,property_type,created_at,metadata")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + SNAPSHOT_PAGE_SIZE - 1);

    const { data, error } = await applySnapshotFilters(query, options);

    if (error) {
      throw new Error(`Unable to read market_snapshots: ${error.message}`);
    }

    const page = Array.isArray(data)
      ? (data as MarketMemoryPricingBackfillSnapshotRow[])
      : [];
    rows.push(...page);

    if (page.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadComparablesForSnapshotIds(
  snapshotIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<MarketMemoryPricingBackfillComparableRow>> {
  if (snapshotIds.length === 0) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const rows: MarketMemoryPricingBackfillComparableRow[] = [];

  for (const chunk of chunkValues(snapshotIds, SNAPSHOT_ID_CHUNK_SIZE)) {
    for (let offset = 0; ; offset += COMPARABLE_PAGE_SIZE) {
      const { data, error } = await admin
        .from("market_comparables")
        .select(
          "id,snapshot_id,platform,city,country,property_type,nightly_price,currency,created_at,raw,url,title,latitude,longitude",
        )
        .in("snapshot_id", [...chunk])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + COMPARABLE_PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Unable to read market_comparables: ${error.message}`);
      }

      const page = Array.isArray(data)
        ? (data as MarketMemoryPricingBackfillComparableRow[])
        : [];
      rows.push(...page);

      if (page.length < COMPARABLE_PAGE_SIZE) {
        break;
      }
    }
  }

  return rows;
}

async function queryExistingFactKeys(
  factKeys: ReadonlyArray<string>,
): Promise<Set<string>> {
  if (factKeys.length === 0) {
    return new Set<string>();
  }

  const admin = createSupabaseAdminClient();
  const existing = new Set<string>();

  for (const chunk of chunkValues(factKeys, FACT_KEY_CHUNK_SIZE)) {
    const { data, error } = await admin
      .from("anonymous_fact_groups")
      .select("fact_key")
      .in("fact_key", [...chunk]);

    if (error) {
      throw new Error(
        `Unable to read anonymous_fact_groups: ${error.message}`,
      );
    }

    for (const row of Array.isArray(data) ? data : []) {
      if (typeof row.fact_key === "string") {
        existing.add(row.fact_key);
      }
    }
  }

  return existing;
}

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

async function applyPreparedWrites(
  preparedWrites: ReadonlyArray<MarketMemoryPricingBackfillPreparedWrite>,
): Promise<{
  writeAttempted: number;
  inserted: number;
  alreadyExisting: number;
  rejected: number;
}> {
  const allFactKeys = preparedWrites.map(
    (preparedWrite) => preparedWrite.opaqueFactKeyPreview,
  );
  const existingBefore = await queryExistingFactKeys(allFactKeys);
  const pendingWrites = preparedWrites.filter(
    (preparedWrite) =>
      !existingBefore.has(preparedWrite.opaqueFactKeyPreview),
  );
  const grouped = groupPreparedWritesBySourceClass(pendingWrites);
  let rejected = 0;

  for (const [sourceClass, writes] of grouped) {
    for (const batch of chunkValues(writes, WRITE_BATCH_SIZE)) {
      const result = await writeAnonymousPricingFacts(
        {
          sourceClass,
          collectionMode: "live",
          observations: batch.map((entry) => entry.observation),
        },
        {
          env: buildAdministrativeWriterEnv(),
        },
      );

      rejected += result.rejected;
    }
  }

  const existingAfter = await queryExistingFactKeys(allFactKeys);
  let inserted = 0;
  for (const factKey of existingAfter) {
    if (!existingBefore.has(factKey)) {
      inserted += 1;
    }
  }

  return {
    writeAttempted: pendingWrites.length,
    inserted,
    alreadyExisting: existingBefore.size,
    rejected,
  };
}

async function main() {
  const options = parseMarketMemoryPricingBackfillCliArgs(
    process.argv.slice(2),
  );
  const snapshots = await loadSnapshots(options);
  const comparables = await loadComparablesForSnapshotIds(
    snapshots.map((snapshot) => snapshot.id),
  );
  const analysis = analyzeMarketMemoryPricingBackfillDryRun({
    options,
    snapshots,
    comparables,
    identityEnv: process.env,
    includeDiagnostics: options.mode === "apply",
  });

  if (options.mode === "dry_run") {
    console.log(
      formatMarketMemoryPricingBackfillDryRunReport(
        analysis.report,
        options,
      ),
    );
    return;
  }

  const preparedWrites = analysis.diagnostics?.preparedWrites ?? [];
  const applyResult = await applyPreparedWrites(preparedWrites);
  const applyReport = buildMarketMemoryPricingBackfillApplyReport({
    dryRunReport: analysis.report,
    writeAttempted: applyResult.writeAttempted,
    inserted: applyResult.inserted,
    alreadyExisting: applyResult.alreadyExisting,
    rejected: applyResult.rejected,
  });

  console.log(
    formatMarketMemoryPricingBackfillApplyReport(applyReport, options),
  );

  if (applyReport.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown backfill failure.";
  console.error(message);
  process.exitCode = 1;
});
