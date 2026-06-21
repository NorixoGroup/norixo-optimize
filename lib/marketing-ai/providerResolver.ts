import { MARKETING_AI_PROVIDER_REGISTRY } from "./providerRegistry";
import type { ProviderCapability, ProviderId } from "./providerTypes";

export function resolveMarketingAiProvider(providerId: ProviderId) {
  return MARKETING_AI_PROVIDER_REGISTRY.find((provider) => provider.id === providerId) ?? null;
}

export function getMarketingAiProvidersByCapability(capability: ProviderCapability) {
  return MARKETING_AI_PROVIDER_REGISTRY.filter((provider) =>
    provider.capabilities.includes(capability)
  );
}

export function getConnectedMarketingAiProviders() {
  return MARKETING_AI_PROVIDER_REGISTRY.filter((provider) => provider.isConnected);
}
