import type { MediaNarrationAsset } from "./mediaNarrationAsset";
import type { MediaInternalBinary } from "./mediaBinary";
import type { MediaNarrationRequest } from "./mediaNarrationRequest";

export type MediaNarrationProviderGenerateResult = {
  provider: string;
  status: MediaNarrationAsset["status"];
  asset?: MediaNarrationAsset;
  internalBinary?: MediaInternalBinary;
  error?: string;
};

export interface MediaNarrationProviderAdapter {
  id: string;
  label: string;

  generateNarration(
    request: MediaNarrationRequest,
  ): Promise<MediaNarrationProviderGenerateResult>;
}
