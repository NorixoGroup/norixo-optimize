import type { MediaGenerationJob } from "./mediaGenerationJob";
import { executeMediaProviderRequest } from "./mediaProviderExecutor";
import {
  completeMediaGenerationJob,
  failMediaGenerationJob,
  startMediaGenerationJob,
} from "./mediaGenerationStateMachine";
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
    return failMediaGenerationJob(
      job,
      job.error ?? "Maximum media generation attempts reached.",
    );
  }

  const selection = selectMediaProviderForRequest(job.request);

  if (!selection.provider) {
    return failMediaGenerationJob(
      job,
      `No available media provider for capability: ${selection.capability}.`,
    );
  }

  const startedJob = startMediaGenerationJob(job);

  const result = await executeMediaProviderRequest(
    startedJob.request,
    selection.provider.adapter,
  );

  const completed = result.status === "generated";

  const transitionedJob = completed
    ? completeMediaGenerationJob(startedJob, result)
    : failMediaGenerationJob(
        startedJob,
        result.error ?? "Media provider execution failed.",
        result,
      );

  return {
    ...transitionedJob,
    providerId: selection.provider.id,
    externalJobId: result.externalJobId ?? null,
    attempts: job.attempts + 1,
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
