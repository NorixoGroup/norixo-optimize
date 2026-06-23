import {
  createMarketingCampaignBundle,
  type CreateMarketingCampaignBundleInput,
  type MarketingCampaignBundle,
} from "./marketingCampaignBundle";

export type MarketingCampaignBundleBuilderInput =
  CreateMarketingCampaignBundleInput;

export function isMarketingCampaignBundleBuilderInput(
  value: unknown,
): value is MarketingCampaignBundleBuilderInput {
  return typeof value === "object" && value !== null && "campaign" in value;
}

export function buildMarketingCampaignBundle(
  input: MarketingCampaignBundleBuilderInput,
): MarketingCampaignBundle {
  return createMarketingCampaignBundle(input);
}
