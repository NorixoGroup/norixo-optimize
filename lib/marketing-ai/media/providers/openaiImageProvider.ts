import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "../mediaProviderAdapter";

function buildUnconfiguredResult(): MediaProviderGenerateResult {
  return {
    provider: "openai",
    status: "failed",
    error: "Provider not configured.",
  };
}

export const openaiImageProvider: MediaProviderAdapter = {
  id: "openai",
  label: "OpenAI Image Provider",
  capabilities: ["image", "thumbnail"],

  async generateImage() {
    return buildUnconfiguredResult();
  },

  async generateVideo() {
    return buildUnconfiguredResult();
  },

  async getStatus() {
    return buildUnconfiguredResult();
  },
};
