import { MARKETING_AI_AGENT_REGISTRY } from "./agentRegistry";
import type { MarketingAiAgentId } from "./agentTypes";
import type { ProviderCapability, ProviderId } from "./providerTypes";

export function resolveMarketingAiAgent(agentId: MarketingAiAgentId) {
  return MARKETING_AI_AGENT_REGISTRY.find((agent) => agent.id === agentId) ?? null;
}

export function getMarketingAiAgentsByCapability(capability: ProviderCapability) {
  return MARKETING_AI_AGENT_REGISTRY.filter((agent) =>
    agent.requiredCapabilities.includes(capability)
  );
}

export function getMarketingAiAgentsByPreferredProvider(providerId: ProviderId) {
  return MARKETING_AI_AGENT_REGISTRY.filter((agent) =>
    agent.preferredProviderIds.includes(providerId)
  );
}

export function getExecutableMarketingAiAgents() {
  return MARKETING_AI_AGENT_REGISTRY.filter((agent) => agent.isExecutable);
}
