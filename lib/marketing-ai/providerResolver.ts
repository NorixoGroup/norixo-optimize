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


export function getMarketingAiModelCatalog() {
  return MARKETING_AI_PROVIDER_REGISTRY.flatMap((provider) =>
    provider.models.map((model) => ({
      name: model,
      category: provider.category.includes("image")
        ? "Image"
        : provider.category.includes("video")
          ? "Vidéo"
          : provider.category.includes("audio")
            ? "Voix"
            : "LLM",
      provider: provider.name,
      usage: provider.description,
      status: provider.isConnected ? "Connecté" : "Non connecté",
    }))
  );
}
