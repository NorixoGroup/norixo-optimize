import type { MediaAssetRequest } from "./mediaAssetRequest";
import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "./mediaProviderAdapter";

function isVideoRequest(kind: MediaAssetRequest["kind"]): boolean {
  return kind === "video" || kind === "reel";
}

export async function runMediaProviderForRequests(
  requests: MediaAssetRequest[],
  provider: MediaProviderAdapter,
): Promise<MediaProviderGenerateResult[]> {
  const results: MediaProviderGenerateResult[] = [];

  for (const request of requests) {
    try {
      const result = isVideoRequest(request.kind)
        ? await provider.generateVideo(request)
        : await provider.generateImage(request);

      results.push(result);
    } catch (error) {
      results.push({
        provider: provider.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown media provider error.",
      });
    }
  }

  return results;
}
