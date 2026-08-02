import type {
  BacklinkDiscoveryProvider,
  BacklinkDiscoveryProviderRegistry,
} from "./backlink-discovery-provider-types";
import type { BacklinkDiscoveryProviderName } from "./backlink-discovery-types";

export function resolveBacklinkDiscoveryProvider(
  providers: BacklinkDiscoveryProviderRegistry,
  providerName: BacklinkDiscoveryProviderName,
): BacklinkDiscoveryProvider {
  const provider = providers[providerName];

  if (provider === undefined) {
    throw new Error("BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED");
  }

  return provider;
}
