import type { MediaAssetRequest } from "../mediaAssetRequest";
import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "../mediaProviderAdapter";

function buildBaseAsset(request: MediaAssetRequest) {
  const now = new Date().toISOString();

  return {
    id: request.id,
    kind: request.kind,
    status: "generated" as const,
    platform: request.platform,
    ratio: request.ratio,
    prompt: request.prompt,
    negativePrompt: request.negativePrompt,
    previewUrl: null,
    downloadUrl: null,
    thumbnailUrl: null,
    generationProvider: "fake",
    createdAt: now,
    updatedAt: now,
  };
}

function buildImageResult(
  request: MediaAssetRequest,
): MediaProviderGenerateResult {
  const externalJobId = `fake-image-${request.id}`;

  return {
    provider: "fake",
    externalJobId,
    status: "generated",
    asset: {
      ...buildBaseAsset(request),
      providerJobId: externalJobId,
      metadata: {
        width: 1080,
        height: 1080,
        model: "fake",
      },
    },
  };
}

function buildVideoResult(
  request: MediaAssetRequest,
): MediaProviderGenerateResult {
  const externalJobId = `fake-video-${request.id}`;

  return {
    provider: "fake",
    externalJobId,
    status: "generated",
    asset: {
      ...buildBaseAsset(request),
      providerJobId: externalJobId,
      metadata: {
        durationSeconds: request.expectedDurationSeconds ?? 30,
        model: "fake",
      },
    },
  };
}

export const fakeMediaProvider: MediaProviderAdapter = {
  id: "fake",
  label: "Fake Media Provider",
  capabilities: ["image", "video", "reel", "thumbnail"],

  async generateImage(request) {
    return buildImageResult(request);
  },

  async generateVideo(request) {
    return buildVideoResult(request);
  },

  async getStatus(externalJobId) {
    return {
      provider: "fake",
      externalJobId,
      status: "generated",
    };
  },
};
