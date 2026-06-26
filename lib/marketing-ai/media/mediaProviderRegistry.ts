import { falImageProvider } from "./providers/falImageProvider";
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

const MEDIA_PROVIDERS: RegisteredMediaProvider[] = [
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
    status: "unconfigured",
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
    id: falImageProvider.id,
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

export function listMediaProviders(): RegisteredMediaProvider[] {
  return MEDIA_PROVIDERS.map((provider) => ({
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
