import { createHash } from "node:crypto";

export type PrivateComparableIdentityInput = Readonly<{
  platform?: string | null;
  url?: string | null;
  sourceUrl?: string | null;
  canonicalUrl?: string | null;
  sourceId?: string | null;
  title?: string | null;
  locationLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}>;

export type PrivateComparableIdentityResult =
  | Readonly<{
      ok: true;
      privateComparableSignature: string;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "missing_comparable_identity"
        | "unsupported_comparable_identity";
    }>;

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUrlPathname(value: string): string {
  const pathname = value.replace(/\/{2,}/g, "/");
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) || "/" : pathname;
}

function normalizeComparableUrl(input: PrivateComparableIdentityInput): string | null {
  const rawUrl =
    normalizeText(input.canonicalUrl) ??
    normalizeText(input.url) ??
    normalizeText(input.sourceUrl);
  if (rawUrl == null) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }

    return `${protocol}//${hostname}${normalizeUrlPathname(parsed.pathname)}`;
  } catch {
    return null;
  }
}

function normalizeCoordinate(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return (Math.round(value * 1e6) / 1e6).toFixed(6);
}

export function buildPrivateComparableIdentity(
  input: PrivateComparableIdentityInput,
): PrivateComparableIdentityResult {
  const platform = normalizeText(input.platform);
  if (platform == null) {
    return { ok: false, reason: "unsupported_comparable_identity" };
  }

  const sourceId = normalizeText(input.sourceId);
  const comparableUrl = normalizeComparableUrl(input);
  const title = normalizeText(input.title);
  const locationLabel = normalizeText(input.locationLabel);
  const latitude = normalizeCoordinate(input.latitude);
  const longitude = normalizeCoordinate(input.longitude);

  const hasStableIdentity =
    sourceId != null ||
    comparableUrl != null ||
    (title != null && locationLabel != null) ||
    (latitude != null && longitude != null);

  if (!hasStableIdentity) {
    return { ok: false, reason: "missing_comparable_identity" };
  }

  const message = [
    `platform=${platform}`,
    `source_id=${sourceId ?? ""}`,
    `comparable_url=${comparableUrl ?? ""}`,
    `title=${title ?? ""}`,
    `location_label=${locationLabel ?? ""}`,
    `latitude=${latitude ?? ""}`,
    `longitude=${longitude ?? ""}`,
  ].join("\n");

  return {
    ok: true,
    privateComparableSignature: `private_cmp_${createHash("sha256")
      .update(message)
      .digest("hex")}`,
  };
}
