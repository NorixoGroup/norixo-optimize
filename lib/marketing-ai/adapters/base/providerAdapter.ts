import type {
  MarketingAiExecutionRequest,
  MarketingAiExecutionResult,
  MarketingAiProviderHealth,
} from "./adapterTypes";

export interface MarketingAiProviderAdapter {
  readonly providerId: string;

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  health(): Promise<MarketingAiProviderHealth>;

  execute(
    request: MarketingAiExecutionRequest,
  ): Promise<MarketingAiExecutionResult>;
}
