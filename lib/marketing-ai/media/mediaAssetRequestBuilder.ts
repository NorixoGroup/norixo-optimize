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

function buildSeedanceReelPrompt(input: {
  basePrompt: string;
}): string {
  const promptParts = [
    input.basePrompt,
    "Vertical 9:16 social media reel.",
    "Duration: 10 seconds.",
    "Premium SaaS marketing style.",
    "Short-term rental listing optimization context.",
    "Clear visual storytelling from friction to clarity.",
    "No visible competitor branding.",
    "No invented metrics.",
    "No fake testimonials.",
    "Silent visual-only video.",
    "Do not generate narration, voice-over or character speech.",
    "Do not rely on audio to communicate the story.",
  ];

  return promptParts.join(" ");
}

function hasPlatform(
  bundle: MarketingCampaignBundle,
  platform: "facebook" | "instagram" | "linkedin",
): boolean {
  return bundle.campaign.platforms.includes(platform);
}

function buildSharedNorixoVisualLanguage(): string[] {
  return [
    "Premium editorial B2B SaaS campaign visual for hospitality technology.",
    "Norixo-inspired product analysis visual, not a reproduction of the real Norixo interface.",
    "Short-term rental listing optimization context with clear product meaning.",
    "Clean neutral premium background with restrained blue and cyan accents.",
    "Crisp controlled lighting, refined depth, subtle shadows and precise visual hierarchy.",
    "Modern product-led composition with high-end B2B SaaS campaign quality.",
    "One dominant visual idea.",
    "Keep a non-stock photography feel.",
  ];
}

function buildSharedNorixoVisualObjects(): string[] {
  return [
    "When relevant, favor a listing photo audit, a property image being analyzed, visual friction markers, a discreet score indicator or score chip, prioritized action cards, improvement hierarchy, before/improvement contrast without relying on text labels, photo quality analysis, and conversion optimization cues.",
    "Show problem, analysis and action through concrete visual objects rather than decorative technology imagery.",
    "If a stylized UI appears, keep it conceptual, minimal, credible and secondary to the main subject.",
  ];
}

function buildSharedNegativeDirection(): string[] {
  return [
    "Avoid generic stock SaaS visuals, generic futuristic AI imagery, glowing brains, humanoid robots, random holograms, crypto aesthetics and cyberpunk styling.",
    "Avoid generic corporate teams around a laptop.",
    "Do not ask for the exact Norixo dashboard, the exact Norixo interface, or a real Norixo screenshot.",
    "Avoid overloaded synthetic interfaces or decorative dashboards with no narrative role.",
    "Do not render long text inside the image.",
    "No long paragraphs, no marketing copy blocks, no unreadable microtext, and no fake dashboard full of labels.",
    "Do not use English labels unless the campaign language is English.",
    "If the campaign language is not English, avoid labels such as BEFORE, AFTER, CLUTTER, DARK, Poor lighting, or Unmade bed.",
    "Focus on visual contrast, annotations, composition and product meaning without relying on text.",
  ];
}

function buildAssetSpecificImagePrompt(input: {
  basePrompt: string;
  creativeBrief: string;
  platform: string;
  ratio: string;
  role: "hero-image" | "facebook-post-image" | "linkedin-cover-image" | "video-thumbnail";
}): string {
  const campaignIdea = [
    `Product / campaign action context: ${input.creativeBrief}.`,
    `Supporting campaign creative direction: ${input.basePrompt}`,
    `Platform: ${input.platform}.`,
    `Ratio: ${input.ratio}.`,
  ];
  const sharedComposition = [
    "Create a composition clearly different from the other image assets in the same campaign.",
    "Use one main visual subject with a strong hierarchy and immediate clarity.",
    "Show product meaning through concrete visual objects rather than decorative technology imagery.",
  ];

  let assetRole: string[] = [];
  let composition: string[] = [];
  let visualObjects: string[] = [];

  if (input.role === "hero-image") {
    assetRole = [
      "Asset role: premium hero image for the campaign.",
      "Represent Norixo's core value proposition through a clear listing audit, listing analysis, or listing improvement scene.",
    ];
    composition = [
      "Build an iconic premium composition with a dominant subject and immediate product value visibility.",
      "Favor a bold, high-clarity scene rather than a decorative SaaS dashboard.",
    ];
    visualObjects = [
      "Favor one property or listing photo as the main subject, with visible analysis cues, a few precise friction markers, a discreet score indicator and two or three improvement priorities.",
      "Make the scene feel like a professional decision-support tool for listing optimization.",
    ];
  } else if (input.role === "facebook-post-image") {
    assetRole = [
      "Asset role: scroll-stopping Facebook post image.",
      "Represent one single friction point, one single analysis angle, or one clear before / analysis / improvement contrast.",
    ];
    composition = [
      "Make the scene instantly readable in a fast-scrolling feed with one dominant visual idea.",
      "Avoid looking like a copy of the hero image.",
    ];
    visualObjects = [
      "Favor a concrete listing photo or property image with a visible analysis moment, a small number of friction markers and a clear improvement cue.",
      "Keep the scene punchy, concrete and product-led rather than editorially busy.",
    ];
  } else if (input.role === "linkedin-cover-image") {
    assetRole = [
      "Asset role: professional LinkedIn cover image.",
      "Show structured analysis, prioritization of improvements, or a credible product review moment for a short-term rental listing.",
    ];
    composition = [
      "Keep the composition sober, polished, analytical and business-facing.",
      "Use the wide format to create a structured professional scene, not a copy of the hero or Facebook visual.",
    ];
    visualObjects = [
      "Favor a credible review setup with a listing visual, a restrained score cue, a few structured friction markers and a visible improvement hierarchy.",
      "Keep any UI treatment secondary, minimal and decision-oriented.",
    ];
  } else {
    assetRole = [
      "Asset role: high-impact video thumbnail.",
      "Use one focal subject only, with high contrast and strong readability at small size.",
    ];
    composition = [
      "Keep the thumbnail highly legible at small size with very few elements.",
      "Avoid full dashboard compositions and avoid looking like a copy of the hero or Facebook visual.",
    ];
    visualObjects = [
      "Favor a single listing audit cue, one friction point, or one score-oriented product moment.",
      "Use only the minimum visual objects needed to communicate the idea.",
    ];
  }

  return [
    ...assetRole,
    ...campaignIdea,
    "Norixo visual language:",
    ...buildSharedNorixoVisualLanguage(),
    "Composition:",
    ...sharedComposition,
    ...composition,
    "Visual objects:",
    ...buildSharedNorixoVisualObjects(),
    ...visualObjects,
    "Negative direction:",
    ...buildSharedNegativeDirection(),
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
