import { resolveMarketingAiAgent } from "./agentResolver";
import { MARKETING_AI_AGENT_REGISTRY } from "./agentRegistry";
import type { MarketingAiAgentId } from "./agentTypes";
import { resolveMarketingAiProvider } from "./providerResolver";
import { MARKETING_AI_PROVIDER_REGISTRY } from "./providerRegistry";
import type { ProviderCapability, ProviderId } from "./providerTypes";

export type MarketingAiCapabilityCoverage = {
  agentId: MarketingAiAgentId;
  agentName: string;
  requiredCapabilities: ProviderCapability[];
  coveredCapabilities: ProviderCapability[];
  missingCapabilities: ProviderCapability[];
  compatibleProviderIds: ProviderId[];
  isFullyCovered: boolean;
};

export function canProviderSupportAgent(
  providerId: ProviderId,
  agentId: MarketingAiAgentId
) {
  const provider = resolveMarketingAiProvider(providerId);
  const agent = resolveMarketingAiAgent(agentId);

  if (!provider || !agent) {
    return false;
  }

  return agent.requiredCapabilities.every((capability) =>
    provider.capabilities.includes(capability)
  );
}

export function getProvidersForAgent(agentId: MarketingAiAgentId) {
  const agent = resolveMarketingAiAgent(agentId);

  if (!agent) {
    return [];
  }

  return MARKETING_AI_PROVIDER_REGISTRY.filter((provider) =>
    agent.requiredCapabilities.every((capability) =>
      provider.capabilities.includes(capability)
    )
  );
}

export function getAgentsForProvider(providerId: ProviderId) {
  const provider = resolveMarketingAiProvider(providerId);

  if (!provider) {
    return [];
  }

  return MARKETING_AI_AGENT_REGISTRY.filter((agent) =>
    agent.requiredCapabilities.every((capability) =>
      provider.capabilities.includes(capability)
    )
  );
}

export function getCapabilitiesCoverage(
  agentId: MarketingAiAgentId
): MarketingAiCapabilityCoverage | null {
  const agent = resolveMarketingAiAgent(agentId);

  if (!agent) {
    return null;
  }

  const compatibleProviders = getProvidersForAgent(agent.id);
  const coveredCapabilities = agent.requiredCapabilities.filter((capability) =>
    MARKETING_AI_PROVIDER_REGISTRY.some((provider) =>
      provider.capabilities.includes(capability)
    )
  );
  const missingCapabilities = agent.requiredCapabilities.filter(
    (capability) => !coveredCapabilities.includes(capability)
  );

  return {
    agentId: agent.id,
    agentName: agent.name,
    requiredCapabilities: agent.requiredCapabilities,
    coveredCapabilities,
    missingCapabilities,
    compatibleProviderIds: compatibleProviders.map((provider) => provider.id),
    isFullyCovered: missingCapabilities.length === 0,
  };
}
