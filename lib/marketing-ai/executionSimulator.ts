import { MARKETING_AI_AGENT_REGISTRY } from "./agentRegistry";
import { getCapabilitiesCoverage } from "./capabilityResolver";
import { resolveMarketingAiExecutionPlan } from "./routingResolver";

export type MarketingAiExecutionSimulationStep = {
  order: number;
  agentId: string;
  agentName: string;
  role: string;
  providerName: string;
  model: string;
  requiredCapabilities: string[];
  status: "simulated";
  simulatedDurationMs: number;
  simulatedCostEur: 0;
};

export type MarketingAiExecutionSimulation = {
  id: "marketing-ai-static-simulation";
  status: "disabled";
  totalSteps: number;
  totalCostEur: 0;
  apiCalls: 0;
  steps: MarketingAiExecutionSimulationStep[];
  safety: string[];
};

export function getMarketingAiExecutionSimulation(): MarketingAiExecutionSimulation {
  const steps = MARKETING_AI_AGENT_REGISTRY.map((agent, index) => {
    const routingPlan = resolveMarketingAiExecutionPlan(agent.id);
    const coverage = getCapabilitiesCoverage(agent.id);

    return {
      order: index + 1,
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      providerName: routingPlan?.providerName ?? "Non applicable",
      model: routingPlan?.model ?? "Non applicable",
      requiredCapabilities: coverage?.requiredCapabilities ?? [],
      status: "simulated" as const,
      simulatedDurationMs: 250 + index * 75,
      simulatedCostEur: 0 as const,
    };
  });

  return {
    id: "marketing-ai-static-simulation",
    status: "disabled",
    totalSteps: steps.length,
    totalCostEur: 0,
    apiCalls: 0,
    steps,
    safety: [
      "Aucun appel API",
      "Aucun provider connecté",
      "Aucune clé utilisée",
      "Aucun coût généré",
      "Aucune publication déclenchée",
    ],
  };
}
