import type { MediaNarrationAsset } from "../mediaNarrationAsset";
import type {
  MediaNarrationProviderAdapter,
  MediaNarrationProviderGenerateResult,
} from "../mediaNarrationProviderAdapter";
import type { MediaNarrationRequest } from "../mediaNarrationRequest";

function buildFakeNarrationAsset(
  request: MediaNarrationRequest,
): MediaNarrationAsset {
  const now = new Date().toISOString();

  return {
    id: request.id,
    campaignId: request.campaignId,
    text: request.text,
    language: request.language,
    purpose: request.purpose,
    status: "generated",
    generationProvider: "fake-tts",
    providerJobId: `fake-tts-${request.id}`,
    previewUrl: null,
    downloadUrl: null,
    metadata: {
      voice: request.voiceHint ?? "fake-fr-voice",
      durationSeconds: 4,
      model: "fake-tts",
      mimeType: "audio/mpeg",
    },
    createdAt: now,
    updatedAt: now,
  };
}

export const fakeNarrationProvider: MediaNarrationProviderAdapter = {
  id: "fake-tts",
  label: "Fake Narration Provider",

  async generateNarration(
    request,
  ): Promise<MediaNarrationProviderGenerateResult> {
    const asset = buildFakeNarrationAsset(request);

    return {
      provider: "fake-tts",
      status: "generated",
      asset,
      internalBinary: {
        mimeType: "audio/mpeg",
        extension: "mp3",
        base64: Buffer.from(`fake-tts:${request.language}:${request.text}`).toString(
          "base64",
        ),
        filename: `fake-tts/${request.id}.mp3`,
      },
    };
  },
};
