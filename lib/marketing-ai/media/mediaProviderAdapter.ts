import type { MediaAsset, MediaAssetStatus } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";

export type MediaProviderCapability =
  | "image"
  | "video"
  | "reel"
  | "thumbnail";

export type MediaProviderGenerateResult = {
  provider: string;
  externalJobId?: string;
  status: MediaAssetStatus;
  asset?: Partial<MediaAsset>;
  internalBinary?: {
    mimeType: string;
    extension: string;
    base64: string;
    filename: string;
  };
  error?: string;
};

export interface MediaProviderAdapter {
  id: string;
  label: string;
  capabilities: MediaProviderCapability[];

  generateImage(
    request: MediaAssetRequest,
  ): Promise<MediaProviderGenerateResult>;

  generateVideo(
    request: MediaAssetRequest,
  ): Promise<MediaProviderGenerateResult>;

  getStatus(
    externalJobId: string,
  ): Promise<MediaProviderGenerateResult>;
}
