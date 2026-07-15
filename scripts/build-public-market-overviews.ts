import {
  buildPublicMarketOverviewBackfill,
  parsePublicMarketOverviewCliArgs,
  type PublicMarketOverviewBackfillCandidate,
} from "../lib/intelligenceV2/publicMarketOverviewBackfill";

function formatRequestedPropertyType(
  candidate: PublicMarketOverviewBackfillCandidate,
): string {
  return candidate.requestedPropertyType ?? "all";
}

function printCandidate(candidate: PublicMarketOverviewBackfillCandidate): void {
  console.info(`Scope: ${candidate.scope}`);
  console.info(
    `Market: ${candidate.country} / ${candidate.city} / ${candidate.platform}`,
  );
  console.info(
    `Requested property type: ${formatRequestedPropertyType(candidate)}`,
  );
  console.info(`Currency: ${candidate.currency}`);
  console.info("Window: rolling_90_days");
  console.info(`Window start: ${candidate.windowStartedAt}`);
  console.info(`Window end: ${candidate.windowEndedAt}`);
  console.info(`Facts included: ${candidate.factsIncluded}`);
  console.info(`Capture periods: ${candidate.capturePeriods.length}`);
  console.info(`Source classes: ${candidate.sourceClasses.length}`);
  if (candidate.p25 != null) {
    console.info(`P25: ${candidate.p25}`);
  }
  if (candidate.median != null) {
    console.info(`Median: ${candidate.median}`);
  }
  if (candidate.p75 != null) {
    console.info(`P75: ${candidate.p75}`);
  }
  if (candidate.sampleBand != null) {
    console.info(`Sample band: ${candidate.sampleBand}`);
  }
  if (candidate.confidence != null) {
    console.info(`Confidence: ${candidate.confidence}`);
  }
  if (candidate.exposureStatus != null) {
    console.info(`Exposure: ${candidate.exposureStatus}`);
  }
  if (candidate.limitationCodes.length > 0) {
    console.info("Limitations:");
    for (const limitation of candidate.limitationCodes) {
      console.info(`- ${limitation}`);
    }
  } else {
    console.info("Limitations: none");
  }
  if (candidate.reasonCodes.length > 0) {
    console.info("Reason codes:");
    for (const reasonCode of candidate.reasonCodes) {
      console.info(`- ${reasonCode}`);
    }
  }
  console.info(`Would write: ${candidate.wouldWrite ? "yes" : "no"}`);
  console.info(`Status: ${candidate.status}`);
  console.info("");
}

async function main() {
  const parsed = parsePublicMarketOverviewCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }

  const result = await buildPublicMarketOverviewBackfill(parsed.options);
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  for (const candidate of result.candidates) {
    printCandidate(candidate);
  }

  console.info(`Inserted: ${result.insertedCount}`);
  console.info(`Already existing: ${result.alreadyExistingCount}`);
  console.info(`Failed: ${result.failedCount}`);
  console.info(`Not public: ${result.notPublicCount}`);
  console.info(`Write eligible: ${result.writeEligibleCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
