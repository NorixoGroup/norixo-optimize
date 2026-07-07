export type MetaPreviewPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok";

export type MetaPreviewStatus =
  | "draft"
  | "ready_for_review"
  | "publishing"
  | "awaiting_tiktok_completion"
  | "missing_asset"
  | "blocked"
  | "approved"
  | "published";

export type MetaPreviewAssetKind =
  | "image"
  | "video"
  | "reel"
  | "carousel"
  | "text_only";

export type MetaPreviewAsset = {
  kind: MetaPreviewAssetKind;
  assetUrl?: string;
  thumbnailUrl?: string;
  altText?: string;
  prompt?: string;
  warnings: string[];
};

export type MetaPlatformPreview = {
  platform: MetaPreviewPlatform;
  status: MetaPreviewStatus;
  title: string;
  caption: string;
  cta: string;
  hashtags: string[];
  asset: MetaPreviewAsset;
  platformNotes: string[];
  manualPublishChecklist: string[];
  warnings: string[];
  approvalRequired: true;
  publishAction: "manual_review_required";
};

export type MetaPreviewModel = {
  mode: "preview_only";
  canPublish: false;
  requiresApproval: true;
  previews: MetaPlatformPreview[];
  approvalStatus: "pending_review" | "approved" | "rejected";
  updatedAt: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEmptyMetaPreviewModel(): MetaPreviewModel {
  return {
    mode: "preview_only",
    canPublish: false,
    requiresApproval: true,
    previews: [],
    approvalStatus: "pending_review",
    updatedAt: new Date().toISOString(),
  };
}

export function isMetaPreviewModel(value: unknown): value is MetaPreviewModel {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    value.mode === "preview_only" &&
    value.canPublish === false &&
    value.requiresApproval === true &&
    Array.isArray(value.previews) &&
    ["pending_review", "approved", "rejected"].includes(String(value.approvalStatus)) &&
    typeof value.updatedAt === "string"
  );
}

export function isMetaPlatformPreview(value: unknown): value is MetaPlatformPreview {
  if (!isPlainObject(value)) {
    return false;
  }

  const asset = value.asset;

  return (
    ["facebook", "instagram", "linkedin", "tiktok"].includes(
      String(value.platform),
    ) &&
    [
      "draft",
      "ready_for_review",
      "publishing",
      "awaiting_tiktok_completion",
      "missing_asset",
      "blocked",
      "approved",
      "published",
    ].includes(String(value.status)) &&
    typeof value.title === "string" &&
    typeof value.caption === "string" &&
    typeof value.cta === "string" &&
    isStringArray(value.hashtags) &&
    isPlainObject(asset) &&
    ["image", "video", "reel", "carousel", "text_only"].includes(String(asset.kind)) &&
    isStringArray(asset.warnings) &&
    isStringArray(value.platformNotes) &&
    isStringArray(value.manualPublishChecklist) &&
    isStringArray(value.warnings) &&
    value.approvalRequired === true &&
    value.publishAction === "manual_review_required"
  );
}
