import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";
import type { MediaAssetRequest } from "./mediaAssetRequest";

function nonEmpty(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function pickFirstNonEmpty(
  ...values: Array<string | undefined | null>
): string | null {
  for (const value of values) {
    const normalized = nonEmpty(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function hasPlatform(
  bundle: MarketingCampaignBundle,
  platform: "facebook" | "instagram" | "linkedin",
): boolean {
  return bundle.campaign.platforms.includes(platform);
}

export function buildMediaAssetRequestsFromBundle(
  bundle: MarketingCampaignBundle,
): MediaAssetRequest[] {
  const fallbackPrompt = `Create a marketing asset for ${bundle.campaign.name}.`;
  const fallbackBrief =
    pickFirstNonEmpty(bundle.campaign.objective, bundle.campaign.name) ??
    bundle.campaign.name;
  const targetLanguage = pickFirstNonEmpty(bundle.campaign.language, "fr") ?? "fr";

  const requests: MediaAssetRequest[] = [
    {
      id: `${bundle.id}-hero-image`,
      kind: "image",
      platform: "generic",
      ratio: "1:1",
      targetLanguage,
      title: "Hero image",
      creativeBrief:
        pickFirstNonEmpty(
          bundle.creative?.creativeConcept,
          bundle.campaign.name,
          fallbackBrief,
        ) ?? fallbackBrief,
      prompt:
        pickFirstNonEmpty(bundle.creative?.imagePrompt, fallbackPrompt) ??
        fallbackPrompt,
      negativePrompt: nonEmpty(bundle.creative?.negativePrompt) ?? undefined,
      required: true,
    },
  ];

  if (hasPlatform(bundle, "instagram")) {
    requests.push({
      id: `${bundle.id}-instagram-reel`,
      kind: "reel",
      platform: "instagram",
      ratio: "9:16",
      targetLanguage,
      title: "Instagram reel",
      creativeBrief:
        pickFirstNonEmpty(
          bundle.video?.storyboard,
          bundle.creative?.creativeConcept,
          bundle.campaign.name,
          fallbackBrief,
        ) ?? fallbackBrief,
      prompt:
        pickFirstNonEmpty(bundle.video?.videoPrompt, fallbackPrompt) ??
        fallbackPrompt,
      expectedDurationSeconds: 30,
      required: true,
    });
  }

  if (hasPlatform(bundle, "facebook")) {
    requests.push({
      id: `${bundle.id}-facebook-post-image`,
      kind: "image",
      platform: "facebook",
      ratio: "4:5",
      targetLanguage,
      title: "Facebook post image",
      creativeBrief:
        pickFirstNonEmpty(
          bundle.publisher?.channels.facebook.caption,
          bundle.social?.caption,
          bundle.campaign.name,
          fallbackBrief,
        ) ?? fallbackBrief,
      prompt:
        pickFirstNonEmpty(
          bundle.publisher?.channels.facebook.assetPrompt,
          bundle.creative?.imagePrompt,
          fallbackPrompt,
        ) ?? fallbackPrompt,
      required: true,
    });
  }

  if (hasPlatform(bundle, "linkedin")) {
    requests.push({
      id: `${bundle.id}-linkedin-cover-image`,
      kind: "cover",
      platform: "linkedin",
      ratio: "16:9",
      targetLanguage,
      title: "LinkedIn cover image",
      creativeBrief:
        pickFirstNonEmpty(
          bundle.publisher?.channels.linkedin.caption,
          bundle.campaign.name,
          fallbackBrief,
        ) ?? fallbackBrief,
      prompt:
        pickFirstNonEmpty(
          bundle.publisher?.channels.linkedin.assetPrompt,
          bundle.creative?.imagePrompt,
          fallbackPrompt,
        ) ?? fallbackPrompt,
      required: false,
    });
  }

  requests.push({
    id: `${bundle.id}-video-thumbnail`,
    kind: "thumbnail",
    platform: "generic",
    ratio: "16:9",
    targetLanguage,
    title: "Video thumbnail",
    creativeBrief:
      pickFirstNonEmpty(bundle.video?.storyboard, bundle.campaign.name, fallbackBrief) ??
      fallbackBrief,
    prompt:
      pickFirstNonEmpty(bundle.creative?.imagePrompt, fallbackPrompt) ??
      fallbackPrompt,
    required: false,
  });

  return requests;
}
