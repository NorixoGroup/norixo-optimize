import type { MarketingAiAgentId } from "../agentTypes";
import type { ProviderId } from "../providerTypes";

export type MarketingAiExecutionStatus =
  | "started"
  | "simulation"
  | "success"
  | "error";

export type MarketingAiExecutionTrace = {
  executionId: string;
  agentId: MarketingAiAgentId;
  providerId: ProviderId;
  model: string | null;
  status: MarketingAiExecutionStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  costEur: number;
  error: string | null;
};

export function createExecutionTrace(input: {
  agentId: MarketingAiAgentId;
  providerId: ProviderId;
  model: string | null;
}): MarketingAiExecutionTrace {
  return {
    executionId: `marketing-ai-${Date.now()}`,
    agentId: input.agentId,
    providerId: input.providerId,
    model: input.model,
    status: "started",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: 0,
    costEur: 0,
    error: null,
  };
}
