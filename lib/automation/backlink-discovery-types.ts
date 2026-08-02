export type BacklinkDiscoverySource =
  | "manual_dashboard"
  | "scheduled"
  | "internal";

export type BacklinkDiscoveryProviderName =
  | "mock"
  | "brave_search"
  | "dataforseo_serp";

export type BacklinkDiscoverySearch = {
  query: string;
  countryCode?: string;
  languageCode?: string;
};

export type BacklinkDiscoveryRequestV1 = {
  version: 1;
  source: BacklinkDiscoverySource;
  provider: BacklinkDiscoveryProviderName;
  searches: readonly BacklinkDiscoverySearch[];
  maxResultsPerSearch: number;
  maxCandidates: number;
  suggestedAssetKey?: string;
};

export type BacklinkDiscoveryCandidate = {
  sourceUrl: string;
  pageTitle: string | null;
  snippet: string | null;
  queryIndex: number;
  rank: number;
  countryCode: string | null;
  languageCode: string | null;
  suggestedAssetKey: string | null;
};

export type NormalizedBacklinkDiscoveryCandidate =
  BacklinkDiscoveryCandidate & {
    hostname: string;
  };
