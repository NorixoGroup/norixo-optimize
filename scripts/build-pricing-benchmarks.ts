import { createSupabaseAdminClient } from "../lib/supabase-admin";
import {
  formatPricingBenchmarkBackfillApplyReport,
  formatPricingBenchmarkBackfillDryRunReport,
  parsePricingBenchmarkBackfillCliArgs,
  runPricingBenchmarkBackfillApply,
  runPricingBenchmarkBackfillDryRun,
  type PricingBenchmarkBackfillFactRow,
} from "../lib/intelligenceV2/pricingBenchmarkBackfill";

const PAGE_SIZE = 1000;

async function loadRows(): Promise<ReadonlyArray<PricingBenchmarkBackfillFactRow>> {
  const admin = createSupabaseAdminClient();
  const rows: PricingBenchmarkBackfillFactRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from("anonymous_fact_groups")
      .select(
        [
          "market_cell_key",
          "country",
          "city",
          "platform",
          "property_type",
          "capacity_band",
          "currency",
          "capture_period_bucket",
          "normalized_nightly_price",
          "source_class",
          "confidence_input_band",
          "freshness_input_band",
          "transformation_policy_version",
          "created_at",
          "fact_contract_version",
          "eligibility_policy_version",
          "deduplication_policy_version",
          "market_cell_policy_version",
          "pricing_normalization_policy_version",
          "confidence_policy_version",
          "freshness_policy_version",
          "source_quality_band",
        ].join(","),
      )
      .eq("metric_family", "pricing")
      .order("capture_period_bucket", { ascending: true })
      .order("market_cell_key", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Unable to read anonymous_fact_groups pricing facts: ${error.message}`,
      );
    }

    const page = Array.isArray(data)
      ? (data as unknown as PricingBenchmarkBackfillFactRow[])
      : [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function main() {
  const options = parsePricingBenchmarkBackfillCliArgs(process.argv.slice(2));
  const rows = await loadRows();

  if (options.mode === "dry_run") {
    const report = await runPricingBenchmarkBackfillDryRun({
      options,
      rows,
      env: process.env,
    });
    console.log(formatPricingBenchmarkBackfillDryRunReport(report));
    return;
  }

  const report = await runPricingBenchmarkBackfillApply({
    options,
    rows,
    env: process.env,
  });
  console.log(formatPricingBenchmarkBackfillApplyReport(report));
  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
