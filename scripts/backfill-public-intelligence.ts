import {
  formatPublicIntelligenceBackfillResult,
  parsePublicIntelligenceBackfillCliArgs,
  runPublicIntelligenceBackfill,
} from "../lib/intelligenceV2/publicIntelligenceBackfill";

async function main() {
  const parsed = parsePublicIntelligenceBackfillCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }

  const result = await runPublicIntelligenceBackfill(parsed.options);
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.info(formatPublicIntelligenceBackfillResult(result));
  if (result.marketsFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
