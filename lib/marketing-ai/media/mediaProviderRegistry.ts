import { falImageProvider } from "./providers/falImageProvider";
import { falVideoProvider } from "./providers/falVideoProvider";
import { fakeMediaProvider } from "./providers/fakeMediaProvider";
import { openaiImageProvider } from "./providers/openaiImageProvider";
import { replicateProvider } from "./providers/replicateProvider";
import { runwayVideoProvider } from "./providers/runwayVideoProvider";
import type {
  MediaProviderAdapter,
  MediaProviderCapability,
} from "./mediaProviderAdapter";

export type MediaProviderStatus =
  | "available"
  | "disabled"
  | "unconfigured";

export type RegisteredMediaProvider = {
  id: string;
  label: string;
  status: MediaProviderStatus;
  capabilities: MediaProviderCapability[];
  adapter: MediaProviderAdapter;
};

function isOpenAiImageProviderAvailable(): boolean {
  return process.env.OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED === "true";
}

function isFalVideoProviderAvailable(): boolean {
  return (
    process.env.FAL_VIDEO_PROVIDER_ENABLED === "true" &&
    typeof process.env.FAL_KEY === "string" &&
    process.env.FAL_KEY.trim().length > 0
  );
}

function buildRegisteredMediaProviders(): RegisteredMediaProvider[] {
  return [
    {
      id: falVideoProvider.id,
      label: falVideoProvider.label,
      status: isFalVideoProviderAvailable() ? "available" : "unconfigured",
      capabilities: [...falVideoProvider.capabilities],
      adapter: falVideoProvider,
    },
    {
      id: fakeMediaProvider.id,
      label: fakeMediaProvider.label,
      status: "available",
      capabilities: [...fakeMediaProvider.capabilities],
      adapter: fakeMediaProvider,
    },
    {
      id: openaiImageProvider.id,
      label: openaiImageProvider.label,
      status: isOpenAiImageProviderAvailable() ? "available" : "unconfigured",
      capabilities: [...openaiImageProvider.capabilities],
      adapter: openaiImageProvider,
    },
    {
      id: runwayVideoProvider.id,
      label: runwayVideoProvider.label,
      status: "unconfigured",
      capabilities: [...runwayVideoProvider.capabilities],
      adapter: runwayVideoProvider,
    },
    {
      id: "fal-image",
      label: falImageProvider.label,
      status: "unconfigured",
      capabilities: [...falImageProvider.capabilities],
      adapter: falImageProvider,
    },
    {
      id: replicateProvider.id,
      label: replicateProvider.label,
      status: "unconfigured",
      capabilities: [...replicateProvider.capabilities],
      adapter: replicateProvider,
    },
  ];
}

export function listMediaProviders(): RegisteredMediaProvider[] {
  return buildRegisteredMediaProviders().map((provider) => ({
    ...provider,
    capabilities: [...provider.capabilities],
  }));
}

export function getMediaProviderById(
  id: string,
): RegisteredMediaProvider | null {
  return listMediaProviders().find((provider) => provider.id === id) ?? null;
}

export function listMediaProvidersByCapability(
  capability: MediaProviderCapability,
): RegisteredMediaProvider[] {
  return listMediaProviders().filter(
    (provider) =>
      provider.status === "available" &&
      provider.capabilities.includes(capability),
  );
}
