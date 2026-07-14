import { createSupabaseAdminClient } from "../lib/supabase-admin";
import {
  formatMarketMemoryPricingBackfillDryRunReport,
  parseMarketMemoryPricingBackfillCliArgs,
  runMarketMemoryPricingBackfillDryRun,
  type MarketMemoryPricingBackfillCliOptions,
  type MarketMemoryPricingBackfillComparableRow,
  type MarketMemoryPricingBackfillSnapshotRow,
} from "../lib/intelligenceV2/marketMemoryPricingBackfill";

const SNAPSHOT_PAGE_SIZE = 500;
const COMPARABLE_PAGE_SIZE = 500;
const SNAPSHOT_ID_CHUNK_SIZE = 200;

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
      throw new Error(
        `Unable to read market_snapshots: ${error.message}`,
      );
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

  for (
    let chunkStart = 0;
    chunkStart < snapshotIds.length;
    chunkStart += SNAPSHOT_ID_CHUNK_SIZE
  ) {
    const chunk = snapshotIds.slice(
      chunkStart,
      chunkStart + SNAPSHOT_ID_CHUNK_SIZE,
    );

    for (let offset = 0; ; offset += COMPARABLE_PAGE_SIZE) {
      const { data, error } = await admin
        .from("market_comparables")
        .select(
          "id,snapshot_id,platform,city,country,property_type,nightly_price,currency,created_at,raw,url,title,latitude,longitude",
        )
        .in("snapshot_id", chunk)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + COMPARABLE_PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `Unable to read market_comparables: ${error.message}`,
        );
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

async function main() {
  const options = parseMarketMemoryPricingBackfillCliArgs(
    process.argv.slice(2),
  );
  const snapshots = await loadSnapshots(options);
  const comparables = await loadComparablesForSnapshotIds(
    snapshots.map((snapshot) => snapshot.id),
  );
  const report = runMarketMemoryPricingBackfillDryRun({
    options,
    snapshots,
    comparables,
    identityEnv: process.env,
  });

  console.log(formatMarketMemoryPricingBackfillDryRunReport(report, options));
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown dry-run failure.";
  console.error(message);
  process.exitCode = 1;
});
