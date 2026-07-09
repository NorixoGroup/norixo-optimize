import { processNextMarketingStudioGenerationRun } from "../lib/marketing-ai/runs/marketingStudioGenerationWorker";
import { pathToFileURL } from "node:url";

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

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

export function createMarketingStudioWorkerCli(params?: {
  workerId?: string;
  argv?: string[];
  processNextRun?: typeof processNextMarketingStudioGenerationRun;
}) {
  const workerId = params?.workerId?.trim() || crypto.randomUUID();
  const argv = params?.argv ?? process.argv.slice(2);
  const watch = shouldWatch(argv);
  const pollIntervalMs = readPollIntervalMs();
  const processNextRun =
    params?.processNextRun ?? processNextMarketingStudioGenerationRun;
  let shuttingDown = false;
  let activeRunId: string | null = null;
  let activeRunPromise: Promise<unknown> | null = null;
  let shutdownPromise: Promise<void> | null = null;
  let sleepTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let resolveSleep: (() => void) | null = null;

  async function waitForPollInterval() {
    if (pollIntervalMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      resolveSleep = resolve;
      sleepTimeoutId = setTimeout(() => {
        sleepTimeoutId = null;
        resolveSleep = null;
        resolve();
      }, pollIntervalMs);
    });
  }

  async function handleSignal(signal: "SIGTERM" | "SIGINT") {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shuttingDown = true;
    if (sleepTimeoutId) {
      clearTimeout(sleepTimeoutId);
      sleepTimeoutId = null;
    }
    if (resolveSleep) {
      const wake = resolveSleep;
      resolveSleep = null;
      wake();
    }
    console.info("[marketing-studio-worker-cli] signal received", {
      signal,
      workerId,
      activeRunId,
      hasActiveRun: activeRunPromise !== null,
    });

    shutdownPromise = (async () => {
      try {
        await activeRunPromise;
      } catch {
        // Let the active run promise settle without forcing a requeue or replay.
      }

      console.info("[marketing-studio-worker-cli] graceful shutdown complete", {
        signal,
        workerId,
        activeRunId,
      });
    })();

    return shutdownPromise;
  }

  async function runLoop() {
    if (isNonProduction()) {
      console.info("[marketing-studio-worker-cli] started", {
        workerId,
        watch,
        pollIntervalMs,
      });
    }

    do {
      if (shuttingDown) {
        break;
      }

      activeRunPromise = processNextRun({
        workerId,
        onRunStarted: (run) => {
          activeRunId = run.id;
        },
        onRunFinished: () => {
          activeRunId = null;
        },
      });

      try {
        const result = await activeRunPromise;

        if (isNonProduction()) {
          console.info("[marketing-studio-worker-cli]", {
            workerId,
            result,
          });
        }
      } finally {
        activeRunPromise = null;
        activeRunId = null;
      }

      if (!watch || shuttingDown) {
        break;
      }

      await waitForPollInterval();
    } while (true);
  }

  return {
    workerId,
    runLoop,
    handleSignal,
    getState: () => ({
      workerId,
      watch,
      pollIntervalMs,
      shuttingDown,
      activeRunId,
      hasActiveRun: activeRunPromise !== null,
    }),
  };
}

if (isMainModule()) {
  const workerCli = createMarketingStudioWorkerCli();

  process.once("SIGTERM", () => {
    void workerCli.handleSignal("SIGTERM");
  });

  process.once("SIGINT", () => {
    void workerCli.handleSignal("SIGINT");
  });

  workerCli.runLoop().catch((error) => {
    console.error("[marketing-studio-worker-cli] failed", {
      workerId: workerCli.workerId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
