import { createSupabaseAdminClient } from "../lib/supabase-admin";
import {
  buildPricingDistributionBenchmark,
  type PricingBenchmarkBuilderInput,
  type PricingBenchmarkBuilderResult,
} from "../lib/intelligenceV2/pricingBenchmarkBuilder";
import { getIntelligenceV2FeatureFlags } from "../lib/intelligenceV2/featureFlags";

type ScriptOptions = Readonly<{
  marketCellKey: string | null;
  capturePeriodBucket: string | null;
  limit: number | null;
  dryRun: boolean;
  force: boolean;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function parseArgs(argv: ReadonlyArray<string>): ScriptOptions {
  let marketCellKey: string | null = null;
  let capturePeriodBucket: string | null = null;
  let limit: number | null = null;
  let dryRun = true;
  let force = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--market-cell") {
      marketCellKey = argv[index + 1]?.trim() || null;
      index += 1;
      continue;
    }
    if (argument === "--period") {
      capturePeriodBucket = argv[index + 1]?.trim() || null;
      index += 1;
      continue;
    }
    if (argument === "--limit") {
      const parsed = Number(argv[index + 1]);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        fail("`--limit` must be a positive integer.");
      }
      limit = parsed;
      index += 1;
      continue;
    }
    if (argument === "--write") {
      dryRun = false;
      continue;
    }
    if (argument === "--force") {
      force = true;
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  return {
    marketCellKey,
    capturePeriodBucket,
    limit,
    dryRun,
    force,
  };
}

function validateSingleCellOptions(options: ScriptOptions): void {
  if (options.marketCellKey == null || options.capturePeriodBucket == null) {
    fail("Single-cell mode requires `--market-cell` and `--period`.");
  }
}

function validateBatchOptions(options: ScriptOptions): void {
  if (options.capturePeriodBucket == null || options.limit == null) {
    fail("Batch mode requires `--period` and `--limit`.");
  }
}

async function discoverTopCells(
  capturePeriodBucket: string,
  limit: number,
): Promise<ReadonlyArray<PricingBenchmarkBuilderInput>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("anonymous_fact_groups")
    .select("market_cell_key,capture_period_bucket")
    .eq("metric_family", "pricing")
    .eq("capture_period_bucket", capturePeriodBucket);

  if (error || !Array.isArray(data)) {
    fail("Unable to discover benchmark cells from anonymous_fact_groups.");
  }

  const counts = new Map<string, { marketCellKey: string; capturePeriodBucket: string; count: number }>();
  for (const row of data) {
    if (
      row &&
      typeof row === "object" &&
      typeof row.market_cell_key === "string" &&
      typeof row.capture_period_bucket === "string"
    ) {
      const key = `${row.market_cell_key}|${row.capture_period_bucket}`;
      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, {
          marketCellKey: row.market_cell_key,
          capturePeriodBucket: row.capture_period_bucket,
          count: 1,
        });
      }
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((row) => ({
      marketCellKey: row.marketCellKey,
      capturePeriodBucket: row.capturePeriodBucket,
    }));
}

function logResult(result: PricingBenchmarkBuilderResult): void {
  console.log(
    JSON.stringify(
      {
        status: result.status,
        marketCellKey: result.marketCellKey,
        capturePeriodBucket: result.capturePeriodBucket,
        rawSampleSize: result.rawSampleSize,
        includedSampleSize: result.includedSampleSize,
        excludedOutlierCount: result.excludedOutlierCount,
        sourceClassCount: result.sourceClassCount,
        sourceDiversityBand: result.sourceDiversityBand,
        p10Price: result.p10Price,
        p25Price: result.p25Price,
        medianPrice: result.medianPrice,
        p75Price: result.p75Price,
        p90Price: result.p90Price,
        confidenceLevel: result.confidenceLevel,
        approvalStatus: result.approvalStatus,
        limitations: result.limitations,
        artifactKey: result.artifactKey,
        inserted: result.inserted,
        supersedesArtifactId: result.supersedesArtifactId,
        reasonCodes: result.reasonCodes,
      },
      null,
      2,
    ),
  );
}

async function runSingleCell(options: ScriptOptions): Promise<PricingBenchmarkBuilderResult[]> {
  validateSingleCellOptions(options);
  return [
    await buildPricingDistributionBenchmark({
      marketCellKey: options.marketCellKey!,
      capturePeriodBucket: options.capturePeriodBucket!,
      dryRun: options.dryRun,
      force: options.force,
    }),
  ];
}

async function runBatch(options: ScriptOptions): Promise<PricingBenchmarkBuilderResult[]> {
  validateBatchOptions(options);
  const cells = await discoverTopCells(options.capturePeriodBucket!, options.limit!);
  const results: PricingBenchmarkBuilderResult[] = [];

  for (const cell of cells) {
    results.push(
      await buildPricingDistributionBenchmark({
        marketCellKey: cell.marketCellKey,
        capturePeriodBucket: cell.capturePeriodBucket,
        dryRun: options.dryRun,
        force: options.force,
      }),
    );
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const flags = getIntelligenceV2FeatureFlags();

  if (!options.dryRun && !flags.ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION) {
    fail(
      "Cannot run with `--write` while ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION is disabled.",
    );
  }

  const results =
    options.marketCellKey != null
      ? await runSingleCell(options)
      : await runBatch(options);

  for (const result of results) {
    logResult(result);
  }

  if (results.some((result) => result.status === "failed" || result.status === "disabled")) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
