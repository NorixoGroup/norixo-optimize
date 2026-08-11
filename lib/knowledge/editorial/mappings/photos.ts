import type { EditorialMapping } from "../mapping-registry";

const photosPillarId = "content:guide:airbnb-photo-optimization" as const;
const photosTopicId = "topic:photos" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const photoArticleIds = [
  "content:article:airbnb-photography", "content:article:airbnb-photo-optimization", "content:article:airbnb-cover-photo", "content:article:airbnb-photo-order", "content:article:airbnb-photo-checklist", "content:article:airbnb-bedroom-photos", "content:article:airbnb-living-room-photos", "content:article:airbnb-kitchen-photos", "content:article:airbnb-bathroom-photos", "content:article:airbnb-exterior-photos", "content:article:airbnb-lighting", "content:article:airbnb-photo-editing", "content:article:airbnb-smartphone-photography", "content:article:airbnb-wide-angle-photos", "content:article:airbnb-photo-mistakes", "content:article:airbnb-staging", "content:article:airbnb-decor", "content:article:airbnb-before-after", "content:article:airbnb-virtual-tour", "content:article:airbnb-photo-shoot", "content:article:airbnb-small-apartment-photos", "content:article:airbnb-luxury-photography", "content:article:airbnb-villa-photography", "content:article:airbnb-riad-photography", "content:article:airbnb-mountain-cabin-photos", "content:article:airbnb-beach-house-photos", "content:article:airbnb-family-home-photos", "content:article:airbnb-studio-photos", "content:article:airbnb-photo-tips", "content:article:airbnb-photo-examples",
] as const;

const supportingPhotoArticleIds = new Set([
  "content:article:airbnb-photography", "content:article:airbnb-photo-optimization", "content:article:airbnb-photo-tips", "content:article:airbnb-cover-photo", "content:article:airbnb-photo-order", "content:article:airbnb-photo-checklist", "content:article:airbnb-lighting", "content:article:airbnb-photo-editing", "content:article:airbnb-smartphone-photography", "content:article:airbnb-wide-angle-photos", "content:article:airbnb-photo-mistakes", "content:article:airbnb-staging", "content:article:airbnb-decor", "content:article:airbnb-photo-shoot", "content:article:airbnb-photo-examples",
]);

/** Canonical Phase 1G mappings for the Photos cluster. */
export const photosEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: photosPillarId, targetId: photosTopicId },
  { type: "is_about", sourceId: photosPillarId, targetId: photosTopicId },
  { type: "part_of_cluster", sourceId: photosPillarId, targetId: photosTopicId },
  { type: "applies_to", sourceId: photosPillarId, targetId: airbnbPlatformId },
  ...photoArticleIds.flatMap((contentId) => [
    { type: "part_of_cluster" as const, sourceId: contentId, targetId: photosTopicId },
    { type: "applies_to" as const, sourceId: contentId, targetId: airbnbPlatformId },
    ...(supportingPhotoArticleIds.has(contentId)
      ? [
          { type: "is_about" as const, sourceId: contentId, targetId: photosTopicId },
          { type: "supports" as const, sourceId: contentId, targetId: photosPillarId },
        ]
      : []),
  ]),
];
