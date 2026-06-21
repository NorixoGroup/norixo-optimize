import type { MarketingAiProviderAdapter } from "./providerAdapter";
import type {
  MarketingAiExecutionRequest,
  MarketingAiExecutionResult,
  MarketingAiProviderHealth,
} from "./adapterTypes";

export class SimulationAdapter implements MarketingAiProviderAdapter {
  readonly providerId = "simulation";

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async health(): Promise<MarketingAiProviderHealth> {
    return {
      providerId: "openai",
      status: "simulation",
      isAvailable: true,
      message: "Simulation provider",
    };
  }

  async execute(
    request: MarketingAiExecutionRequest,
  ): Promise<MarketingAiExecutionResult> {
    return {
      providerId: request.providerId,
      model: request.model,
      status: "simulation",
      output: null,
      error: null,
      costEur: 0,
      durationMs: 0,
    };
  }
}
