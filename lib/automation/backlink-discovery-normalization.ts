import type {
  BacklinkDiscoveryCandidate,
  NormalizedBacklinkDiscoveryCandidate,
} from "./backlink-discovery-types";

const trackingParameterNames = new Set(["gclid", "fbclid"]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function assertPublicHostname(hostname: string): void {
  if (hostname.length === 0 || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("discovery URL hostname must be public");
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error("discovery URL hostname must be public");
  }
}

export function normalizeBacklinkDiscoveryUrl(sourceUrl: string): {
  sourceUrl: string;
  hostname: string;
} {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("discovery URL must be valid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("discovery URL must use http or https");
  }

  url.hostname = url.hostname.toLowerCase();
  assertPublicHostname(url.hostname);
  url.hash = "";

  for (const parameterName of [...url.searchParams.keys()]) {
    const normalizedName = parameterName.toLowerCase();

    if (normalizedName.startsWith("utm_") || trackingParameterNames.has(normalizedName)) {
      url.searchParams.delete(parameterName);
    }
  }

  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  return { sourceUrl: url.toString(), hostname: url.hostname };
}

export function normalizeBacklinkDiscoveryCandidate(
  candidate: BacklinkDiscoveryCandidate,
): NormalizedBacklinkDiscoveryCandidate {
  const normalizedUrl = normalizeBacklinkDiscoveryUrl(candidate.sourceUrl);

  return {
    ...candidate,
    sourceUrl: normalizedUrl.sourceUrl,
    hostname: normalizedUrl.hostname,
  };
}

export function deduplicateNormalizedBacklinkDiscoveryCandidates(
  candidates: readonly NormalizedBacklinkDiscoveryCandidate[],
): NormalizedBacklinkDiscoveryCandidate[] {
  const seenSourceUrls = new Set<string>();
  const deduplicated: NormalizedBacklinkDiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    if (seenSourceUrls.has(candidate.sourceUrl)) {
      continue;
    }

    seenSourceUrls.add(candidate.sourceUrl);
    deduplicated.push(candidate);
  }

  return deduplicated;
}
