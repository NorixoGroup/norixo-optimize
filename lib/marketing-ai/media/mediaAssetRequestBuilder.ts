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

function normalizeVoiceOverForPrompt(
  value: string | undefined | null,
): string | null {
  const normalized = nonEmpty(value);

  return normalized ? normalized.replace(/\s+/g, " ").trim() : null;
}

function buildSeedanceReelPrompt(input: {
  basePrompt: string;
  voiceOver?: string | null;
}): string {
  const normalizedVoiceOver = normalizeVoiceOverForPrompt(input.voiceOver);
  const promptParts = [
    input.basePrompt,
    "Vertical 9:16 social media reel.",
    "Duration: 10 seconds.",
    "Premium SaaS marketing style.",
    "Natural synchronized audio.",
  ];

  if (normalizedVoiceOver) {
    promptParts.push(
      "French voice-over, clear and confident professional tone.",
      `The narrator says exactly: ${JSON.stringify(normalizedVoiceOver)}`,
      "No additional spoken dialogue.",
      "Do not invent extra speech.",
    );
  } else {
    promptParts.push(
      "No spoken dialogue.",
      "Do not invent extra speech.",
    );
  }

  promptParts.push(
    "Subtle modern background ambience and light interface sound effects.",
    "Keep the narration intelligible and dominant over background audio.",
  );

  return promptParts.join(" ");
}

function hasPlatform(
  bundle: MarketingCampaignBundle,
  platform: "facebook" | "instagram" | "linkedin",
): boolean {
  return bundle.campaign.platforms.includes(platform);
}

function buildAssetSpecificImagePrompt(input: {
  basePrompt: string;
  creativeBrief: string;
  platform: string;
  ratio: string;
  role: "hero-image" | "facebook-post-image" | "linkedin-cover-image" | "video-thumbnail";
}): string {
  const productActionContext = `Product / campaign action context: ${input.creativeBrief}.`;
  const supportingCreativeDirection = `Supporting campaign creative direction: ${input.basePrompt}`;
  const platformAndRatioInstructions = [
    `Platform: ${input.platform}.`,
    `Ratio: ${input.ratio}.`,
  ];
  const sharedGuardrails = [
    "Create a composition clearly different from the other image assets in the same campaign.",
    "Use one main visual subject with a strong hierarchy and immediate clarity.",
    "Do not render long text inside the image.",
    "Do not use English labels unless the campaign language is English.",
    "If the campaign language is not English, avoid labels such as BEFORE, AFTER, CLUTTER, DARK, Poor lighting, or Unmade bed.",
    "Focus on visual contrast, annotations, composition and product meaning without relying on text.",
  ];

  if (input.role === "hero-image") {
    return [
      "Asset role: premium hero image for the campaign.",
      "Represent Norixo's core value proposition through a clear listing audit, listing analysis, or listing improvement scene.",
      "Show a premium and instantly understandable visualization of a short-term rental listing being analyzed or improved.",
      "Favor a bold, high-clarity composition rather than a decorative SaaS dashboard.",
      productActionContext,
      supportingCreativeDirection,
      ...platformAndRatioInstructions,
      ...sharedGuardrails,
    ].join(" ");
  }

  if (input.role === "facebook-post-image") {
    return [
      "Asset role: scroll-stopping Facebook post image.",
      "Represent one single friction point, one single analysis angle, or one clear before / analysis / improvement contrast.",
      "Make the subject visually punchy and easy to understand in a fast-scrolling feed.",
      "Avoid looking like a copy of the hero image.",
      productActionContext,
      supportingCreativeDirection,
      ...platformAndRatioInstructions,
      ...sharedGuardrails,
    ].join(" ");
  }

  if (input.role === "linkedin-cover-image") {
    return [
      "Asset role: professional LinkedIn cover image.",
      "Show structured analysis, prioritization of improvements, or a credible product review moment for a short-term rental listing.",
      "Keep the composition sober, polished, and business-facing.",
      "Use the wide format to create a more structured scene, not a copy of the hero or Facebook visual.",
      productActionContext,
      supportingCreativeDirection,
      ...platformAndRatioInstructions,
      ...sharedGuardrails,
    ].join(" ");
  }

  return [
    "Asset role: high-impact video thumbnail.",
    "Use one focal subject only, with high contrast and strong readability at small size.",
    "The thumbnail can evoke a score, a listing audit, or one main friction point.",
    "Avoid full dashboard compositions and avoid looking like a copy of the hero or Facebook visual.",
    productActionContext,
    supportingCreativeDirection,
    ...platformAndRatioInstructions,
    ...sharedGuardrails,
  ].join(" ");
}

export function buildMediaAssetRequestsFromBundle(
  bundle: MarketingCampaignBundle,
): MediaAssetRequest[] {
  const fallbackPrompt = `Create a marketing asset for ${bundle.campaign.name}.`;
  const fallbackBrief =
    pickFirstNonEmpty(bundle.campaign.objective, bundle.campaign.name) ??
    bundle.campaign.name;
  const targetLanguage = pickFirstNonEmpty(bundle.campaign.language, "fr") ?? "fr";
  const heroCreativeBrief =
    pickFirstNonEmpty(
      bundle.creative?.creativeConcept,
      bundle.campaign.objective,
      bundle.campaign.name,
      fallbackBrief,
    ) ?? fallbackBrief;

  const requests: MediaAssetRequest[] = [
    {
      id: `${bundle.id}-hero-image`,
      kind: "image",
      platform: "generic",
      ratio: "1:1",
      targetLanguage,
      title: "Hero image",
      creativeBrief: heroCreativeBrief,
      prompt: buildAssetSpecificImagePrompt({
        basePrompt:
          pickFirstNonEmpty(bundle.creative?.imagePrompt, fallbackPrompt) ??
          fallbackPrompt,
        creativeBrief: heroCreativeBrief,
        platform: "generic",
        ratio: "1:1",
        role: "hero-image",
      }),
      negativePrompt: nonEmpty(bundle.creative?.negativePrompt) ?? undefined,
      required: true,
    },
  ];

  if (hasPlatform(bundle, "instagram")) {
    const reelVoiceOver = pickFirstNonEmpty(bundle.video?.script);

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
      prompt: buildSeedanceReelPrompt({
        basePrompt:
          pickFirstNonEmpty(bundle.video?.videoPrompt, fallbackPrompt) ??
          fallbackPrompt,
        voiceOver: reelVoiceOver,
      }),
      expectedDurationSeconds: 10,
      required: true,
    });
  }

  if (hasPlatform(bundle, "facebook")) {
    const facebookCreativeBrief =
      pickFirstNonEmpty(
        bundle.publisher?.channels.facebook.caption,
        bundle.social?.caption,
        bundle.campaign.objective,
        bundle.campaign.name,
        fallbackBrief,
      ) ?? fallbackBrief;

    requests.push({
      id: `${bundle.id}-facebook-post-image`,
      kind: "image",
      platform: "facebook",
      ratio: "4:5",
      targetLanguage,
      title: "Facebook post image",
      creativeBrief: facebookCreativeBrief,
      prompt:
        buildAssetSpecificImagePrompt({
          basePrompt:
            pickFirstNonEmpty(
              bundle.publisher?.channels.facebook.assetPrompt,
              bundle.creative?.imagePrompt,
              fallbackPrompt,
            ) ?? fallbackPrompt,
          creativeBrief: facebookCreativeBrief,
          platform: "facebook",
          ratio: "4:5",
          role: "facebook-post-image",
        }),
      negativePrompt: nonEmpty(bundle.creative?.negativePrompt) ?? undefined,
      required: true,
    });
  }

  if (hasPlatform(bundle, "linkedin")) {
    const linkedInCreativeBrief =
      pickFirstNonEmpty(
        bundle.publisher?.channels.linkedin.caption,
        bundle.campaign.objective,
        bundle.campaign.name,
        fallbackBrief,
      ) ?? fallbackBrief;

    requests.push({
      id: `${bundle.id}-linkedin-cover-image`,
      kind: "cover",
      platform: "linkedin",
      ratio: "16:9",
      targetLanguage,
      title: "LinkedIn cover image",
      creativeBrief: linkedInCreativeBrief,
      prompt:
        buildAssetSpecificImagePrompt({
          basePrompt:
            pickFirstNonEmpty(
              bundle.publisher?.channels.linkedin.assetPrompt,
              bundle.creative?.imagePrompt,
              fallbackPrompt,
            ) ?? fallbackPrompt,
          creativeBrief: linkedInCreativeBrief,
          platform: "linkedin",
          ratio: "16:9",
          role: "linkedin-cover-image",
        }),
      negativePrompt: nonEmpty(bundle.creative?.negativePrompt) ?? undefined,
      required: false,
    });
  }

  const thumbnailCreativeBrief =
    pickFirstNonEmpty(
      bundle.video?.storyboard,
      bundle.campaign.objective,
      bundle.campaign.name,
      fallbackBrief,
    ) ?? fallbackBrief;

  requests.push({
    id: `${bundle.id}-video-thumbnail`,
    kind: "thumbnail",
    platform: "generic",
    ratio: "16:9",
    targetLanguage,
    title: "Video thumbnail",
    creativeBrief: thumbnailCreativeBrief,
    prompt: buildAssetSpecificImagePrompt({
      basePrompt:
        pickFirstNonEmpty(bundle.creative?.imagePrompt, fallbackPrompt) ??
        fallbackPrompt,
      creativeBrief: thumbnailCreativeBrief,
      platform: "generic",
      ratio: "16:9",
      role: "video-thumbnail",
    }),
    negativePrompt: nonEmpty(bundle.creative?.negativePrompt) ?? undefined,
    required: false,
  });

  return requests;
}
