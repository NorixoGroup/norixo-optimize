import { uploadMediaBinary } from "../lib/marketing-ai/media/mediaUploadService";
import { createMediaBinaryFilename } from "../lib/marketing-ai/media/mediaBinary";
import { supabaseMediaStorageAdapter } from "../lib/marketing-ai/media/providers/supabaseMediaStorageAdapter";
import { openaiImageProvider } from "../lib/marketing-ai/media/providers/openaiImageProvider";
import type { MediaBinary } from "../lib/marketing-ai/media/mediaBinary";
import type { MediaAssetRequest } from "../lib/marketing-ai/media/mediaAssetRequest";

async function main() {
  if (process.env.OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED !== "true") {
    console.log(
      "Manual OpenAI to Supabase media test skipped: OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED is not set to true.",
    );
    process.exit(0);
  }

  if (process.env.SUPABASE_MEDIA_STORAGE_ENABLED !== "true") {
    console.log(
      "Manual OpenAI to Supabase media test skipped: SUPABASE_MEDIA_STORAGE_ENABLED is not set to true.",
    );
    process.exit(0);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "Manual OpenAI to Supabase media test failed: OPENAI_API_KEY is missing.",
    );
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error(
      "Manual OpenAI to Supabase media test failed: NEXT_PUBLIC_SUPABASE_URL is missing.",
    );
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Manual OpenAI to Supabase media test failed: SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    process.exit(1);
  }

  const request: MediaAssetRequest = {
    id: "manual-openai-supabase-e2e-test",
    kind: "image",
    platform: "generic",
    ratio: "1:1",
    targetLanguage: "fr",
    title: "Test E2E OpenAI Supabase",
    creativeBrief:
      "Image de test abstraite et professionnelle pour vérifier la chaîne OpenAI vers Supabase.",
    prompt:
      "Create a clean premium abstract software marketing visual for Norixo, no text, no logo, no people.",
    negativePrompt: "No text, no watermark, no distorted interface, no people.",
    required: true,
  };

  const generationResult = await openaiImageProvider.generateImage(request);

  if (generationResult.status !== "generated") {
    console.log(
      JSON.stringify(
        {
          provider: generationResult.provider,
          status: generationResult.status,
          storageProvider: null,
          path: null,
          hasPreviewUrl: false,
          hasDownloadUrl: false,
          previewUrl: null,
          downloadUrl: null,
          model: generationResult.asset?.metadata?.model ?? null,
          error: generationResult.error ?? null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const internalBinary = generationResult.internalBinary;

  if (!internalBinary) {
    throw new Error("OpenAI provider did not expose binary payload for upload.");
  }

  const binary: MediaBinary = {
    id: request.id,
    kind: "image",
    provider: "openai",
    mimeType: internalBinary.mimeType,
    extension: internalBinary.extension,
    filename:
      internalBinary.filename ||
      createMediaBinaryFilename({
        id: request.id,
        provider: "openai",
        extension: internalBinary.extension,
      }),
    encoding: "base64",
    base64: internalBinary.base64,
    buffer: null,
    sourceUrl: null,
    sizeBytes: null,
    createdAt: new Date().toISOString(),
  };

  const uploadResult = await uploadMediaBinary(binary, supabaseMediaStorageAdapter);

  console.log(
    JSON.stringify(
      {
        provider: generationResult.provider,
        status: generationResult.status,
        storageProvider: uploadResult.upload.provider,
        path: uploadResult.upload.path,
        hasPreviewUrl: Boolean(uploadResult.upload.previewUrl),
        hasDownloadUrl: Boolean(uploadResult.upload.downloadUrl),
        previewUrl: uploadResult.upload.previewUrl,
        downloadUrl: uploadResult.upload.downloadUrl,
        model: generationResult.asset?.metadata?.model ?? null,
        error: generationResult.error ?? null,
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unknown manual OpenAI to Supabase media test error.",
  );
  process.exit(1);
});
