import {
  buildMarketingCampaignBundle,
  createCampaignMemoryFromCampaign,
  createDefaultMarketingCampaign,
  isMarketingCampaignBundle,
} from "../lib/marketing-ai";

const campaign = createDefaultMarketingCampaign({
  name: "Campagne test Norixo",
  objective: "awareness",
  audience: "Hôtes et conciergeries",
  tone: "professional",
  cta: "Découvrir Norixo.io",
  websiteUrl: "https://norixo.io",
  language: "fr",
  platforms: ["facebook", "instagram"],
  formats: ["post", "reel"],
  durationDays: 7,
  hashtags: ["#Norixo"],
  status: "draft",
});

const bundle = buildMarketingCampaignBundle({
  campaign,
  campaignMemory: createCampaignMemoryFromCampaign(campaign),
  notes: ["Smoke test bundle."],
});

console.log(
  JSON.stringify(
    {
      ok: isMarketingCampaignBundle(bundle),
      id: bundle.id,
      campaignId: bundle.campaign.id,
      approvalRequired: bundle.approvalRequired,
      notes: bundle.notes,
    },
    null,
    2,
  ),
);
