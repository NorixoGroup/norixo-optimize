import type { MediaAsset } from "./mediaAsset";
import type { MediaInternalBinary } from "./mediaBinary";
import type { MediaNarrationAsset } from "./mediaNarrationAsset";

export type MediaMuxRequest = {
  id: string;
  videoAsset: MediaAsset;
  videoBinary: MediaInternalBinary;
  narrationAsset: MediaNarrationAsset;
  narrationBinary: MediaInternalBinary;
};

export type MediaMuxResult = {
  provider: string;
  status: "generated" | "failed";
  asset?: MediaAsset;
  internalBinary?: MediaInternalBinary;
  error?: string;
};

export interface MediaMuxerAdapter {
  id: string;
  label: string;

  mux(request: MediaMuxRequest): Promise<MediaMuxResult>;
}
