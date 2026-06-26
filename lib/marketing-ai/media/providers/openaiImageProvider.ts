import { createMediaBinaryFilename } from "../mediaBinary";
import type { MediaAssetRequest } from "../mediaAssetRequest";
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

const OPENAI_IMAGE_MODEL = "gpt-image-1";

function isOpenAiMediaImageProviderEnabled(): boolean {
  return process.env.OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED === "true";
}

function mapRatioToOpenAiSize(ratio: MediaAssetRequest["ratio"]):
  | "1024x1024"
  | "1024x1536"
  | "1536x1024" {
  if (ratio === "16:9") {
    return "1536x1024";
  }

  if (ratio === "4:5" || ratio === "9:16") {
    return "1024x1536";
  }

  return "1024x1024";
}

function mapSizeToDimensions(size: "1024x1024" | "1024x1536" | "1536x1024") {
  if (size === "1024x1536") {
    return { width: 1024, height: 1536 };
  }

  if (size === "1536x1024") {
    return { width: 1536, height: 1024 };
  }

  return { width: 1024, height: 1024 };
}

function buildOpenAiImagePrompt(request: MediaAssetRequest): string {
  const sections = [
    request.prompt,
    `Title: ${request.title}`,
    `Language: ${request.targetLanguage}`,
    `Creative brief: ${request.creativeBrief}`,
  ];

  if (request.negativePrompt) {
    sections.push(`Avoid: ${request.negativePrompt}`);
  }

  return sections.join("\n");
}

function extractOpenAiImageBase64(firstImage: unknown): string | null {
  if (!firstImage || typeof firstImage !== "object") {
    return null;
  }

  const candidate = firstImage as { b64_json?: unknown };

  return typeof candidate.b64_json === "string" && candidate.b64_json.length > 0
    ? candidate.b64_json
    : null;
}

export const openaiImageProvider: MediaProviderAdapter = {
  id: "openai",
  label: "OpenAI Image Provider",
  capabilities: ["image", "thumbnail"],

  async generateImage(request) {
    if (!isOpenAiMediaImageProviderEnabled()) {
      return buildUnconfiguredResult();
    }

    const { openai } = await import("../../../openai");
    const size = mapRatioToOpenAiSize(request.ratio);
    const dimensions = mapSizeToDimensions(size);
    const now = new Date().toISOString();

    try {
      const response = await openai.images.generate({
        model: OPENAI_IMAGE_MODEL,
        prompt: buildOpenAiImagePrompt(request),
        size,
        quality: "auto",
        output_format: "png",
      });

      const firstImage = response.data?.[0];
      const imageBase64 = extractOpenAiImageBase64(firstImage);
      const binaryFilename = imageBase64
        ? createMediaBinaryFilename({
            id: request.id,
            provider: "openai",
            extension: "png",
          })
        : undefined;
      const metadata = {
        width: dimensions.width,
        height: dimensions.height,
        model: OPENAI_IMAGE_MODEL,
        hasBinary: Boolean(imageBase64),
        binaryMimeType: imageBase64 ? "image/png" : undefined,
        binaryFilename,
      };

      return {
        provider: "openai",
        status: "generated",
        internalBinary:
          imageBase64 && binaryFilename
            ? {
                mimeType: "image/png",
                extension: "png",
                base64: imageBase64,
                filename: binaryFilename,
              }
            : undefined,
        asset: {
          id: request.id,
          kind: request.kind,
          status: "generated",
          platform: request.platform,
          ratio: request.ratio,
          language: request.targetLanguage,
          title: request.title,
          description: request.creativeBrief,
          prompt: request.prompt,
          negativePrompt: request.negativePrompt,
          previewUrl: null,
          downloadUrl: null,
          thumbnailUrl: null,
          generationProvider: "openai",
          metadata,
          warnings: firstImage?.revised_prompt
            ? [`Revised prompt: ${firstImage.revised_prompt}`]
            : [],
          createdAt: now,
          updatedAt: now,
        },
      };
    } catch (error) {
      return {
        provider: "openai",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown OpenAI image provider error.",
      };
    }
  },

  async generateVideo() {
    return buildUnconfiguredResult();
  },

  async getStatus() {
    return buildUnconfiguredResult();
  },
};
