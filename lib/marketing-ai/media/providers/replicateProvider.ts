import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "../mediaProviderAdapter";

function buildUnconfiguredResult(): MediaProviderGenerateResult {
  return {
    provider: "replicate",
    status: "failed",
    error: "Provider not configured.",
  };
}

export const replicateProvider: MediaProviderAdapter = {
  id: "replicate",
  label: "Replicate Provider",
  capabilities: ["image", "video", "reel", "thumbnail"],

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
