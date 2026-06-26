import type { MediaBinary } from "../mediaBinary";
import type {
  MediaStorageAdapter,
  MediaStorageUploadResult,
} from "../mediaStorageAdapter";

const SUPABASE_MEDIA_BUCKET = "marketing-media";

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

function requireSupabaseMediaStorageEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Supabase media upload failed: ${name} is missing.`);
  }

  return value;
}

async function createSupabaseStorageClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = requireSupabaseMediaStorageEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireSupabaseMediaStorageEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey);
}

function decodeBase64Binary(binary: MediaBinary): Buffer {
  if (binary.encoding !== "base64") {
    throw new Error(
      `Supabase media upload failed: encoding "${binary.encoding}" is not supported yet.`,
    );
  }

  if (!binary.base64) {
    throw new Error("Supabase media upload failed: base64 payload is missing.");
  }

  const normalizedBase64 = binary.base64.replace(/^data:[^;]+;base64,/, "");

  return Buffer.from(normalizedBase64, "base64");
}

export const supabaseMediaStorageAdapter: MediaStorageAdapter = {
  id: "supabase-storage",
  label: "Supabase Storage",

  async upload(binary) {
    if (!isSupabaseMediaStorageEnabled()) {
      return createDisabledUploadResult();
    }

    const supabase = await createSupabaseStorageClient();
    const fileBuffer = decodeBase64Binary(binary);
    const path = binary.filename;
    const { error } = await supabase.storage
      .from(SUPABASE_MEDIA_BUCKET)
      .upload(path, fileBuffer, {
        contentType: binary.mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase media upload failed: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(path);

    return {
      provider: "supabase-storage",
      path,
      previewUrl: publicUrl,
      downloadUrl: publicUrl,
    };
  },

  async delete(path) {
    if (!isSupabaseMediaStorageEnabled() || !path) {
      return;
    }

    const supabase = await createSupabaseStorageClient();
    const { error } = await supabase.storage
      .from(SUPABASE_MEDIA_BUCKET)
      .remove([path]);

    if (error) {
      throw new Error(`Supabase media upload failed: ${error.message}`);
    }

    return;
  },
};
