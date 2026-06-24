import { parseCreativeOutput } from "../lib/marketing-ai/agents/creativeDirector";
import { parsePlannerOutput } from "../lib/marketing-ai/agents/contentPlanner";
import { parseSocialOutput } from "../lib/marketing-ai/agents/socialContent";
import { runMarketingStudioOrchestratorV2 } from "../lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

function assertNonEmptyString(value: string | null | undefined, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is empty.`);
  }
}

function assertNonEmptyList(value: string[] | undefined, label: string) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => item.trim().length === 0)) {
    throw new Error(`${label} is empty.`);
  }
}

async function main() {
  const result = await runMarketingStudioOrchestratorV2({
    name: "Campagne V2 smoke test",
    objective: "awareness",
    audience: "Hôtes et conciergeries",
    language: "fr",
    channels: ["facebook", "instagram"],
  });
  const planner = parsePlannerOutput(result.planner.output);
  const social = parseSocialOutput(result.social?.output);
  const creative = parseCreativeOutput(result.creative?.output);
  const bundleCreative = result.bundle.creative;

  if (!planner) {
    throw new Error("Planner output is missing or invalid.");
  }

  if (!social) {
    throw new Error("Social output is missing or invalid.");
  }

  if (!creative) {
    throw new Error("Creative output is missing or invalid.");
  }

  if (!bundleCreative) {
    throw new Error("Bundle creative section is missing.");
  }

  assertNonEmptyString(planner.campaign, "planner.campaign");
  assertNonEmptyString(social.title, "social.title");
  assertNonEmptyString(creative.creativeConcept, "creative.creativeConcept");
  assertNonEmptyString(bundleCreative.creativeConcept, "bundle.creative.creativeConcept");
  assertNonEmptyString(bundleCreative.visualStyle, "bundle.creative.visualStyle");
  assertNonEmptyString(bundleCreative.layout, "bundle.creative.layout");
  assertNonEmptyString(bundleCreative.imagePrompt, "bundle.creative.imagePrompt");
  assertNonEmptyString(bundleCreative.negativePrompt, "bundle.creative.negativePrompt");
  assertNonEmptyString(bundleCreative.videoPrompt, "bundle.creative.videoPrompt");
  assertNonEmptyList(bundleCreative.overlays, "bundle.creative.overlays");
  assertNonEmptyList(bundleCreative.brandChecklist, "bundle.creative.brandChecklist");

  console.log(
    JSON.stringify(
      {
        approvalRequired: result.approvalRequired,
        bundleId: result.bundle.id,
        campaignId: result.bundle.campaign.id,
        campaignName: result.bundle.campaign.name,
        platforms: result.bundle.campaign.platforms,
        hasCampaignMemory: Boolean(result.bundle.campaignMemory),
        notes: result.bundle.notes,
        plannerStatus: result.planner.status,
        plannerError: result.planner.error,
        plannerOutput: result.planner.output,
        socialStatus: result.social?.status ?? null,
        socialError: result.social?.error ?? null,
        socialOutput: result.social?.output ?? null,
        creativeStatus: result.creative?.status ?? null,
        creativeError: result.creative?.error ?? null,
        creativeOutput: result.creative?.output ?? null,
        bundleCreative: result.bundle.creative ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
