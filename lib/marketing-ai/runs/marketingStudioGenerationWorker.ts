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
  store?: MarketingStudioGenerationRunProcessorStore;
  runOrchestrator?: (
    input: MarketingStudioGenerationRunRecord["input"],
  ) => Promise<MarketingStudioOrchestratorV2Result>;
};

export async function processMarketingStudioGenerationRun(
  run: MarketingStudioGenerationRunRecord,
  deps: MarketingStudioGenerationWorkerDeps = {},
): Promise<"completed" | "failed"> {
  const store =
    deps.store ?? createSupabaseMarketingStudioGenerationRunProcessorStore();
  const runOrchestrator = deps.runOrchestrator ?? runMarketingStudioOrchestratorV2;

  try {
    const gate = buildMarketingStudioGenerationWorkerGate();
    if (!gate.ok) {
      throw new Error(gate.error);
    }

    logWorkerInfo("processing run", {
      runId: run.id,
      campaignId: run.campaignId,
      requestId: run.requestId,
    });

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
    });

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
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return "failed";
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

  const run = await store.claimNextQueuedRun();

  if (!run) {
    return {
      claimedRunId: null,
      status: "idle",
    };
  }

  const status = await processMarketingStudioGenerationRun(run, deps);

  return {
    claimedRunId: run.id,
    status,
  };
}
