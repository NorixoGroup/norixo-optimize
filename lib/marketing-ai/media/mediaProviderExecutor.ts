import type { MediaAssetRequest } from "./mediaAssetRequest";
import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "./mediaProviderAdapter";

function isVideoRequest(kind: MediaAssetRequest["kind"]): boolean {
  return kind === "video" || kind === "reel";
}

export async function executeMediaProviderRequest(
  request: MediaAssetRequest,
  provider: MediaProviderAdapter,
): Promise<MediaProviderGenerateResult> {
  try {
    return isVideoRequest(request.kind)
      ? await provider.generateVideo(request)
      : await provider.generateImage(request);
  } catch (error) {
    return {
      provider: provider.id,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown media provider error.",
    };
  }
}
