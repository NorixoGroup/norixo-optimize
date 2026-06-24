import { runMarketingStudioOrchestratorV2 } from "../lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

async function main() {
  const result = await runMarketingStudioOrchestratorV2({
    name: "Campagne V2 smoke test",
    objective: "awareness",
    audience: "Hôtes et conciergeries",
    language: "fr",
    channels: ["facebook", "instagram"],
  });

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
