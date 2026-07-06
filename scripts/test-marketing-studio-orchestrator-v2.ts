import { parseCreativeOutput } from "../lib/marketing-ai/agents/creativeDirector";
import { parseCommunityDiscoveryOutput } from "../lib/marketing-ai/agents/communityDiscovery";
import { parsePlannerOutput } from "../lib/marketing-ai/agents/contentPlanner";
import { parseLocalizationOutput } from "../lib/marketing-ai/agents/localization";
import { parseSocialOutput } from "../lib/marketing-ai/agents/socialContent";
import { parseVideoOutput } from "../lib/marketing-ai/agents/videoScript";
import { runMarketingStudioOrchestratorV2 } from "../lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";
import { buildMetaPreviewModel } from "../lib/marketing-ai/meta/metaPreviewBuilder";

const REQUIRED_LOCALIZATION_LANGUAGES = [
  "fr",
  "en",
  "es",
  "de",
  "it",
  "pt",
  "nl",
  "ja",
  "zh",
  "ko",
  "ar",
] as const;

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

function assertExactStringSet(
  value: string[],
  expected: readonly string[],
  label: string,
) {
  const actual = [...value].sort();
  const wanted = [...expected].sort();

  if (actual.length !== wanted.length) {
    throw new Error(`${label} has an unexpected size.`);
  }

  for (let index = 0; index < wanted.length; index += 1) {
    if (actual[index] !== wanted[index]) {
      throw new Error(`${label} is invalid.`);
    }
  }
}

async function main() {
  const objective = "education";
  const result = await runMarketingStudioOrchestratorV2({
    name: "Campagne V2 smoke test",
    objective,
    audience: "Hôtes et conciergeries",
    language: "fr",
    channels: ["facebook", "instagram", "linkedin"],
  });
  const planner = parsePlannerOutput(result.planner.output);
  const social = parseSocialOutput(result.social?.output);
  const creative = parseCreativeOutput(result.creative?.output);
  const video = parseVideoOutput(result.video?.output);
  const localization = result.localization;
  const bundlePlanning = result.bundle.planning;
  const bundleSocial = result.bundle.social;
  const bundleCreative = result.bundle.creative;
  const bundleVideo = result.bundle.video;
  const bundleLocalization = result.bundle.localization;
  const bundleCommunityDiscovery = result.bundle.communityDiscovery;
  const bundleReview = result.bundle.review;
  const bundleApproval = result.bundle.approval;
  const bundlePublisher = result.bundle.publisher;
  const bundleMedia = result.bundle.media;
  const requiredBundleSections = [
    "campaign",
    "campaignMemory",
    "planning",
    "social",
    "creative",
    "video",
    "localization",
    "communityDiscovery",
    "review",
    "approval",
    "publisher",
  ] as const;
  const unexpectedWorkspaceSections = [
    "publicationWorkspace",
    "communityWorkspace",
    "localizationWorkspace",
  ].filter((key) => key in result.bundle);

  if (!planner) {
    throw new Error("Planner output is missing or invalid.");
  }

  if (!social) {
    throw new Error("Social output is missing or invalid.");
  }

  if (!creative) {
    throw new Error("Creative output is missing or invalid.");
  }

  if (!video) {
    throw new Error("Video output is missing or invalid.");
  }

  if (!bundleCreative) {
    throw new Error("Bundle creative section is missing.");
  }

  if (!bundlePlanning) {
    throw new Error("Bundle planning section is missing.");
  }

  if (!bundleSocial) {
    throw new Error("Bundle social section is missing.");
  }

  if (!bundleVideo) {
    throw new Error("Bundle video section is missing.");
  }

  if (!bundleLocalization) {
    throw new Error("Bundle localization section is missing.");
  }

  if (!bundleCommunityDiscovery) {
    throw new Error("Bundle communityDiscovery section is missing.");
  }

  if (!bundleReview) {
    throw new Error("Bundle review section is missing.");
  }

  if (!bundleApproval) {
    throw new Error("Bundle approval section is missing.");
  }

  if (!bundlePublisher) {
    throw new Error("Bundle publisher section is missing.");
  }

  if (!bundleMedia) {
    throw new Error("Bundle media section is missing.");
  }

  for (const section of requiredBundleSections) {
    if (!(section in result.bundle)) {
      throw new Error(`bundle.${section} is missing.`);
    }
  }

  if (unexpectedWorkspaceSections.length > 0) {
    throw new Error(
      `Bundle contains unexpected workspace sections: ${unexpectedWorkspaceSections.join(", ")}.`,
    );
  }

  assertNonEmptyString(planner.campaign, "planner.campaign");
  if (result.bundle.campaign.objective !== objective) {
    throw new Error("bundle.campaign.objective was not preserved exactly.");
  }
  assertNonEmptyString(social.title, "social.title");
  assertNonEmptyString(creative.creativeConcept, "creative.creativeConcept");
  assertNonEmptyString(video.videoTitle, "video.videoTitle");
  assertNonEmptyString(bundleCreative.creativeConcept, "bundle.creative.creativeConcept");
  assertNonEmptyString(bundleCreative.visualStyle, "bundle.creative.visualStyle");
  assertNonEmptyString(bundleCreative.layout, "bundle.creative.layout");
  assertNonEmptyString(bundleCreative.imagePrompt, "bundle.creative.imagePrompt");
  if (typeof bundleCreative.negativePrompt !== "string") {
    throw new Error("bundle.creative.negativePrompt is invalid.");
  }
  assertNonEmptyString(bundleCreative.videoPrompt, "bundle.creative.videoPrompt");
  assertNonEmptyList(bundleCreative.overlays, "bundle.creative.overlays");
  assertNonEmptyString(bundlePlanning.campaign, "bundle.planning.campaign");
  assertNonEmptyString(bundleSocial.title, "bundle.social.title");
  assertNonEmptyString(bundleVideo.storyboard, "bundle.video.storyboard");
  if (typeof bundleVideo.script !== "string") {
    throw new Error("bundle.video.script is invalid.");
  }
  assertNonEmptyString(bundleVideo.timeline, "bundle.video.timeline");
  assertNonEmptyString(bundleVideo.videoPrompt, "bundle.video.videoPrompt");
  assertNonEmptyString(bundleVideo.voice, "bundle.video.voice");
  assertNonEmptyString(bundleVideo.captions, "bundle.video.captions");
  if (!Array.isArray(bundleVideo.scenes) || bundleVideo.scenes.length === 0) {
    throw new Error("bundle.video.scenes is empty.");
  }
  assertNonEmptyList(bundleVideo.transitions, "bundle.video.transitions");
  if (
    !Array.isArray(bundleCommunityDiscovery.communities) ||
    bundleCommunityDiscovery.communities.length === 0
  ) {
    throw new Error("bundle.communityDiscovery.communities is empty.");
  }
  assertNonEmptyString(
    bundleCommunityDiscovery.communities[0]?.name,
    "bundle.communityDiscovery.communities[0].name",
  );
  assertNonEmptyString(bundleReview.summary, "bundle.review.summary");
  if (bundleReview.approvalRequired !== true) {
    throw new Error("bundle.review.approvalRequired is invalid.");
  }
  if (bundleApproval.status !== "pending_review") {
    throw new Error("bundle.approval.status is invalid.");
  }
  if (bundleApproval.requiresHumanValidation !== true) {
    throw new Error("bundle.approval.requiresHumanValidation is invalid.");
  }
  if (bundleApproval.publisherReady !== false) {
    throw new Error("bundle.approval.publisherReady is invalid.");
  }
  if (bundleApproval.approvedAt !== null) {
    throw new Error("bundle.approval.approvedAt should be null.");
  }
  if (bundleApproval.approvedBy !== null) {
    throw new Error("bundle.approval.approvedBy should be null.");
  }
  assertNonEmptyString(
    bundleApproval.requiredApprover,
    "bundle.approval.requiredApprover",
  );
  assertNonEmptyList(bundleApproval.notes, "bundle.approval.notes");
  if (bundlePublisher.mode !== "draft_only") {
    throw new Error("bundle.publisher.mode is invalid.");
  }
  if (bundlePublisher.canPublish !== false) {
    throw new Error("bundle.publisher.canPublish is invalid.");
  }
  if (bundlePublisher.requiresApproval !== true) {
    throw new Error("bundle.publisher.requiresApproval is invalid.");
  }
  if (!Array.isArray(bundleMedia.requests) || bundleMedia.requests.length === 0) {
    throw new Error("bundle.media.requests is empty.");
  }
  if (!Array.isArray(bundleMedia.assets) || bundleMedia.assets.length === 0) {
    throw new Error("bundle.media.assets is empty.");
  }
  if (!bundleMedia.requests.every((request) => request.id.startsWith(`${result.bundle.id}-`))) {
    throw new Error("bundle.media.requests ids are not aligned with bundle.id.");
  }
  if (!bundleMedia.assets.every((asset) => asset.id.startsWith(`${result.bundle.id}-`))) {
    throw new Error("bundle.media.assets ids are not aligned with bundle.id.");
  }
  if (!bundleMedia.assets.every((asset) => asset.status === "generated")) {
    throw new Error("bundle.media.assets should all be generated.");
  }
  if (!bundleMedia.assets.every((asset) => asset.generationProvider === "fake")) {
    throw new Error("bundle.media.assets should all be generated by fake provider.");
  }
  assertExactStringSet(
    Object.keys(bundlePublisher.channels),
    ["facebook", "instagram", "linkedin"],
    "bundle.publisher.channels",
  );
  for (const platform of ["facebook", "instagram", "linkedin"] as const) {
    const channel = bundlePublisher.channels[platform];

    if (!channel) {
      throw new Error(`bundle.publisher.channels.${platform} is missing.`);
    }

    if (channel.status !== "draft" && channel.status !== "ready_for_review") {
      throw new Error(`bundle.publisher.channels.${platform}.status is invalid.`);
    }

    if (channel.approvalRequired !== true) {
      throw new Error(`bundle.publisher.channels.${platform}.approvalRequired is invalid.`);
    }

    if (channel.publishAction !== "manual_review_required") {
      throw new Error(`bundle.publisher.channels.${platform}.publishAction is invalid.`);
    }

    if (!channel.publisherOutput) {
      throw new Error(`bundle.publisher.channels.${platform}.publisherOutput is missing.`);
    }

    if (channel.publisherOutput.approvalRequired !== true) {
      throw new Error(
        `bundle.publisher.channels.${platform}.publisherOutput.approvalRequired is invalid.`,
      );
    }

    assertNonEmptyString(channel.copy, `bundle.publisher.channels.${platform}.copy`);
    assertNonEmptyString(
      channel.caption,
      `bundle.publisher.channels.${platform}.caption`,
    );
    assertNonEmptyString(
      channel.assetPrompt,
      `bundle.publisher.channels.${platform}.assetPrompt`,
    );
    assertNonEmptyString(
      channel.videoPrompt,
      `bundle.publisher.channels.${platform}.videoPrompt`,
    );
    if (!channel.assetReferences?.image) {
      throw new Error(
        `bundle.publisher.channels.${platform}.assetReferences.image is missing.`,
      );
    }
    if (!channel.assetReferences?.video) {
      throw new Error(
        `bundle.publisher.channels.${platform}.assetReferences.video is missing.`,
      );
    }
    if (channel.assetReferences.image.status !== "missing") {
      throw new Error(
        `bundle.publisher.channels.${platform}.assetReferences.image.status is invalid.`,
      );
    }
    if (channel.assetReferences.video.status !== "missing") {
      throw new Error(
        `bundle.publisher.channels.${platform}.assetReferences.video.status is invalid.`,
      );
    }
    if (channel.assetReferences.image.kind !== "image") {
      throw new Error(
        `bundle.publisher.channels.${platform}.assetReferences.image.kind is invalid.`,
      );
    }
    if (channel.assetReferences.video.kind !== "video") {
      throw new Error(
        `bundle.publisher.channels.${platform}.assetReferences.video.kind is invalid.`,
      );
    }
    assertNonEmptyString(
      channel.assetReferences.image.prompt,
      `bundle.publisher.channels.${platform}.assetReferences.image.prompt`,
    );
    assertNonEmptyString(
      channel.assetReferences.video.prompt,
      `bundle.publisher.channels.${platform}.assetReferences.video.prompt`,
    );
    assertNonEmptyString(
      channel.publisherOutput.finalCaption,
      `bundle.publisher.channels.${platform}.publisherOutput.finalCaption`,
    );
    assertNonEmptyList(
      channel.publisherOutput.finalHashtags,
      `bundle.publisher.channels.${platform}.publisherOutput.finalHashtags`,
    );
    assertNonEmptyList(
      channel.publisherOutput.manualPublishChecklist,
      `bundle.publisher.channels.${platform}.publisherOutput.manualPublishChecklist`,
    );
  }
  const facebookFinalCaption =
    bundlePublisher.channels.facebook.publisherOutput?.finalCaption ??
    bundlePublisher.channels.facebook.caption;
  const instagramFinalCaption =
    bundlePublisher.channels.instagram.publisherOutput?.finalCaption ??
    bundlePublisher.channels.instagram.caption;
  const linkedInFinalCaption =
    bundlePublisher.channels.linkedin.publisherOutput?.finalCaption ??
    bundlePublisher.channels.linkedin.caption;
  const instagramFinalHashtags =
    bundlePublisher.channels.instagram.publisherOutput?.finalHashtags ??
    bundlePublisher.channels.instagram.hashtags;
  const linkedInFinalHashtags =
    bundlePublisher.channels.linkedin.publisherOutput?.finalHashtags ??
    bundlePublisher.channels.linkedin.hashtags;

  if (
    facebookFinalCaption === instagramFinalCaption &&
    instagramFinalCaption === linkedInFinalCaption
  ) {
    throw new Error("Platform captions are all strictly identical.");
  }

  if (facebookFinalCaption === linkedInFinalCaption) {
    throw new Error("Facebook and LinkedIn captions should not be strictly identical.");
  }

  if (
    instagramFinalHashtags.join("||") === linkedInFinalHashtags.join("||")
  ) {
    throw new Error("Instagram and LinkedIn hashtags should not be strictly identical.");
  }
  const metaPreview = buildMetaPreviewModel(result.bundle);
  if (!Array.isArray(metaPreview.previews) || metaPreview.previews.length === 0) {
    throw new Error("metaPreview.previews is empty.");
  }
  if (
    metaPreview.previews.some(
      (preview) =>
        typeof preview.asset.prompt !== "string" ||
        preview.asset.prompt.trim().length === 0,
    )
  ) {
    throw new Error("metaPreview preview asset prompt is empty.");
  }
  if (!metaPreview.previews.every((preview) => Array.isArray(preview.asset.warnings))) {
    throw new Error("metaPreview asset warnings are invalid.");
  }
  assertExactStringSet(
    Object.keys(bundleLocalization),
    REQUIRED_LOCALIZATION_LANGUAGES,
    "bundle.localization languages",
  );
  for (const language of REQUIRED_LOCALIZATION_LANGUAGES) {
    const localizationResult = localization[language];
    const parsedLocalization = parseLocalizationOutput(localizationResult?.output);
    const bundleLanguage = bundleLocalization[language];

    if (!localizationResult || !parsedLocalization) {
      throw new Error(`localization.${language} is missing or invalid.`);
    }

    if (!bundleLanguage) {
      throw new Error(`bundle.localization.${language} is missing.`);
    }

    assertNonEmptyString(
      bundleLanguage.adaptedTitle,
      `bundle.localization.${language}.adaptedTitle`,
    );
    assertNonEmptyString(
      bundleLanguage.adaptedCaption,
      `bundle.localization.${language}.adaptedCaption`,
    );
    assertNonEmptyString(
      bundleLanguage.adaptedCta,
      `bundle.localization.${language}.adaptedCta`,
    );
  }

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
        bundlePlanning: result.bundle.planning ?? null,
        bundleSocial: result.bundle.social ?? null,
        plannerStatus: result.planner.status,
        plannerError: result.planner.error,
        plannerOutput: result.planner.output,
        socialStatus: result.social?.status ?? null,
        socialError: result.social?.error ?? null,
        socialOutput: result.social?.output ?? null,
        creativeStatus: result.creative?.status ?? null,
        creativeError: result.creative?.error ?? null,
        creativeOutput: result.creative?.output ?? null,
        videoStatus: result.video?.status ?? null,
        videoError: result.video?.error ?? null,
        videoOutput: result.video?.output ?? null,
        localizationLanguages: Object.keys(result.localization),
        communityDiscoveryPreview: parseCommunityDiscoveryOutput(
          result.bundle.communityDiscovery
            ? JSON.stringify(result.bundle.communityDiscovery)
            : null,
        ),
        bundleCreative: result.bundle.creative ?? null,
        bundleVideo: result.bundle.video ?? null,
        bundleLocalizationLanguages: Object.keys(result.bundle.localization ?? {}),
        bundleCommunityDiscoveryCount:
          result.bundle.communityDiscovery?.communities.length ?? 0,
        bundleReview: result.bundle.review ?? null,
        bundleApproval: result.bundle.approval ?? null,
        bundlePublisher: result.bundle.publisher ?? null,
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
