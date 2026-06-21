import { getProviderAdapter } from "../adapters/base/adapterRegistry";
import type {
  MarketingAiExecutionRequest,
  MarketingAiExecutionResult,
} from "../adapters/base/adapterTypes";

export async function executeMarketingAiRequest(
  request: MarketingAiExecutionRequest,
): Promise<MarketingAiExecutionResult> {
  const adapter = getProviderAdapter(request.providerId);

  return adapter.execute(request);
}
