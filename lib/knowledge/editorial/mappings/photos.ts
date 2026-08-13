import type { EditorialMapping } from "../mapping-registry";

const photosPillarId = "content:guide:airbnb-photo-optimization" as const;
const photosTopicId = "topic:photos" as const;
const airbnbPlatformId = "platform:airbnb" as const;
const listingOptimizationGuideId = "content:guide:airbnb-listing-optimization" as const;
const listingOptimizationSolutionId = "content:solution:airbnb-listing-optimization" as const;

const photoArticleIds = [
  "content:article:airbnb-photography", "content:article:airbnb-photo-optimization", "content:article:airbnb-cover-photo", "content:article:airbnb-photo-order", "content:article:airbnb-photo-checklist", "content:article:airbnb-bedroom-photos", "content:article:airbnb-living-room-photos", "content:article:airbnb-kitchen-photos", "content:article:airbnb-bathroom-photos", "content:article:airbnb-exterior-photos", "content:article:airbnb-lighting", "content:article:airbnb-photo-editing", "content:article:airbnb-smartphone-photography", "content:article:airbnb-wide-angle-photos", "content:article:airbnb-photo-mistakes", "content:article:airbnb-staging", "content:article:airbnb-decor", "content:article:airbnb-before-after", "content:article:airbnb-virtual-tour", "content:article:airbnb-photo-shoot", "content:article:airbnb-small-apartment-photos", "content:article:airbnb-luxury-photography", "content:article:airbnb-villa-photography", "content:article:airbnb-riad-photography", "content:article:airbnb-mountain-cabin-photos", "content:article:airbnb-beach-house-photos", "content:article:airbnb-family-home-photos", "content:article:airbnb-studio-photos", "content:article:airbnb-photo-tips", "content:article:airbnb-photo-examples",
] as const;
const transversalPhotoArticleIds = new Set<string>([
  "content:article:airbnb-staging",
  "content:article:airbnb-decor",
]);
const photoClusterArticleIds = photoArticleIds.filter((id) => !transversalPhotoArticleIds.has(id));

const supportingPhotoArticleIds = new Set([
  "content:article:airbnb-photography", "content:article:airbnb-photo-optimization", "content:article:airbnb-photo-tips", "content:article:airbnb-cover-photo", "content:article:airbnb-photo-order", "content:article:airbnb-photo-checklist", "content:article:airbnb-lighting", "content:article:airbnb-photo-editing", "content:article:airbnb-smartphone-photography", "content:article:airbnb-wide-angle-photos", "content:article:airbnb-photo-mistakes", "content:article:airbnb-photo-shoot", "content:article:airbnb-photo-examples",
]);
const photoOptimizationId = "content:article:airbnb-photo-optimization" as const;
const photographyId = "content:article:airbnb-photography" as const;
const photoTipsId = "content:article:airbnb-photo-tips" as const;
const generalPhotoArticleIds = new Set<string>([photoOptimizationId, photographyId, photoTipsId]);
const specializedPhotoArticleIds = photoArticleIds.filter((id) => !generalPhotoArticleIds.has(id));

/** Canonical Phase 1G mappings for the Photos cluster. */
export const photosEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: photosPillarId, targetId: photosTopicId },
  { type: "is_about", sourceId: photosPillarId, targetId: photosTopicId },
  { type: "part_of_cluster", sourceId: photosPillarId, targetId: photosTopicId },
  { type: "applies_to", sourceId: photosPillarId, targetId: airbnbPlatformId },
  { type: "commercial_path_to", sourceId: photosPillarId, targetId: listingOptimizationSolutionId },
  ...photoClusterArticleIds.flatMap((contentId) => [
    { type: "part_of_cluster" as const, sourceId: contentId, targetId: photosTopicId },
    { type: "applies_to" as const, sourceId: contentId, targetId: airbnbPlatformId },
    ...(supportingPhotoArticleIds.has(contentId)
      ? [
          { type: "is_about" as const, sourceId: contentId, targetId: photosTopicId },
          { type: "supports" as const, sourceId: contentId, targetId: photosPillarId },
        ]
      : []),
  ]),
  ...photoArticleIds.map((sourceId) => ({ type: "related_to" as const, sourceId, targetId: photosPillarId })),
  ...specializedPhotoArticleIds.map((sourceId) => ({ type: "supports" as const, sourceId, targetId: photoOptimizationId })),
  { type: "related_to", sourceId: photoOptimizationId, targetId: photographyId },
  { type: "related_to", sourceId: photoOptimizationId, targetId: photoTipsId },
  { type: "related_to", sourceId: photographyId, targetId: photoTipsId },
  { type: "related_to", sourceId: photoTipsId, targetId: photographyId },
  { type: "related_to", sourceId: "content:article:airbnb-staging", targetId: listingOptimizationGuideId },
  { type: "related_to", sourceId: "content:article:airbnb-decor", targetId: listingOptimizationGuideId },
  ...["airbnb-photo-shoot", "airbnb-bedroom-photos", "airbnb-living-room-photos", "airbnb-kitchen-photos", "airbnb-bathroom-photos", "airbnb-exterior-photos", "airbnb-small-apartment-photos", "airbnb-luxury-photography", "airbnb-villa-photography", "airbnb-riad-photography", "airbnb-mountain-cabin-photos", "airbnb-beach-house-photos", "airbnb-family-home-photos", "airbnb-studio-photos", "airbnb-lighting", "airbnb-wide-angle-photos", "airbnb-virtual-tour"].map((slug) => ({ type: "related_to" as const, sourceId: photographyId, targetId: `content:article:${slug}` as const })),
  ...["airbnb-photo-checklist", "airbnb-cover-photo", "airbnb-photo-order", "airbnb-photo-editing", "airbnb-lighting", "airbnb-smartphone-photography"].map((slug) => ({ type: "related_to" as const, sourceId: photoTipsId, targetId: `content:article:${slug}` as const })),
];
