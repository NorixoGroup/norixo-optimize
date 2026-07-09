import {
  createSupabaseMarketingStudioGenerationRunProcessorStore,
  type MarketingStudioGenerationRunProcessorStore,
  type MarketingStudioGenerationRunRecord,
} from "./marketingStudioGenerationRunStore";
import { buildMarketingStudioMediaPreflight } from "../media/mediaConfiguration";
import {
  runMarketingStudioOrchestratorV2,
  type MarketingStudioOrchestratorV2Result,
} from "../orchestrator/marketingStudioOrchestratorV2";

function isNonProduction() {
  return process.env.NODE_ENV !== "production";
}

function logWorkerInfo(message: string, details: Record<string, unknown>) {
  if (!isNonProduction()) {
    return;
  }

  console.info("[marketing-studio-worker]", message, details);
}

export const MARKETING_STUDIO_WORKER_DISABLED_ERROR =
  "Marketing Studio worker disabled by paid generation guard.";
export const MARKETING_STUDIO_WORKER_MEDIA_RUNTIME_ERROR =
  "Marketing Studio worker media runtime is not production-ready.";
export const MARKETING_STUDIO_WORKER_HEARTBEAT_INTERVAL_MS = 15_000;

export type MarketingStudioGenerationWorkerStatus =
  | "idle"
  | "disabled"
  | "preflight_blocked"
  | "completed"
  | "failed";

function isPaidGenerationEnabled() {
  return process.env.MARKETING_STUDIO_PAID_GENERATION_ENABLED === "true";
}

export function buildMarketingStudioGenerationWorkerGate() {
  const paidGenerationEnabled = isPaidGenerationEnabled();
  const mediaPreflight = buildMarketingStudioMediaPreflight();

  if (!paidGenerationEnabled) {
    return {
      ok: false as const,
      status: "disabled" as const,
      error: MARKETING_STUDIO_WORKER_DISABLED_ERROR,
      mediaPreflight,
    };
  }

  if (!mediaPreflight.productionReady) {
    return {
      ok: false as const,
      status: "preflight_blocked" as const,
      error: MARKETING_STUDIO_WORKER_MEDIA_RUNTIME_ERROR,
      mediaPreflight,
    };
  }

  return {
    ok: true as const,
    status: "idle" as const,
    error: null,
    mediaPreflight,
  };
}

export type MarketingStudioGenerationWorkerDeps = {
  workerId?: string;
  store?: MarketingStudioGenerationRunProcessorStore;
  runOrchestrator?: (
    input: MarketingStudioGenerationRunRecord["input"],
  ) => Promise<MarketingStudioOrchestratorV2Result>;
  onRunStarted?: (run: MarketingStudioGenerationRunRecord) => void;
  onRunFinished?: (
    run: MarketingStudioGenerationRunRecord,
    status: "completed" | "failed",
  ) => void;
};

function startOwnedRunHeartbeat(params: {
  workerId: string;
  runId: string;
  store: MarketingStudioGenerationRunProcessorStore;
}) {
  let stopped = false;
  let lostOwnership = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;

  async function tick() {
    if (stopped || lostOwnership || inFlight) {
      return;
    }

    inFlight = true;

    try {
      const ok = await params.store.heartbeatOwnedRun({
        runId: params.runId,
        workerId: params.workerId,
      });

      if (!ok) {
        lostOwnership = true;
        console.error("[marketing-studio-worker] heartbeat ownership lost", {
          workerId: params.workerId,
          runId: params.runId,
        });
      }
    } catch (error) {
      console.error("[marketing-studio-worker] heartbeat failed", {
        workerId: params.workerId,
        runId: params.runId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight = false;

      if (!stopped && !lostOwnership) {
        schedule();
      }
    }
  }

  function schedule() {
    timeoutId = setTimeout(() => {
      void tick();
    }, MARKETING_STUDIO_WORKER_HEARTBEAT_INTERVAL_MS);
  }

  function stop() {
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  schedule();

  return {
    stop,
    hasLostOwnership: () => lostOwnership,
  };
}

export async function processMarketingStudioGenerationRun(
  run: MarketingStudioGenerationRunRecord,
  deps: MarketingStudioGenerationWorkerDeps = {},
): Promise<"completed" | "failed"> {
  const store =
    deps.store ?? createSupabaseMarketingStudioGenerationRunProcessorStore();
  const runOrchestrator = deps.runOrchestrator ?? runMarketingStudioOrchestratorV2;
  const workerId =
    typeof deps.workerId === "string" && deps.workerId.trim().length > 0
      ? deps.workerId.trim()
      : null;
  let heartbeatController:
    | ReturnType<typeof startOwnedRunHeartbeat>
    | null = null;

  try {
    const gate = buildMarketingStudioGenerationWorkerGate();
    if (!gate.ok) {
      throw new Error(gate.error);
    }

    logWorkerInfo("processing run", {
      runId: run.id,
      campaignId: run.campaignId,
      requestId: run.requestId,
      workerId,
    });
    deps.onRunStarted?.(run);

    if (workerId) {
      heartbeatController = startOwnedRunHeartbeat({
        workerId,
        runId: run.id,
        store,
      });
    }

    const result = await runOrchestrator(run.input);

    await store.completeRun({
      runId: run.id,
      campaignId: run.campaignId,
      input: run.input,
      result,
    });

    logWorkerInfo("run completed", {
      runId: run.id,
      campaignId: run.campaignId,
      requestId: run.requestId,
      workerId,
      heartbeatOwnershipLost: heartbeatController?.hasLostOwnership() ?? false,
    });
    deps.onRunFinished?.(run, "completed");

    return "completed";
  } catch (error) {
    await store.failRun({
      runId: run.id,
      error,
    });

    logWorkerInfo("run failed", {
      runId: run.id,
      campaignId: run.campaignId,
      requestId: run.requestId,
      workerId,
      errorMessage: error instanceof Error ? error.message : String(error),
      heartbeatOwnershipLost: heartbeatController?.hasLostOwnership() ?? false,
    });
    deps.onRunFinished?.(run, "failed");

    return "failed";
  } finally {
    heartbeatController?.stop();
  }
}

export async function processNextMarketingStudioGenerationRun(
  deps: MarketingStudioGenerationWorkerDeps = {},
): Promise<{
  claimedRunId: string | null;
  status: MarketingStudioGenerationWorkerStatus;
  error?: string;
}> {
  const store =
    deps.store ?? createSupabaseMarketingStudioGenerationRunProcessorStore();
  const gate = buildMarketingStudioGenerationWorkerGate();
  const workerId =
    typeof deps.workerId === "string" && deps.workerId.trim().length > 0
      ? deps.workerId.trim()
      : null;

  if (!gate.ok) {
    logWorkerInfo("worker gate blocked before claim", {
      status: gate.status,
      error: gate.error,
      imageProvider: gate.mediaPreflight.imageProvider,
      videoProvider: gate.mediaPreflight.videoProvider,
      storageProvider: gate.mediaPreflight.storageProvider,
      uploadEnabled: gate.mediaPreflight.uploadEnabled,
      pollingEnabled: gate.mediaPreflight.pollingEnabled,
    });
    return {
      claimedRunId: null,
      status: gate.status,
      error: gate.error,
    };
  }

  if (!workerId) {
    throw new Error("Marketing Studio workerId is required before claim.");
  }

  const run = await store.claimNextQueuedRun({
    workerId,
  });

  if (!run) {
    return {
      claimedRunId: null,
      status: "idle",
    };
  }

  const status = await processMarketingStudioGenerationRun(run, {
    ...deps,
    workerId,
  });

  return {
    claimedRunId: run.id,
    status,
  };
}
