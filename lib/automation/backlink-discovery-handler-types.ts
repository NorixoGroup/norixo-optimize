import type { Json } from "@/types/database.types";

import type { BacklinkDiscoveryProviderRegistry } from "./backlink-discovery-provider-types";

export type ExecuteBacklinkDiscoveryPreviewDependencies = {
  providers: BacklinkDiscoveryProviderRegistry;
};

export type BacklinkDiscoveryRejectionSummary = {
  code:
    | "invalid_url"
    | "unsupported_protocol"
    | "private_host"
    | "duplicate_url"
    | "candidate_limit";
  count: number;
};

export type BacklinkDiscoveryPreviewCandidate = {
  candidateKey: string;
  hostname: string;
  sourceUrl: string;
  pageTitle: string | null;
  snippet: string | null;
  queryIndex: number;
  rank: number;
  countryCode: string | null;
  languageCode: string | null;
  proposedOpportunityType: null;
  proposedPageType: null;
  suggestedAssetKey: string | null;
  evidenceSummary: string;
  discoveryScore: number;
};

export type BacklinkDiscoveryPreviewOutputV1 = Record<string, Json> & {
  version: 1;
  kind: "backlinks.discovery.preview";
  dryRun: true;
  provider: string | null;
  skipped?: "no_searches";
  summary: {
    searchesRequested: number;
    resultsReceived: number;
    candidatesAccepted: number;
    candidatesRejected: number;
    truncated: boolean;
  };
  candidates: BacklinkDiscoveryPreviewCandidate[];
  rejections: BacklinkDiscoveryRejectionSummary[];
};
