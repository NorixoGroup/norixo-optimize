import { openaiImageProvider } from "../lib/marketing-ai/media/providers/openaiImageProvider";
import type { MediaAssetRequest } from "../lib/marketing-ai/media/mediaAssetRequest";

async function main() {
  if (process.env.OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED !== "true") {
    console.log(
      "Manual OpenAI image provider test skipped: OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED is not set to true.",
    );
    process.exit(0);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "Manual OpenAI image provider test failed: OPENAI_API_KEY is missing.",
    );
    process.exit(1);
  }

  const request: MediaAssetRequest = {
    id: "manual-openai-image-test",
    kind: "image",
    platform: "generic",
    ratio: "1:1",
    targetLanguage: "fr",
    title: "Test image OpenAI Norixo",
    creativeBrief:
      "Image de test abstraite et professionnelle pour vérifier le provider OpenAI.",
    prompt:
      "Create a clean, premium, abstract software marketing visual for Norixo, no text, no logo.",
    negativePrompt: "No text, no watermark, no distorted UI, no people.",
    required: true,
  };

  const result = await openaiImageProvider.generateImage(request);

  console.log(
    JSON.stringify(
      {
        provider: result.provider,
        status: result.status,
        hasAsset: Boolean(result.asset),
        assetKind: result.asset?.kind ?? null,
        generationProvider: result.asset?.generationProvider ?? null,
        model: result.asset?.metadata?.model ?? null,
        hasBinaryMetadata:
          Boolean((result.asset?.metadata as { hasBinary?: unknown } | undefined)?.hasBinary),
        binaryMimeType:
          ((result.asset?.metadata as { binaryMimeType?: string } | undefined)?.binaryMimeType ??
            null),
        binaryFilename:
          ((result.asset?.metadata as { binaryFilename?: string } | undefined)?.binaryFilename ??
            null),
        previewUrl: result.asset?.previewUrl ?? null,
        downloadUrl: result.asset?.downloadUrl ?? null,
        thumbnailUrl: result.asset?.thumbnailUrl ?? null,
        warningsCount: result.asset?.warnings?.length ?? 0,
        error: result.error ?? null,
      },
      null,
      2,
    ),
  );

  process.exit(result.status === "generated" ? 0 : 1);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unknown manual OpenAI image provider error.",
  );
  process.exit(1);
});
