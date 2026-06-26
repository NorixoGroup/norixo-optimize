import type { MediaGenerationJob } from "./mediaGenerationJob";
import type { MediaProviderGenerateResult } from "./mediaProviderAdapter";
import {
  completeMediaGenerationJob,
  failMediaGenerationJob,
} from "./mediaGenerationStateMachine";
import { getMediaProviderById } from "./mediaProviderRegistry";

export type MediaStatusPollResult = {
  job: MediaGenerationJob;
  providerStatus: MediaProviderGenerateResult | null;
};

export async function pollMediaGenerationJobStatus(
  job: MediaGenerationJob,
): Promise<MediaStatusPollResult> {
  const now = new Date().toISOString();

  if (!job.externalJobId || !job.providerId) {
    return {
      job: {
        ...job,
        updatedAt: now,
      },
      providerStatus: null,
    };
  }

  const provider = getMediaProviderById(job.providerId);

  if (!provider) {
    return {
      job: failMediaGenerationJob(
        job,
        "Media provider not found for status polling.",
      ),
      providerStatus: null,
    };
  }

  const providerStatus = await provider.adapter.getStatus(job.externalJobId);

  if (providerStatus.status === "generated") {
    return {
      job: completeMediaGenerationJob(job, providerStatus),
      providerStatus,
    };
  }

  if (providerStatus.status === "failed") {
    return {
      job: failMediaGenerationJob(
        job,
        providerStatus.error ?? "Media provider status polling failed.",
        providerStatus,
      ),
      providerStatus,
    };
  }

  return {
    job: {
      ...job,
      status: "running",
      result: providerStatus,
      error: null,
      updatedAt: now,
    },
    providerStatus,
  };
}

export async function pollMediaGenerationJobsStatus(
  jobs: MediaGenerationJob[],
): Promise<MediaStatusPollResult[]> {
  const results: MediaStatusPollResult[] = [];

  for (const job of jobs) {
    results.push(await pollMediaGenerationJobStatus(job));
  }

  return results;
}
