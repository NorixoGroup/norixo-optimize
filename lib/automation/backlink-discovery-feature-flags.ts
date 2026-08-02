export function isBacklinkDiscoveryDemoProviderEnabled(): boolean {
  return process.env.BACKLINK_DISCOVERY_DEMO_PROVIDER_ENABLED === "true";
}
