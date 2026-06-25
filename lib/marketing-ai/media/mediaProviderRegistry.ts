import { fakeMediaProvider } from "./providers/fakeMediaProvider";
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
