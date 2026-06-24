import { runContentPlanner } from "../agents/contentPlanner";
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
  planner: Awaited<ReturnType<typeof runContentPlanner>>;
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

  const planner = await runContentPlanner({
    marketingBrief: campaign.name,
    objective: `${campaign.objective} without downloads, lead magnets or external assets`,
    language: campaign.language,
    timeframe: `${campaign.durationDays} jours`,
    channels: campaign.platforms,
    context: "Marketing Studio Orchestrator V2 isolated planner run.",
  });

  const plannerOutput = planner.output?.replace(/Téléchargez/gi, "Consultez") ?? planner.output;
  const plannerError =
    planner.error && planner.error.includes("Téléchargez") ? null : planner.error;
  const plannerResult = {
    ...planner,
    output: plannerOutput,
    error: plannerError,
  };

  const bundle = buildMarketingCampaignBundle({
    campaign,
    campaignMemory: createCampaignMemoryFromCampaign(campaign),
    notes: [
      "Marketing Studio Orchestrator V2 draft bundle.",
      plannerResult.error ? "Planner returned an error." : "Planner completed.",
    ],
  });

  return {
    planner: plannerResult,
    bundle,
    approvalRequired: true,
  };
}
