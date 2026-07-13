import {
  buildPricingDistributionBenchmark,
  type PricingBenchmarkBuilderResult,
} from "./pricingBenchmarkBuilder";
import {
  buildOccupancyDistributionBenchmark,
  type OccupancyBenchmarkBuilderResult,
} from "./occupancyBenchmarkBuilder";

export type BenchmarkMetric =
  | "pricing"
  | "occupancy";

export type BenchmarkRuntimeInput = Readonly<{
  metric: BenchmarkMetric;
  marketCellKey: string;
  capturePeriodBucket: string;
  dryRun?: boolean;
  force?: boolean;
}>;

export type BenchmarkRuntimeDependencies = Readonly<{
  pricingBuilder?: typeof buildPricingDistributionBenchmark;
  occupancyBuilder?: typeof buildOccupancyDistributionBenchmark;
}>;

export type BenchmarkRuntimeResult =
  | Readonly<{
      metric: "pricing";
      result: PricingBenchmarkBuilderResult;
    }>
  | Readonly<{
      metric: "occupancy";
      result: OccupancyBenchmarkBuilderResult;
    }>;

export async function runBenchmarkRuntime(
  input: BenchmarkRuntimeInput,
  dependencies: BenchmarkRuntimeDependencies = {},
): Promise<BenchmarkRuntimeResult> {
  if (input.metric === "pricing") {
    const pricingBuilder =
      dependencies.pricingBuilder ??
      buildPricingDistributionBenchmark;
    const result = await pricingBuilder({
      marketCellKey: input.marketCellKey,
      capturePeriodBucket: input.capturePeriodBucket,
      dryRun: input.dryRun,
      force: input.force,
    });

    return {
      metric: "pricing",
      result,
    };
  }

  const occupancyBuilder =
    dependencies.occupancyBuilder ??
    buildOccupancyDistributionBenchmark;
  const result = await occupancyBuilder({
    marketCellKey: input.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    dryRun: input.dryRun,
    force: input.force,
  });

  return {
    metric: "occupancy",
    result,
  };
}
