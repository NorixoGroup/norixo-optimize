import type { MarketingAiAgentId } from "../../agentTypes";
import type { ProviderCapability, ProviderId } from "../../providerTypes";

export type MarketingAiExecutionRequest = {
  agentId: MarketingAiAgentId;
  providerId: ProviderId;
  model: string | null;
  input: string;
  capabilities: ProviderCapability[];
  metadata?: Record<string, unknown>;
};

export type MarketingAiExecutionResult = {
  providerId: ProviderId;
  model: string | null;
  status: "simulation" | "success" | "error";
  output: string | null;
  error: string | null;
  costEur: number;
  durationMs: number;
};

export type MarketingAiProviderHealth = {
  providerId: ProviderId;
  status: "simulation" | "connected" | "disconnected" | "error";
  isAvailable: boolean;
  message: string;
};
