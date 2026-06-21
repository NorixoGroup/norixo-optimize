import { resolveMarketingAiAgent } from "./agentResolver";
import type { MarketingAiAgentId } from "./agentTypes";
import { resolveMarketingAiProvider } from "./providerResolver";
import type { ProviderId } from "./providerTypes";

export type MarketingAiRoutingPlan = {
  agentId: MarketingAiAgentId;
  agentName: string;
  providerId: ProviderId | null;
  providerName: string | null;
  model: string | null;
  isExecutable: false;
  status: "simulation";
  reason: string;
};

export function resolveBestProviderForAgent(agentId: MarketingAiAgentId) {
  const agent = resolveMarketingAiAgent(agentId);

  if (!agent) {
    return null;
  }

  const providerId = agent.preferredProviderIds[0] ?? null;

  if (!providerId) {
    return null;
  }

  return resolveMarketingAiProvider(providerId);
}

export function resolveBestModelForAgent(agentId: MarketingAiAgentId) {
  const agent = resolveMarketingAiAgent(agentId);

  if (!agent) {
    return null;
  }

  return agent.preferredModels[0] ?? null;
}

export function resolveMarketingAiExecutionPlan(
  agentId: MarketingAiAgentId
): MarketingAiRoutingPlan | null {
  const agent = resolveMarketingAiAgent(agentId);

  if (!agent) {
    return null;
  }

  const provider = resolveBestProviderForAgent(agentId);
  const model = resolveBestModelForAgent(agentId);

  return {
    agentId: agent.id,
    agentName: agent.name,
    providerId: provider?.id ?? null,
    providerName: provider?.name ?? null,
    model,
    isExecutable: false,
    status: "simulation",
    reason:
      "Plan de routage statique uniquement. Aucun provider n'est connecté et aucune exécution réelle n'est autorisée.",
  };
}
