import { createSupabaseAdminClient } from "../supabase-admin";
import {
  getIntelligenceV2FeatureFlags,
  type IntelligenceV2FeatureFlags,
} from "./featureFlags";
import {
  runBenchmarkRuntime,
  type BenchmarkMetric,
  type BenchmarkRuntimeResult,
} from "./benchmarkRuntime";

const MONTH_BUCKET_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export type BenchmarkCliOptions = Readonly<{
  metric: BenchmarkMetric | null;
  marketCellKey: string | null;
  capturePeriodBucket: string | null;
  limit: number | null;
  dryRun: boolean;
  force: boolean;
}>;

export type BenchmarkDiscoveryInput = Readonly<{
  metric: BenchmarkMetric;
  capturePeriodBucket: string;
  limit: number;
}>;

export type BenchmarkDiscoveredCell = Readonly<{
  marketCellKey: string;
  capturePeriodBucket: string;
}>;

export type BenchmarkCliDependencies = Readonly<{
  runtime?: typeof runBenchmarkRuntime;
  discoverCells?: (
    input: BenchmarkDiscoveryInput,
  ) => Promise<ReadonlyArray<BenchmarkDiscoveredCell>>;
  getFlags?: typeof getIntelligenceV2FeatureFlags;
}>;

export type BenchmarkCliExecutionResult = Readonly<{
  results: ReadonlyArray<BenchmarkRuntimeResult>;
  exitCode: 0 | 1;
}>;

type DiscoveryRow = Readonly<{
  market_cell_key?: unknown;
  capture_period_bucket?: unknown;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function requireArgumentValue(
  argv: ReadonlyArray<string>,
  index: number,
  argument: string,
): string {
  const value = argv[index + 1];
  if (typeof value !== "string") {
    fail(`Missing value after \`${argument}\`.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(`Missing value after \`${argument}\`.`);
  }

  return trimmed;
}

function parseMetric(value: string): BenchmarkMetric {
  if (value === "pricing" || value === "occupancy") {
    return value;
  }

  fail("`--metric` must be either `pricing` or `occupancy`.");
}

function assertValidPeriod(value: string): void {
  if (!MONTH_BUCKET_REGEX.test(value)) {
    fail("`--period` must match YYYY-MM.");
  }
}

function computeExitCode(
  results: ReadonlyArray<BenchmarkRuntimeResult>,
): 0 | 1 {
  return results.some(
    (entry) =>
      entry.result.status === "failed" ||
      entry.result.status === "disabled",
  )
    ? 1
    : 0;
}

export function parseBenchmarkCliArgs(
  argv: ReadonlyArray<string>,
): BenchmarkCliOptions {
  let metric: BenchmarkMetric | null = null;
  let marketCellKey: string | null = null;
  let capturePeriodBucket: string | null = null;
  let limit: number | null = null;
  let dryRun = true;
  let force = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--metric") {
      metric = parseMetric(
        requireArgumentValue(argv, index, argument),
      );
      index += 1;
      continue;
    }

    if (argument === "--market-cell") {
      marketCellKey = requireArgumentValue(
        argv,
        index,
        argument,
      );
      index += 1;
      continue;
    }

    if (argument === "--period") {
      capturePeriodBucket = requireArgumentValue(
        argv,
        index,
        argument,
      );
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      const parsed = Number(
        requireArgumentValue(argv, index, argument),
      );
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
    metric,
    marketCellKey,
    capturePeriodBucket,
    limit,
    dryRun,
    force,
  };
}

export function validateBenchmarkCliOptions(
  options: BenchmarkCliOptions,
): void {
  if (options.marketCellKey != null) {
    if (options.metric == null) {
      fail(
        "Single-cell mode requires `--metric`, `--market-cell`, and `--period`.",
      );
    }

    if (options.capturePeriodBucket == null) {
      fail(
        "Single-cell mode requires `--metric`, `--market-cell`, and `--period`.",
      );
    }

    if (options.limit != null) {
      fail("Single-cell mode does not allow `--limit`.");
    }

    assertValidPeriod(options.capturePeriodBucket);
    return;
  }

  if (options.metric == null || options.capturePeriodBucket == null) {
    fail(
      "Batch mode requires `--metric`, `--period`, and `--limit`.",
    );
  }

  if (options.limit == null) {
    fail(
      "Batch mode requires `--metric`, `--period`, and `--limit`.",
    );
  }

  assertValidPeriod(options.capturePeriodBucket);
}

export async function discoverBenchmarkCells(
  input: BenchmarkDiscoveryInput,
): Promise<ReadonlyArray<BenchmarkDiscoveredCell>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("anonymous_fact_groups")
    .select("market_cell_key,capture_period_bucket")
    .eq("metric_family", input.metric)
    .eq("capture_period_bucket", input.capturePeriodBucket);

  if (error || !Array.isArray(data)) {
    fail(
      "Unable to discover benchmark cells from anonymous_fact_groups.",
    );
  }

  const counts = new Map<
    string,
    BenchmarkDiscoveredCell & Readonly<{ count: number }>
  >();

  for (const row of data as ReadonlyArray<DiscoveryRow>) {
    if (
      typeof row.market_cell_key !== "string" ||
      typeof row.capture_period_bucket !== "string"
    ) {
      continue;
    }

    const key = `${row.market_cell_key}|${row.capture_period_bucket}`;
    const current = counts.get(key);

    if (current) {
      counts.set(key, {
        ...current,
        count: current.count + 1,
      });
      continue;
    }

    counts.set(key, {
      marketCellKey: row.market_cell_key,
      capturePeriodBucket: row.capture_period_bucket,
      count: 1,
    });
  }

  return [...counts.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.marketCellKey.localeCompare(
        right.marketCellKey,
      );
    })
    .slice(0, input.limit)
    .map((cell) => ({
      marketCellKey: cell.marketCellKey,
      capturePeriodBucket: cell.capturePeriodBucket,
    }));
}

export async function executeBenchmarkCli(
  options: BenchmarkCliOptions,
  dependencies: BenchmarkCliDependencies = {},
): Promise<BenchmarkCliExecutionResult> {
  validateBenchmarkCliOptions(options);

  if (options.dryRun === false) {
    const getFlags =
      dependencies.getFlags ??
      getIntelligenceV2FeatureFlags;
    const flags: IntelligenceV2FeatureFlags = getFlags();

    if (!flags.ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION) {
      fail(
        "Cannot run with `--write` while ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION is disabled.",
      );
    }
  }

  const runtime =
    dependencies.runtime ??
    runBenchmarkRuntime;
  const results: BenchmarkRuntimeResult[] = [];

  if (options.marketCellKey != null) {
    results.push(
      await runtime({
        metric: options.metric!,
        marketCellKey: options.marketCellKey,
        capturePeriodBucket: options.capturePeriodBucket!,
        dryRun: options.dryRun,
        force: options.force,
      }),
    );

    return {
      results,
      exitCode: computeExitCode(results),
    };
  }

  const discoverCells =
    dependencies.discoverCells ??
    discoverBenchmarkCells;
  const cells = await discoverCells({
    metric: options.metric!,
    capturePeriodBucket: options.capturePeriodBucket!,
    limit: options.limit!,
  });

  for (const cell of cells) {
    results.push(
      await runtime({
        metric: options.metric!,
        marketCellKey: cell.marketCellKey,
        capturePeriodBucket: cell.capturePeriodBucket,
        dryRun: options.dryRun,
        force: options.force,
      }),
    );
  }

  return {
    results,
    exitCode: computeExitCode(results),
  };
}

export async function runBenchmarkCli(
  argv: ReadonlyArray<string>,
  dependencies: BenchmarkCliDependencies = {},
): Promise<BenchmarkCliExecutionResult> {
  const options = parseBenchmarkCliArgs(argv);
  return executeBenchmarkCli(options, dependencies);
}
