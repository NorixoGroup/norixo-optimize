import type {
  BacklinkDiscoveryProviderName,
  BacklinkDiscoveryRequestV1,
  BacklinkDiscoverySearch,
  BacklinkDiscoverySource,
} from "./backlink-discovery-types";

const MAX_DISCOVERY_INPUT_BYTES = 16 * 1024;

const sources: readonly BacklinkDiscoverySource[] = [
  "manual_dashboard",
  "scheduled",
  "internal",
];

const providers: readonly BacklinkDiscoveryProviderName[] = [
  "mock",
  "brave_search",
  "dataforseo_serp",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function assertInputSize(value: unknown): void {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("discovery input must be JSON serializable");
  }

  if (new TextEncoder().encode(serialized).length > MAX_DISCOVERY_INPUT_BYTES) {
    throw new Error("discovery input must not exceed 16384 bytes");
  }
}

function validateSearch(value: unknown): asserts value is BacklinkDiscoverySearch {
  if (!isRecord(value) || !hasOnlyKeys(value, ["query", "countryCode", "languageCode"])) {
    throw new Error("each discovery search must be a valid object");
  }
  if (typeof value.query !== "string" || value.query.trim().length === 0) {
    throw new Error("discovery search query must not be empty");
  }
  if (value.countryCode !== undefined && typeof value.countryCode !== "string") {
    throw new Error("discovery search countryCode must be a string");
  }
  if (value.languageCode !== undefined && typeof value.languageCode !== "string") {
    throw new Error("discovery search languageCode must be a string");
  }
}

export function validateBacklinkDiscoveryRequest(
  value: unknown,
): asserts value is BacklinkDiscoveryRequestV1 {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "version",
      "source",
      "provider",
      "searches",
      "maxResultsPerSearch",
      "maxCandidates",
      "suggestedAssetKey",
    ])
  ) {
    throw new Error("discovery input must be a valid object");
  }

  assertInputSize(value);

  if (value.version !== 1) {
    throw new Error("discovery version must be 1");
  }
  if (typeof value.source !== "string" || !sources.includes(value.source as BacklinkDiscoverySource)) {
    throw new Error("discovery source is not supported");
  }
  if (
    typeof value.provider !== "string" ||
    !providers.includes(value.provider as BacklinkDiscoveryProviderName)
  ) {
    throw new Error("discovery provider is not supported");
  }
  if (!Array.isArray(value.searches) || value.searches.length < 1 || value.searches.length > 10) {
    throw new Error("discovery searches must contain between 1 and 10 entries");
  }

  for (const search of value.searches) {
    validateSearch(search);
  }

  const maxResultsPerSearch = value.maxResultsPerSearch;
  if (
    typeof maxResultsPerSearch !== "number" ||
    !Number.isInteger(maxResultsPerSearch) ||
    maxResultsPerSearch < 1 ||
    maxResultsPerSearch > 10
  ) {
    throw new Error("maxResultsPerSearch must be an integer between 1 and 10");
  }
  const maxCandidates = value.maxCandidates;
  if (
    typeof maxCandidates !== "number" ||
    !Number.isInteger(maxCandidates) ||
    maxCandidates < 1 ||
    maxCandidates > 50
  ) {
    throw new Error("maxCandidates must be an integer between 1 and 50");
  }
  if (
    value.suggestedAssetKey !== undefined &&
    (typeof value.suggestedAssetKey !== "string" ||
      value.suggestedAssetKey.trim().length === 0)
  ) {
    throw new Error("suggestedAssetKey must not be empty");
  }
}
