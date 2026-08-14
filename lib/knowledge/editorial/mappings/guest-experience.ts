import type { EditorialMapping } from "../mapping-registry";

const guestExperienceTopicId = "topic:guest-experience" as const;
const guestExperiencePillarId = "content:guide:airbnb-guest-experience" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const guestExperienceArticleIds = [
  "content:article:airbnb-guest-experience",
  "content:article:airbnb-communication",
  "content:article:airbnb-guest-communication-templates",
  "content:article:airbnb-check-in",
  "content:article:airbnb-check-in-instructions",
  "content:article:airbnb-cleanliness",
  "content:article:airbnb-cleanliness-complaints",
  "content:article:airbnb-guest-satisfaction",
] as const;

/** Canonical mapping for the Guest Experience cluster. */
export const guestExperienceEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: guestExperiencePillarId, targetId: guestExperienceTopicId },
  { type: "is_about", sourceId: guestExperiencePillarId, targetId: guestExperienceTopicId },
  { type: "part_of_cluster", sourceId: guestExperiencePillarId, targetId: guestExperienceTopicId },
  { type: "applies_to", sourceId: guestExperiencePillarId, targetId: airbnbPlatformId },
  ...guestExperienceArticleIds.flatMap((sourceId) => [
    { type: "is_about" as const, sourceId, targetId: guestExperienceTopicId },
    { type: "part_of_cluster" as const, sourceId, targetId: guestExperienceTopicId },
    { type: "supports" as const, sourceId, targetId: guestExperiencePillarId },
    { type: "applies_to" as const, sourceId, targetId: airbnbPlatformId },
  ]),
  {
    type: "related_to",
    sourceId: "content:article:airbnb-communication",
    targetId: "content:article:airbnb-check-in",
  },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-guest-experience",
    targetId: "content:article:airbnb-guest-satisfaction",
  },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-cleanliness",
    targetId: "content:article:airbnb-guest-satisfaction",
  },
];
