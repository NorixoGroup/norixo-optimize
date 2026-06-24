export type MediaAssetKind =
  | "image"
  | "video"
  | "reel"
  | "story"
  | "carousel"
  | "thumbnail"
  | "cover";

export type MediaAssetStatus =
  | "missing"
  | "queued"
  | "generating"
  | "generated"
  | "approved"
  | "rejected"
  | "downloaded"
  | "published"
  | "failed";

export type MediaAssetPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "generic";

export type MediaAssetRatio = "1:1" | "4:5" | "9:16" | "16:9";

export type MediaAssetFormat = "png" | "jpg" | "webp" | "mp4" | "mov" | "gif";

export type MediaAsset = {
  id: string;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  platform: MediaAssetPlatform;
  ratio: MediaAssetRatio;
  format?: MediaAssetFormat;
  language?: string;
  variant?: string;
  title?: string;
  description?: string;
  prompt?: string;
  negativePrompt?: string;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  thumbnailUrl?: string | null;
  generationProvider?: string | null;
  providerJobId?: string | null;
  metadata?: {
    width?: number;
    height?: number;
    durationSeconds?: number;
    sizeBytes?: number;
    style?: string;
    voice?: string;
    music?: string;
    model?: string;
  };
  warnings?: string[];
  createdAt: string;
  updatedAt: string;
};
