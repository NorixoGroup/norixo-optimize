import type { MediaProviderGenerateResult } from "./mediaProviderAdapter";
import type { MediaGenerationJob } from "./mediaGenerationJob";

export function startMediaGenerationJob(
  job: MediaGenerationJob,
): MediaGenerationJob {
  return {
    ...job,
    status: "running",
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

export function completeMediaGenerationJob(
  job: MediaGenerationJob,
  result: MediaProviderGenerateResult,
): MediaGenerationJob {
  return {
    ...job,
    status: "completed",
    result,
    providerId: result.provider ?? job.providerId,
    externalJobId: result.externalJobId ?? job.externalJobId ?? null,
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

export function failMediaGenerationJob(
  job: MediaGenerationJob,
  error: string,
  result?: MediaProviderGenerateResult | null,
): MediaGenerationJob {
  return {
    ...job,
    status: "failed",
    error,
    result: result ?? job.result ?? null,
    providerId: result?.provider ?? job.providerId ?? null,
    externalJobId: result?.externalJobId ?? job.externalJobId ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function cancelMediaGenerationJob(
  job: MediaGenerationJob,
  reason?: string,
): MediaGenerationJob {
  return {
    ...job,
    status: "cancelled",
    error: reason ?? job.error ?? null,
    updatedAt: new Date().toISOString(),
  };
}
