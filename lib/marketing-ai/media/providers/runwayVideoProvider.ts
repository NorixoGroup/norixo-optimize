import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "../mediaProviderAdapter";

function buildUnconfiguredResult(): MediaProviderGenerateResult {
  return {
    provider: "runway",
    status: "failed",
    error: "Provider not configured.",
  };
}

export const runwayVideoProvider: MediaProviderAdapter = {
  id: "runway",
  label: "Runway Video Provider",
  capabilities: ["video", "reel"],

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
