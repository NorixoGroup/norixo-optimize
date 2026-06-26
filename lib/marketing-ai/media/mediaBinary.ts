export type MediaBinarySourceProvider =
  | "fake"
  | "openai"
  | "runway"
  | "fal"
  | "replicate"
  | "unknown";

export type MediaBinaryKind =
  | "image"
  | "video"
  | "thumbnail"
  | "reel"
  | "story"
  | "carousel"
  | "cover";

export type MediaBinaryEncoding =
  | "base64"
  | "buffer"
  | "url";

export type MediaBinary = {
  id: string;
  kind: MediaBinaryKind;
  provider: MediaBinarySourceProvider;
  mimeType: string;
  extension: string;
  filename: string;
  encoding: MediaBinaryEncoding;
  base64?: string | null;
  buffer?: Uint8Array | null;
  sourceUrl?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

const MEDIA_BINARY_PROVIDERS: MediaBinarySourceProvider[] = [
  "fake",
  "openai",
  "runway",
  "fal",
  "replicate",
  "unknown",
];

const MEDIA_BINARY_KINDS: MediaBinaryKind[] = [
  "image",
  "video",
  "thumbnail",
  "reel",
  "story",
  "carousel",
  "cover",
];

const MEDIA_BINARY_ENCODINGS: MediaBinaryEncoding[] = [
  "base64",
  "buffer",
  "url",
];

function sanitizeFilenameSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createMediaBinaryFilename(params: {
  id: string;
  provider: MediaBinarySourceProvider;
  extension: string;
}): string {
  const provider = sanitizeFilenameSegment(params.provider) || "unknown";
  const id = sanitizeFilenameSegment(params.id) || "media-binary";
  const extension = sanitizeFilenameSegment(params.extension).replace(/^\.+/, "") || "bin";

  return `${provider}/${id}.${extension}`;
}

export function isMediaBinary(value: unknown): value is MediaBinary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.filename === "string" &&
    candidate.filename.trim().length > 0 &&
    typeof candidate.mimeType === "string" &&
    candidate.mimeType.trim().length > 0 &&
    typeof candidate.extension === "string" &&
    candidate.extension.trim().length > 0 &&
    typeof candidate.createdAt === "string" &&
    candidate.createdAt.trim().length > 0 &&
    typeof candidate.provider === "string" &&
    MEDIA_BINARY_PROVIDERS.includes(
      candidate.provider as MediaBinarySourceProvider,
    ) &&
    typeof candidate.kind === "string" &&
    MEDIA_BINARY_KINDS.includes(candidate.kind as MediaBinaryKind) &&
    typeof candidate.encoding === "string" &&
    MEDIA_BINARY_ENCODINGS.includes(
      candidate.encoding as MediaBinaryEncoding,
    )
  );
}
