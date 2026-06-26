import {
  createMediaBinaryFilename,
  supabaseMediaStorageAdapter,
} from "../lib/marketing-ai/media";
import type { MediaBinary } from "../lib/marketing-ai/media";

const TRANSPARENT_PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0x8AAAAASUVORK5CYII=";

async function main() {
  if (process.env.SUPABASE_MEDIA_STORAGE_ENABLED !== "true") {
    console.log(
      "Manual Supabase media storage test skipped: SUPABASE_MEDIA_STORAGE_ENABLED is not set to true.",
    );
    process.exit(0);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error(
      "Manual Supabase media storage test failed: NEXT_PUBLIC_SUPABASE_URL is missing.",
    );
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Manual Supabase media storage test failed: SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    process.exit(1);
  }

  const binary: MediaBinary = {
    id: "manual-supabase-storage-test",
    kind: "image",
    provider: "unknown",
    mimeType: "image/png",
    extension: "png",
    filename: createMediaBinaryFilename({
      id: "manual-supabase-storage-test",
      provider: "unknown",
      extension: "png",
    }),
    encoding: "base64",
    base64: TRANSPARENT_PNG_1X1_BASE64,
    buffer: null,
    sourceUrl: null,
    sizeBytes: null,
    createdAt: new Date().toISOString(),
  };

  const upload = await supabaseMediaStorageAdapter.upload(binary);

  console.log(
    JSON.stringify(
      {
        provider: upload.provider,
        path: upload.path,
        hasPreviewUrl: Boolean(upload.previewUrl),
        hasDownloadUrl: Boolean(upload.downloadUrl),
      },
      null,
      2,
    ),
  );

  if (upload.path) {
    await supabaseMediaStorageAdapter.delete(upload.path);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unknown manual Supabase media storage error.",
  );
  process.exit(1);
});
