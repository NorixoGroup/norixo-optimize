import type { MediaAssetRequest } from "./mediaAssetRequest";
import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "./mediaProviderAdapter";
import { executeMediaProviderRequest } from "./mediaProviderExecutor";
import { selectMediaProviderForRequest } from "./mediaProviderSelection";

export async function runMediaProviderForRequests(
  requests: MediaAssetRequest[],
  provider: MediaProviderAdapter,
): Promise<MediaProviderGenerateResult[]> {
  const results: MediaProviderGenerateResult[] = [];

  for (const request of requests) {
    const result = await executeMediaProviderRequest(request, provider);
    results.push(result);
  }

  return results;
}

export async function runMediaProviderSelectionForRequests(
  requests: MediaAssetRequest[],
): Promise<MediaProviderGenerateResult[]> {
  const results: MediaProviderGenerateResult[] = [];

  for (const request of requests) {
    const selection = selectMediaProviderForRequest(request);

    if (!selection.provider) {
      results.push({
        provider: "none",
        status: "failed",
        error: `No available media provider for capability: ${selection.capability}.`,
      });
      continue;
    }

    const result = await executeMediaProviderRequest(
      request,
      selection.provider.adapter,
    );

    results.push(result);
  }

  return results;
}
