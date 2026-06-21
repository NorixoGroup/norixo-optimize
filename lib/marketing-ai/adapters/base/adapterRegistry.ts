import type { ProviderId } from "../../providerTypes";
import type { MarketingAiProviderAdapter } from "./providerAdapter";
import { OpenAiAdapter } from "../openai/openAiAdapter";
import { SimulationAdapter } from "./simulationAdapter";

const openai = new OpenAiAdapter();
const simulation = new SimulationAdapter();

const ADAPTERS: Record<ProviderId, MarketingAiProviderAdapter> = {
  openai,
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
