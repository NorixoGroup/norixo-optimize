import { articles, type Article } from "@/data/articles";
import type {
  PhotoAuditContent,
  PhotoCannibalizationGroup,
  PhotoSemanticGroupId,
  PhotosAuditReport,
} from "./photos-audit-types";

const groupBySlug: Record<string, { group: PhotoSemanticGroupId; specificity: PhotoAuditContent["specificity"] }> = {
  "airbnb-photography": { group: "general-photography", specificity: "general" },
  "airbnb-photo-optimization": { group: "general-photography", specificity: "general" },
  "airbnb-photo-tips": { group: "general-photography", specificity: "general" },
  "airbnb-photo-examples": { group: "general-photography", specificity: "general" },
  "airbnb-cover-photo": { group: "cover-gallery", specificity: "functional" },
  "airbnb-photo-order": { group: "cover-gallery", specificity: "functional" },
  "airbnb-photo-checklist": { group: "cover-gallery", specificity: "functional" },
  "airbnb-photo-shoot": { group: "cover-gallery", specificity: "functional" },
  "airbnb-bedroom-photos": { group: "room-photography", specificity: "room" },
  "airbnb-living-room-photos": { group: "room-photography", specificity: "room" },
  "airbnb-kitchen-photos": { group: "room-photography", specificity: "room" },
  "airbnb-bathroom-photos": { group: "room-photography", specificity: "room" },
  "airbnb-exterior-photos": { group: "room-photography", specificity: "room" },
  "airbnb-lighting": { group: "technical-preparation", specificity: "technical" },
  "airbnb-photo-editing": { group: "technical-preparation", specificity: "technical" },
  "airbnb-smartphone-photography": { group: "technical-preparation", specificity: "technical" },
  "airbnb-wide-angle-photos": { group: "technical-preparation", specificity: "technical" },
  "airbnb-photo-mistakes": { group: "technical-preparation", specificity: "technical" },
  "airbnb-staging": { group: "technical-preparation", specificity: "technical" },
  "airbnb-decor": { group: "technical-preparation", specificity: "technical" },
  "airbnb-before-after": { group: "technical-preparation", specificity: "technical" },
  "airbnb-virtual-tour": { group: "technical-preparation", specificity: "technical" },
  "airbnb-small-apartment-photos": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-luxury-photography": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-villa-photography": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-riad-photography": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-mountain-cabin-photos": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-beach-house-photos": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-family-home-photos": { group: "property-type-photography", specificity: "property_type" },
  "airbnb-studio-photos": { group: "property-type-photography", specificity: "property_type" },
};

function isPhotoCandidate(article: Article): boolean {
  const content = [article.title, article.description, ...article.sections.map((section) => section.title)]
    .join(" ")
    .toLowerCase();

  return article.cluster === "Airbnb Photos" && /photo|photography|lighting|staging|decor|virtual tour|wide-angle/.test(content);
}

function toAuditContent(article: Article): PhotoAuditContent | undefined {
  const classification = groupBySlug[article.slug];

  if (!classification || !isPhotoCandidate(article)) return undefined;

  return {
    id: `content:article:${article.slug}`,
    slug: article.slug,
    title: article.title,
    description: article.description,
    cluster: article.cluster,
    relatedGuides: [...article.relatedGuides],
    relatedRankings: [...article.relatedRankings],
    intent: "informational",
    semanticGroup: classification.group,
    specificity: classification.specificity,
  };
}

function membersFor(contents: readonly PhotoAuditContent[], slugs: readonly string[]): PhotoAuditContent[] {
  return slugs.flatMap((slug) => {
    const content = contents.find((candidate) => candidate.slug === slug);
    return content ? [content] : [];
  });
}

function buildCannibalizationGroups(contents: readonly PhotoAuditContent[]): PhotoCannibalizationGroup[] {
  const definitions = [
    {
      id: "general-photo-optimization",
      slugs: ["airbnb-photography", "airbnb-photo-optimization", "airbnb-photo-tips"],
      reasons: ["same informational intent", "same guide and ranking destinations", "overlapping general photo-optimization scope"],
      severity: "high" as const,
      recommendedGovernanceAction: "candidate_primary_secondary" as const,
    },
    {
      id: "cover-gallery-execution",
      slugs: ["airbnb-cover-photo", "airbnb-photo-order", "airbnb-photo-checklist", "airbnb-photo-shoot"],
      reasons: ["same informational intent", "same guide and ranking destinations", "overlapping gallery-preparation and sequencing scope"],
      severity: "high" as const,
      recommendedGovernanceAction: "candidate_reposition" as const,
    },
    {
      id: "technical-preparation-template",
      slugs: ["airbnb-lighting", "airbnb-photo-editing", "airbnb-smartphone-photography", "airbnb-wide-angle-photos", "airbnb-photo-mistakes", "airbnb-staging", "airbnb-decor"],
      reasons: ["same informational intent", "same guide and ranking destinations", "identical section-template family"],
      severity: "medium" as const,
      recommendedGovernanceAction: "needs_review" as const,
    },
    {
      id: "room-photography-template",
      slugs: ["airbnb-bedroom-photos", "airbnb-living-room-photos", "airbnb-kitchen-photos", "airbnb-bathroom-photos", "airbnb-exterior-photos"],
      reasons: ["same guide and ranking destinations", "identical section-template family", "distinct room-specific search scope"],
      severity: "low" as const,
      recommendedGovernanceAction: "keep_distinct" as const,
    },
    {
      id: "property-type-photography-template",
      slugs: ["airbnb-small-apartment-photos", "airbnb-luxury-photography", "airbnb-villa-photography", "airbnb-riad-photography", "airbnb-mountain-cabin-photos", "airbnb-beach-house-photos", "airbnb-family-home-photos", "airbnb-studio-photos"],
      reasons: ["same guide and ranking destinations", "identical section-template family", "distinct property-type search scope"],
      severity: "low" as const,
      recommendedGovernanceAction: "keep_distinct" as const,
    },
  ];

  return definitions.flatMap((definition) => {
    const members = membersFor(contents, definition.slugs);
    const allInformational = members.every((member) => member.intent === "informational");
    const sameGuides = members.every(
      (member) => JSON.stringify(member.relatedGuides) === JSON.stringify(members[0]?.relatedGuides)
    );
    const sameRankings = members.every(
      (member) => JSON.stringify(member.relatedRankings) === JSON.stringify(members[0]?.relatedRankings)
    );

    return members.length === definition.slugs.length && allInformational && sameGuides && sameRankings
      ? [{ ...definition, members: members.map((member) => member.id) }]
      : [];
  });
}

export function auditPhotosCluster(source: readonly Article[] = articles): PhotosAuditReport {
  const contents = source.flatMap((article) => {
    const content = toAuditContent(article);
    return content ? [content] : [];
  });
  const groupOrder: PhotoSemanticGroupId[] = [
    "general-photography",
    "cover-gallery",
    "room-photography",
    "technical-preparation",
    "property-type-photography",
  ];

  return {
    contents,
    semanticGroups: groupOrder.map((id) => ({
      id,
      members: contents.filter((content) => content.semanticGroup === id).map((content) => content.id),
    })),
    cannibalizationGroups: buildCannibalizationGroups(contents),
    futureSubtopicCandidates: [
      "cover-first-photo",
      "gallery-sequencing",
      "room-photography",
      "property-type-photography",
      "photo-preparation",
    ],
  };
}

export function getPhotoCannibalizationGroups(): PhotoCannibalizationGroup[] {
  return auditPhotosCluster().cannibalizationGroups;
}
