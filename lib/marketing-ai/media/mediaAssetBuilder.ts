import type { MediaAsset } from "./mediaAsset";
import type { MediaAssetRequest } from "./mediaAssetRequest";

export function buildMediaAssets(
  requests: MediaAssetRequest[],
): MediaAsset[] {
  const now = new Date().toISOString();

  return requests.map((request) => ({
    id: request.id,
    kind: request.kind,
    status: "missing",
    platform: request.platform,
    ratio: request.ratio,
    language: request.targetLanguage,
    title: request.title,
    description: request.creativeBrief,
    prompt: request.prompt,
    negativePrompt: request.negativePrompt,
    previewUrl: null,
    downloadUrl: null,
    thumbnailUrl: null,
    generationProvider: null,
    providerJobId: null,
    metadata: {},
    warnings: ["Media asset has not been generated yet."],
    createdAt: now,
    updatedAt: now,
  }));
}
