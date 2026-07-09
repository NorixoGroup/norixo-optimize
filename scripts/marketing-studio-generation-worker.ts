import { processNextMarketingStudioGenerationRun } from "../lib/marketing-ai/runs/marketingStudioGenerationWorker";

function readPollIntervalMs() {
  const configured = Number.parseInt(
    process.env.MARKETING_STUDIO_WORKER_POLL_INTERVAL_MS ?? "",
    10,
  );

  return Number.isFinite(configured) && configured > 0 ? configured : 5000;
}

function shouldWatch(argv: string[]) {
  return argv.includes("--watch");
}

function isNonProduction() {
  return process.env.NODE_ENV !== "production";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoop() {
  const watch = shouldWatch(process.argv.slice(2));
  const pollIntervalMs = readPollIntervalMs();

  do {
    const result = await processNextMarketingStudioGenerationRun();

    if (isNonProduction()) {
      console.info("[marketing-studio-worker-cli]", result);
    }

    if (!watch) {
      break;
    }

    await sleep(pollIntervalMs);
  } while (true);
}

runLoop().catch((error) => {
  console.error("[marketing-studio-worker-cli] failed", error);
  process.exitCode = 1;
});
