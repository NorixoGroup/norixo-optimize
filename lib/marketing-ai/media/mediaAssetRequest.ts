import type {
  MediaAssetKind,
  MediaAssetPlatform,
  MediaAssetRatio,
} from "./mediaAsset";

export type MediaAssetRequest = {
  id: string;
  kind: MediaAssetKind;
  platform: MediaAssetPlatform;
  ratio: MediaAssetRatio;
  targetLanguage: string;
  title: string;
  creativeBrief: string;
  prompt: string;
  negativePrompt?: string;
  expectedDurationSeconds?: number;
  required: boolean;
};
