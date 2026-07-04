import type { MediaAssetRequest } from "./mediaAssetRequest";
import type { MediaProviderCapability } from "./mediaProviderAdapter";
import type { RegisteredMediaProvider } from "./mediaProviderRegistry";
import { listMediaProvidersByCapability } from "./mediaProviderRegistry";

export type MediaProviderSelectionReason =
  | "matched_capability"
  | "no_available_provider";

export type MediaProviderSelection = {
  requestId: string;
  capability: MediaProviderCapability;
  provider: RegisteredMediaProvider | null;
  reason: MediaProviderSelectionReason;
};

function resolveCapabilityForRequest(
  request: MediaAssetRequest,
): MediaProviderCapability {
  if (request.kind === "video" || request.kind === "reel") {
    return "video";
  }

  if (request.kind === "thumbnail") {
    return "thumbnail";
  }

  return "image";
}

export function selectMediaProviderForRequest(
  request: MediaAssetRequest,
): MediaProviderSelection {
  const capability = resolveCapabilityForRequest(request);
  const providers = listMediaProvidersByCapability(capability);
  const preferredProviders =
    capability === "image" || capability === "thumbnail"
      ? [
          ...providers.filter((provider) => provider.id !== "fake"),
          ...providers.filter((provider) => provider.id === "fake"),
        ]
      : providers;
  const provider = preferredProviders[0] ?? null;

  return {
    requestId: request.id,
    capability,
    provider,
    reason: provider ? "matched_capability" : "no_available_provider",
  };
}

export function selectMediaProvidersForRequests(
  requests: MediaAssetRequest[],
): MediaProviderSelection[] {
  return requests.map((request) => selectMediaProviderForRequest(request));
}
