import type { MediaGenerationJob } from "./mediaGenerationJob";
import { executeMediaProviderRequest } from "./mediaProviderExecutor";
import { selectMediaProviderForRequest } from "./mediaProviderSelection";

export async function executeMediaGenerationJob(
  job: MediaGenerationJob,
): Promise<MediaGenerationJob> {
  const now = new Date().toISOString();

  if (job.status === "cancelled") {
    return {
      ...job,
      updatedAt: now,
    };
  }

  if (job.attempts >= job.maxAttempts) {
    return {
      ...job,
      status: "failed",
      error: job.error ?? "Maximum media generation attempts reached.",
      updatedAt: now,
    };
  }

  const selection = selectMediaProviderForRequest(job.request);

  if (!selection.provider) {
    return {
      ...job,
      status: "failed",
      error: `No available media provider for capability: ${selection.capability}.`,
      updatedAt: now,
    };
  }

  const result = await executeMediaProviderRequest(
    job.request,
    selection.provider.adapter,
  );

  const completed = result.status === "generated";

  return {
    ...job,
    status: completed ? "completed" : "failed",
    providerId: selection.provider.id,
    externalJobId: result.externalJobId ?? null,
    attempts: job.attempts + 1,
    result,
    error: completed ? null : result.error ?? "Media provider execution failed.",
    updatedAt: now,
  };
}

export async function executeMediaGenerationJobs(
  jobs: MediaGenerationJob[],
): Promise<MediaGenerationJob[]> {
  const executedJobs: MediaGenerationJob[] = [];

  for (const job of jobs) {
    executedJobs.push(await executeMediaGenerationJob(job));
  }

  return executedJobs;
}
