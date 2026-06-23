import {
  buildMarketingCampaignBundle,
  createCampaignMemoryFromCampaign,
  createDefaultMarketingCampaign,
} from "../index";
import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";

export type MarketingStudioOrchestratorV2Input = {
  name?: string;
  objective: string;
  audience?: string;
  language?: string;
  channels?: string[];
};

export type MarketingStudioOrchestratorV2Result = {
  bundle: MarketingCampaignBundle;
  approvalRequired: true;
};

export async function runMarketingStudioOrchestratorV2(
  input: MarketingStudioOrchestratorV2Input,
): Promise<MarketingStudioOrchestratorV2Result> {
  const campaign = createDefaultMarketingCampaign({
    name: input.name?.trim() || "Campagne Norixo V2",
    objective: input.objective,
    audience: input.audience ?? "Hôtes et conciergeries",
    tone: "professional",
    cta: "Découvrir Norixo.io",
    websiteUrl: "https://norixo.io",
    language: input.language ?? "fr",
    platforms: input.channels ?? ["facebook", "instagram"],
    formats: ["post", "reel"],
    durationDays: 7,
    hashtags: ["#Norixo"],
    status: "draft",
  });

  const bundle = buildMarketingCampaignBundle({
    campaign,
    campaignMemory: createCampaignMemoryFromCampaign(campaign),
    notes: ["Marketing Studio Orchestrator V2 draft bundle."],
  });

  return {
    bundle,
    approvalRequired: true,
  };
}
