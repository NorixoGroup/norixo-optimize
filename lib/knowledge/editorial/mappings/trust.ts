import type { EditorialMapping } from "../mapping-registry";

const trustTopicId = "topic:trust" as const;
const trustPillarId = "content:guide:airbnb-trust-optimization" as const;
const airbnbPlatformId = "platform:airbnb" as const;

const trustPrimaryArticleIds = [
  "content:article:airbnb-trust-signals",
  "content:article:airbnb-superhost",
] as const;

const reviewsPrimaryArticleIds = [
  "content:article:airbnb-reviews",
  "content:article:airbnb-rating",
  "content:article:airbnb-review-response",
] as const;

/** Canonical mapping for the Trust cluster. */
export const trustEditorialMappings: readonly EditorialMapping[] = [
  { type: "pillar_for", sourceId: trustPillarId, targetId: trustTopicId },
  { type: "is_about", sourceId: trustPillarId, targetId: trustTopicId },
  { type: "part_of_cluster", sourceId: trustPillarId, targetId: trustTopicId },
  { type: "applies_to", sourceId: trustPillarId, targetId: airbnbPlatformId },
  ...trustPrimaryArticleIds.flatMap((sourceId) => [
    { type: "is_about" as const, sourceId, targetId: trustTopicId },
    { type: "part_of_cluster" as const, sourceId, targetId: trustTopicId },
    { type: "supports" as const, sourceId, targetId: trustPillarId },
    { type: "applies_to" as const, sourceId, targetId: airbnbPlatformId },
  ]),
  ...reviewsPrimaryArticleIds.flatMap((sourceId) => [
    { type: "part_of_cluster" as const, sourceId, targetId: trustTopicId },
    { type: "supports" as const, sourceId, targetId: trustPillarId },
    { type: "applies_to" as const, sourceId, targetId: airbnbPlatformId },
  ]),
  {
    type: "related_to",
    sourceId: "content:article:airbnb-reviews",
    targetId: "content:article:airbnb-rating",
  },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-reviews",
    targetId: "content:article:airbnb-review-response",
  },
  {
    type: "related_to",
    sourceId: "content:article:airbnb-trust-signals",
    targetId: "content:article:airbnb-superhost",
  },
];
