import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaGenerationJob } from "./mediaGenerationJob";

const DEFAULT_MAX_ATTEMPTS = 3;

export function buildMediaGenerationJobs(
  requests: MediaAssetRequest[],
): MediaGenerationJob[] {
  const now = new Date().toISOString();

  return requests.map((request) => ({
    id: `${request.id}-job`,
    request,
    status: "queued",
    providerId: null,
    externalJobId: null,
    attempts: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  }));
}
