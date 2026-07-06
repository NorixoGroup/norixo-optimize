import type { MediaAsset } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaGenerationJob } from "./mediaGenerationJob";
import { applyMediaGenerationJobsToAssets } from "./mediaAssetUpdatePipeline";
import { getMediaConfiguration } from "./mediaConfiguration";
import { buildMediaGenerationJobs } from "./mediaGenerationJobBuilder";
import { executeMediaGenerationJobs } from "./mediaGenerationJobExecutor";
import { failMediaGenerationJob } from "./mediaGenerationStateMachine";
import { pollMediaGenerationJobsStatus } from "./mediaStatusPoller";

const DEFAULT_MEDIA_POLL_INTERVAL_MS = 3000;
const DEFAULT_MEDIA_MAX_POLL_ATTEMPTS = 20;

function getMediaPollIntervalMs(): number {
  const configured = Number.parseInt(
    process.env.MEDIA_POLL_INTERVAL_MS ?? "",
    10,
  );

  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_MEDIA_POLL_INTERVAL_MS;
}

function getMediaMaxPollAttempts(): number {
  const configured = Number.parseInt(
    process.env.MEDIA_MAX_POLL_ATTEMPTS ?? "",
    10,
  );

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MEDIA_MAX_POLL_ATTEMPTS;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type MediaGenerationPipelineResult = {
  jobs: MediaGenerationJob[];
  executedJobs: MediaGenerationJob[];
  assets: MediaAsset[];
};

export async function runMediaGenerationPipeline(
  requests: MediaAssetRequest[],
  assets: MediaAsset[],
): Promise<MediaGenerationPipelineResult> {
  const jobs = buildMediaGenerationJobs(requests);
  let executedJobs = await executeMediaGenerationJobs(jobs);
  const mediaConfiguration = getMediaConfiguration();

  if (mediaConfiguration.pollingEnabled) {
    const pollIntervalMs = getMediaPollIntervalMs();
    const maxPollAttempts = getMediaMaxPollAttempts();

    for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
      const runningJobs = executedJobs.filter((job) => job.status === "running");

      if (runningJobs.length === 0) {
        break;
      }

      await sleep(pollIntervalMs);

      const pollResults = await pollMediaGenerationJobsStatus(runningJobs);
      const polledJobsById = new Map(
        pollResults.map((item) => [item.job.id, item.job]),
      );

      executedJobs = executedJobs.map(
        (job) => polledJobsById.get(job.id) ?? job,
      );
    }

    executedJobs = executedJobs.map((job) =>
      job.status === "running"
        ? failMediaGenerationJob(
            job,
            "Media generation timed out before reaching a terminal state.",
            job.result ?? undefined,
          )
        : job,
    );
  }

  const updatedAssets = applyMediaGenerationJobsToAssets(executedJobs, assets);

  return {
    jobs,
    executedJobs,
    assets: updatedAssets,
  };
}
