import type { ProviderId } from "../../providerTypes";
import type { MarketingAiProviderAdapter } from "./providerAdapter";
import { SimulationAdapter } from "./simulationAdapter";

const simulation = new SimulationAdapter();

const ADAPTERS: Record<ProviderId, MarketingAiProviderAdapter> = {
  openai: simulation,
  anthropic: simulation,
  google: simulation,
  xai: simulation,
  meta: simulation,
  brevo: simulation,
};

export function getProviderAdapter(
  providerId: ProviderId,
): MarketingAiProviderAdapter {
  return ADAPTERS[providerId];
}
