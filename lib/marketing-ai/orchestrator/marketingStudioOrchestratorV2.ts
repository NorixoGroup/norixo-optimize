import { runContentPlanner, parsePlannerOutput } from "../agents/contentPlanner";
import { runCreativeDirector, parseCreativeOutput } from "../agents/creativeDirector";
import { runSocialContent, parseSocialOutput } from "../agents/socialContent";
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
  creative: Awaited<ReturnType<typeof runCreativeDirector>> | null;
  bundle: MarketingCampaignBundle;
  approvalRequired: true;
};

function resolveCreativeChannel(
  value: string | undefined,
): "instagram" | "facebook" | "linkedin" {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === "instagram" ||
    normalizedValue === "facebook" ||
    normalizedValue === "linkedin"
  ) {
    return normalizedValue;
  }

  return "facebook";
}

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
  const campaignMemory = createCampaignMemoryFromCampaign(campaign);

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
  const socialOutput = parseSocialOutput(social?.output);
  const creative =
    parsedPlannerOutput && socialOutput
      ? await runCreativeDirector({
          campaign,
          campaignMemory,
          planning: parsedPlannerOutput,
          social: socialOutput,
          contentTitle: socialOutput.title,
          hook: socialOutput.hook,
          channel: resolveCreativeChannel(socialOutput.targetPlatform),
          format: parsedPlannerOutput.items[0]?.format ?? "post",
          visualGoal: `Créer une direction visuelle premium pour ${campaign.name}.`,
          language: campaign.language,
        })
      : null;
  const creativeOutput = parseCreativeOutput(creative?.output);

  const bundle = buildMarketingCampaignBundle({
    campaign,
    campaignMemory,
    creative: creativeOutput
      ? {
          creativeConcept: creativeOutput.creativeConcept,
          visualStyle: creativeOutput.visualStyle,
          layout: creativeOutput.layout,
          overlays: [
            creativeOutput.mainTextOverlay,
            creativeOutput.secondaryTextOverlay,
          ].filter((value) => value.trim().length > 0),
          imagePrompt: creativeOutput.gptImagePrompt,
          negativePrompt: creativeOutput.negativePrompt,
          videoPrompt: socialOutput?.videoPrompt ?? "",
          brandChecklist: creativeOutput.brandChecklist,
        }
      : undefined,
    notes: [
      "Marketing Studio Orchestrator V2 draft bundle.",
      plannerResult.error ? "Planner returned an error." : "Planner completed.",
      social?.error ? "Social returned an error." : social ? "Social completed." : "Social skipped.",
      creative?.error
        ? "Creative returned an error."
        : creative
          ? "Creative completed."
          : "Creative skipped.",
    ],
  });

  return {
    planner: plannerResult,
    social,
    creative,
    bundle,
    approvalRequired: true,
  };
}
