export type MediaNarrationAssetStatus = "missing" | "generated" | "failed";

export type MediaNarrationAsset = {
  id: string;
  campaignId: string;
  text: string;
  language: string;
  purpose: "video_voiceover";
  status: MediaNarrationAssetStatus;
  generationProvider: string | null;
  providerJobId?: string | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  metadata?: {
    voice?: string;
    speed?: number;
    durationSeconds?: number;
    model?: string;
    mimeType?: string;
    sourceUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
};
