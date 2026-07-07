import type { MediaAsset } from "../mediaAsset";
import type { MediaMuxRequest, MediaMuxResult, MediaMuxerAdapter } from "../mediaMuxer";
import { createMediaBinaryFilename } from "../mediaBinary";

function buildMuxedAsset(request: MediaMuxRequest): MediaAsset {
  const now = new Date().toISOString();

  return {
    ...request.videoAsset,
    status: "generated",
    previewUrl: null,
    downloadUrl: null,
    generationProvider: request.videoAsset.generationProvider,
    metadata: {
      ...request.videoAsset.metadata,
      hasMuxedNarration: true,
      muxProvider: "fake-mux",
      narrationProvider: request.narrationAsset.generationProvider ?? undefined,
      narrationLanguage: request.narrationAsset.language,
      narrationPurpose: request.narrationAsset.purpose,
      sourceVideoAssetId: request.videoAsset.id,
      sourceAudioAssetId: request.narrationAsset.id,
    },
    warnings: [
      ...(request.videoAsset.warnings ?? []).filter(
        (warning) => warning !== "Media asset has not been generated yet.",
      ),
      "Narration was muxed through the fake muxer for testing.",
    ],
    updatedAt: now,
  };
}

export const fakeMediaMuxer: MediaMuxerAdapter = {
  id: "fake-mux",
  label: "Fake Media Muxer",

  async mux(request): Promise<MediaMuxResult> {
    return {
      provider: "fake-mux",
      status: "generated",
      asset: buildMuxedAsset(request),
      internalBinary: {
        mimeType: "video/mp4",
        extension: "mp4",
        base64: Buffer.from(
          `fake-mux:${request.videoBinary.base64}:${request.narrationBinary.base64}`,
        ).toString("base64"),
        filename: createMediaBinaryFilename({
          id: request.videoAsset.id,
          provider: "ffmpeg",
          extension: "mp4",
        }),
      },
    };
  },
};
