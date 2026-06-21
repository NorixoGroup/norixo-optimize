import { MARKETING_AI_PROVIDER_REGISTRY } from "./providerRegistry";
import type { ProviderId } from "./providerTypes";

export function getProviderConnectionState(providerId: ProviderId) {
  const provider = MARKETING_AI_PROVIDER_REGISTRY.find(
    (item) => item.id === providerId
  );

  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    name: provider.name,
    status: provider.status,
    isConnected: provider.isConnected,
    available: provider.isConnected,
  };
}

export function getAllProviderConnections() {
  return MARKETING_AI_PROVIDER_REGISTRY.map((provider) =>
    getProviderConnectionState(provider.id)!
  );
}

export function isProviderAvailable(providerId: ProviderId) {
  return getProviderConnectionState(providerId)?.available ?? false;
}

export function getConnectionSummary() {
  const providers = getAllProviderConnections();

  return {
    total: providers.length,
    connected: providers.filter((p) => p.isConnected).length,
    available: providers.filter((p) => p.available).length,
    disconnected: providers.filter((p) => !p.isConnected).length,
  };
}
