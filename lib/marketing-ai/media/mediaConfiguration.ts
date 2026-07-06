export type MediaImageProviderId = "fake" | "openai" | "fal" | "replicate";
export type MediaVideoProviderId =
  | "fake"
  | "runway"
  | "fal"
  | "replicate";
export type MediaStorageProviderId = "none" | "supabase";

export type MediaConfigurationSource = "default" | "environment" | "persisted";

export type MediaConfiguration = {
  imageProvider: MediaImageProviderId;
  videoProvider: MediaVideoProviderId;
  storageProvider: MediaStorageProviderId;
  uploadEnabled: boolean;
  pollingEnabled: boolean;
};

export const DEFAULT_MEDIA_CONFIGURATION: MediaConfiguration = {
  imageProvider: "fake",
  videoProvider: "fake",
  storageProvider: "none",
  uploadEnabled: false,
  pollingEnabled: false,
};

export function getMediaConfiguration(): MediaConfiguration {
  const imageProvider: MediaImageProviderId =
    process.env.OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED === "true"
      ? "openai"
      : "fake";
  const videoProvider: MediaVideoProviderId =
    process.env.FAL_VIDEO_PROVIDER_ENABLED === "true" &&
    typeof process.env.FAL_KEY === "string" &&
    process.env.FAL_KEY.trim().length > 0
      ? "fal"
      : "fake";
  const storageProvider: MediaStorageProviderId =
    process.env.SUPABASE_MEDIA_STORAGE_ENABLED === "true"
      ? "supabase"
      : "none";
  const uploadEnabled =
    storageProvider === "supabase" &&
    (imageProvider === "openai" || videoProvider === "fal");
  const pollingEnabled = videoProvider === "fal";

  return {
    ...DEFAULT_MEDIA_CONFIGURATION,
    imageProvider,
    videoProvider,
    storageProvider,
    uploadEnabled,
    pollingEnabled,
  };
}
