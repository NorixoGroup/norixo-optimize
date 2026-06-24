import type { MarketingCampaignFormat } from "../campaigns/campaignModel";
import type {
  AssetReference,
  PublisherAssetReferences,
} from "./assetReferences";

export type PublicationPackPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "reddit"
  | "x"
  | "forum"
  | "community"
  | "other";

export type PublicationPackStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "published";

export type PublicationPackAssetType =
  | "image"
  | "video"
  | "document"
  | "link"
  | "other";

export type PublicationPackAssetRef = {
  type: PublicationPackAssetType;
  label: string;
  url?: string;
  path?: string;
  notes?: string;
};

export type CreatePublicationPackInput = {
  id?: string;
  campaignId?: string;
  platform?: PublicationPackPlatform | string;
  format?: MarketingCampaignFormat | string;
  language?: string;
  status?: PublicationPackStatus | string;
  title?: string;
  hook?: string;
  caption?: string;
  cta?: string;
  hashtags?: string[];
  visualBrief?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  assetReferences?: PublisherAssetReferences;
  approvalRequired?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes?: string;
  sourceStage?: string;
  communityTarget?: string;
  localizedVariantOf?: string;
  qualitySummary?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicationPack = {
  id: string;
  campaignId: string;
  platform: PublicationPackPlatform;
  format: string;
  language: string;
  status: PublicationPackStatus;
  title: string;
  hook?: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualBrief?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  assetReferences?: PublisherAssetReferences;
  approvalRequired: true;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes?: string;
  sourceStage?: string;
  communityTarget?: string;
  localizedVariantOf?: string;
  qualitySummary?: string;
  createdAt: string;
  updatedAt: string;
};

const PUBLICATION_PACK_PLATFORMS: PublicationPackPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "reddit",
  "x",
  "forum",
  "community",
  "other",
];

const PUBLICATION_PACK_STATUSES: PublicationPackStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
  "rejected",
  "published",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isAssetReference(value: unknown): value is AssetReference {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (value.kind === "image" ||
      value.kind === "video" ||
      value.kind === "reel" ||
      value.kind === "carousel") &&
    (value.status === "missing" ||
      value.status === "generated" ||
      value.status === "uploaded") &&
    (value.prompt === undefined || typeof value.prompt === "string") &&
    (value.localPath === undefined || typeof value.localPath === "string") &&
    (value.publicUrl === undefined || typeof value.publicUrl === "string") &&
    (value.thumbnailUrl === undefined || typeof value.thumbnailUrl === "string")
  );
}

function isPublisherAssetReferences(
  value: unknown,
): value is PublisherAssetReferences {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.image === undefined || isAssetReference(value.image)) &&
    (value.video === undefined || isAssetReference(value.video)) &&
    (value.reel === undefined || isAssetReference(value.reel))
  );
}

export function normalizePublicationPackPlatform(
  value: string,
): PublicationPackPlatform | null {
  const normalized = value.trim().toLowerCase();

  return PUBLICATION_PACK_PLATFORMS.includes(normalized as PublicationPackPlatform)
    ? (normalized as PublicationPackPlatform)
    : null;
}

export function normalizePublicationPackStatus(
  value: string,
): PublicationPackStatus | null {
  const normalized = value.trim().toLowerCase();

  return PUBLICATION_PACK_STATUSES.includes(normalized as PublicationPackStatus)
    ? (normalized as PublicationPackStatus)
    : null;
}

export function isPublicationPack(value: unknown): value is PublicationPack {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.campaignId === "string" &&
    typeof value.platform === "string" &&
    normalizePublicationPackPlatform(value.platform) !== null &&
    typeof value.format === "string" &&
    typeof value.language === "string" &&
    typeof value.status === "string" &&
    normalizePublicationPackStatus(value.status) !== null &&
    typeof value.title === "string" &&
    (value.hook === undefined || typeof value.hook === "string") &&
    typeof value.caption === "string" &&
    typeof value.cta === "string" &&
    isStringArray(value.hashtags) &&
    (value.visualBrief === undefined || typeof value.visualBrief === "string") &&
    (value.imagePrompt === undefined || typeof value.imagePrompt === "string") &&
    (value.videoPrompt === undefined || typeof value.videoPrompt === "string") &&
    (value.assetReferences === undefined ||
      isPublisherAssetReferences(value.assetReferences)) &&
    value.approvalRequired === true &&
    (value.approvedBy === undefined || typeof value.approvedBy === "string") &&
    (value.approvedAt === undefined ||
      (typeof value.approvedAt === "string" &&
        normalizeDateString(value.approvedAt) !== null)) &&
    (value.rejectedReason === undefined || typeof value.rejectedReason === "string") &&
    (value.notes === undefined || typeof value.notes === "string") &&
    (value.sourceStage === undefined || typeof value.sourceStage === "string") &&
    (value.communityTarget === undefined || typeof value.communityTarget === "string") &&
    (value.localizedVariantOf === undefined ||
      typeof value.localizedVariantOf === "string") &&
    (value.qualitySummary === undefined || typeof value.qualitySummary === "string") &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createPublicationPack(
  input: CreatePublicationPackInput = {},
): PublicationPack {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const platform =
    input.platform && normalizePublicationPackPlatform(input.platform)
      ? normalizePublicationPackPlatform(input.platform)
      : "instagram";
  const status =
    input.status && normalizePublicationPackStatus(input.status)
      ? normalizePublicationPackStatus(input.status)
      : "draft";

  return {
    id: input.id?.trim() || `publication-pack-${createdAt}`,
    campaignId: input.campaignId?.trim() || "campaign-unknown",
    platform: platform ?? "instagram",
    format: input.format?.trim() || "post",
    language: input.language?.trim() || "fr",
    status: status ?? "draft",
    title: input.title?.trim() || "Publication Norixo",
    hook: normalizeOptionalString(input.hook),
    caption: input.caption?.trim() || "",
    cta: input.cta?.trim() || "Découvrir Norixo.io",
    hashtags: isStringArray(input.hashtags) ? input.hashtags : [],
    visualBrief: normalizeOptionalString(input.visualBrief),
    imagePrompt: normalizeOptionalString(input.imagePrompt),
    videoPrompt: normalizeOptionalString(input.videoPrompt),
    assetReferences:
      input.assetReferences && isPublisherAssetReferences(input.assetReferences)
        ? input.assetReferences
        : undefined,
    approvalRequired: true,
    approvedBy: normalizeOptionalString(input.approvedBy),
    approvedAt:
      input.approvedAt && normalizeDateString(input.approvedAt)
        ? normalizeDateString(input.approvedAt) ?? undefined
        : undefined,
    rejectedReason: normalizeOptionalString(input.rejectedReason),
    notes: normalizeOptionalString(input.notes),
    sourceStage: normalizeOptionalString(input.sourceStage),
    communityTarget: normalizeOptionalString(input.communityTarget),
    localizedVariantOf: normalizeOptionalString(input.localizedVariantOf),
    qualitySummary: normalizeOptionalString(input.qualitySummary),
    createdAt,
    updatedAt,
  };
}
