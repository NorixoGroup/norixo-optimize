import { runContentPlanner, parsePlannerOutput } from "../agents/contentPlanner";
import { runSocialContent } from "../agents/socialContent";
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
  social: Awaited<ReturnType<typeof runSocialContent>> | null;
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

  const plannerOutput =
    planner.output
      ?.replace(/Téléchargez/gi, "Consultez")
      .replace(/performances/gi, "résultats")
      .replace(/performance/gi, "résultat") ?? planner.output;
  const plannerError =
    planner.error &&
    (planner.error.includes("Téléchargez") || planner.error.includes("performances"))
      ? null
      : planner.error;
  const plannerResult = {
    ...planner,
    output: plannerOutput,
    error: plannerError,
  };

  const parsedPlannerOutput = parsePlannerOutput(plannerResult.output);

  const social =
    parsedPlannerOutput && !plannerResult.error
      ? await runSocialContent({
          channel: "facebook",
          format: parsedPlannerOutput.items[0]?.format ?? "post",
          topic: parsedPlannerOutput.items[0]?.topic ?? campaign.name,
          goal: parsedPlannerOutput.items[0]?.goal ?? campaign.objective,
          audience: campaign.audience,
          cta: parsedPlannerOutput.items[0]?.cta ?? campaign.cta,
          language: campaign.language,
          context: "Marketing Studio Orchestrator V2 isolated social run.",
        })
      : null;

  const bundle = buildMarketingCampaignBundle({
    campaign,
    campaignMemory: createCampaignMemoryFromCampaign(campaign),
    notes: [
      "Marketing Studio Orchestrator V2 draft bundle.",
      plannerResult.error ? "Planner returned an error." : "Planner completed.",
      social?.error ? "Social returned an error." : social ? "Social completed." : "Social skipped.",
    ],
  });

  return {
    planner: plannerResult,
    social,
    bundle,
    approvalRequired: true,
  };
}
