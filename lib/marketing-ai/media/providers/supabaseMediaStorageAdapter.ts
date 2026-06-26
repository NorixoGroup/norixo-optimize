import type {
  MediaStorageAdapter,
  MediaStorageUploadResult,
} from "../mediaStorageAdapter";

export function isSupabaseMediaStorageEnabled(): boolean {
  return process.env.SUPABASE_MEDIA_STORAGE_ENABLED === "true";
}

function createDisabledUploadResult(): MediaStorageUploadResult {
  return {
    provider: "supabase-storage",
    path: "",
    previewUrl: null,
    downloadUrl: null,
  };
}

export const supabaseMediaStorageAdapter: MediaStorageAdapter = {
  id: "supabase-storage",
  label: "Supabase Storage",

  async upload() {
    if (!isSupabaseMediaStorageEnabled()) {
      return createDisabledUploadResult();
    }

    await import("@supabase/supabase-js");

    return createDisabledUploadResult();
  },

  async delete() {
    return;
  },
};
