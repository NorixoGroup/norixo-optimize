import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "../mediaProviderAdapter";

function buildUnconfiguredResult(): MediaProviderGenerateResult {
  return {
    provider: "fal",
    status: "failed",
    error: "Provider not configured.",
  };
}

export const falImageProvider: MediaProviderAdapter = {
  id: "fal",
  label: "FAL Image Provider",
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
