import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";
import type { MediaAsset } from "./mediaAsset";
import type { MediaInternalBinary } from "./mediaBinary";
import type { MediaMuxResult, MediaMuxerAdapter } from "./mediaMuxer";
import type { MediaNarrationAsset } from "./mediaNarrationAsset";
import type {
  MediaNarrationProviderAdapter,
  MediaNarrationProviderGenerateResult,
} from "./mediaNarrationProviderAdapter";
import {
  buildNarrationRequestFromBundle,
} from "./mediaNarrationRequestBuilder";

export type MediaNarrationPipelineResult = {
  narrationRequest: ReturnType<typeof buildNarrationRequestFromBundle>;
  narrationResult: MediaNarrationProviderGenerateResult | null;
  muxResult: MediaMuxResult | null;
  finalAsset: MediaAsset | null;
};

export async function runNarratedVideoAssembly(params: {
  bundle: MarketingCampaignBundle;
  videoAsset: MediaAsset;
  sourceVideoBinary?: MediaInternalBinary | null;
  narrationProvider: MediaNarrationProviderAdapter;
  muxer: MediaMuxerAdapter;
}): Promise<MediaNarrationPipelineResult> {
  const narrationRequest = buildNarrationRequestFromBundle({
    bundle: params.bundle,
    videoAsset: params.videoAsset,
  });

  if (!narrationRequest) {
    return {
      narrationRequest,
      narrationResult: null,
      muxResult: null,
      finalAsset: null,
    };
  }

  const narrationResult = await params.narrationProvider.generateNarration(
    narrationRequest,
  );
  const narrationAsset = narrationResult.asset as MediaNarrationAsset | undefined;

  if (
    !narrationAsset ||
    !narrationResult.internalBinary ||
    narrationResult.status !== "generated"
  ) {
    return {
      narrationRequest,
      narrationResult,
      muxResult: null,
      finalAsset: null,
    };
  }

  const videoBinary =
    params.sourceVideoBinary ?? (await resolveVideoBinaryFromAsset(params.videoAsset));

  if (!videoBinary) {
    return {
      narrationRequest,
      narrationResult,
      muxResult: {
        provider: params.muxer.id,
        status: "failed",
        error: "Narrated video assembly failed: source video binary is unavailable.",
      },
      finalAsset: null,
    };
  }

  const muxResult = await params.muxer.mux({
    id: `${params.videoAsset.id}-mux`,
    videoAsset: params.videoAsset,
    videoBinary,
    narrationAsset,
    narrationBinary: narrationResult.internalBinary,
  });

  return {
    narrationRequest,
    narrationResult,
    muxResult,
    finalAsset: muxResult.asset ?? null,
  };
}

function inferBinaryExtension(params: {
  contentType: string | null;
  sourceUrl: string;
}): string {
  const normalizedContentType = params.contentType?.toLowerCase() ?? "";

  if (normalizedContentType.includes("mp4")) {
    return "mp4";
  }

  if (normalizedContentType.includes("quicktime")) {
    return "mov";
  }

  const fromUrl = params.sourceUrl.split("?")[0]?.split(".").pop()?.trim().toLowerCase();
  return fromUrl || "mp4";
}

async function resolveVideoBinaryFromAsset(
  asset: MediaAsset,
): Promise<MediaInternalBinary | null> {
  const sourceUrl =
    typeof asset.downloadUrl === "string" && asset.downloadUrl.trim().length > 0
      ? asset.downloadUrl.trim()
      : typeof asset.previewUrl === "string" && asset.previewUrl.trim().length > 0
        ? asset.previewUrl.trim()
        : null;

  if (!sourceUrl) {
    return null;
  }

  const response = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Narrated video assembly failed: source video download returned ${response.status}.`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    mimeType: response.headers.get("content-type")?.trim() || "video/mp4",
    extension: inferBinaryExtension({
      contentType: response.headers.get("content-type"),
      sourceUrl,
    }),
    base64: buffer.toString("base64"),
    filename:
      asset.metadata &&
      typeof (asset.metadata as { binaryFilename?: unknown }).binaryFilename === "string"
        ? ((asset.metadata as { binaryFilename: string }).binaryFilename)
        : `${asset.generationProvider ?? "unknown"}/${asset.id}.mp4`,
  };
}
