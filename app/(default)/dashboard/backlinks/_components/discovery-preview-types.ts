import type { BacklinkDiscoveryIntakeEligibility } from "@/lib/automation/backlink-discovery-handler-types";

export type AutomationDiscoveryPreviewView = {
  version: 1;
  kind: "backlinks.discovery.preview";
  dryRun: true;
  provider: "mock" | "brave_search" | "dataforseo_serp";
  skipped?: "no_searches";
  summary: {
    searchesRequested: number;
    resultsReceived: number;
    candidatesAccepted: number;
    candidatesRejected: number;
    truncated: boolean;
  };
  candidates: readonly {
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
    intakeEligibility?: BacklinkDiscoveryIntakeEligibility;
    suggestedAssetKey: string | null;
    evidenceSummary: string;
    discoveryScore: number;
  }[];
  rejections: readonly {
    code: string;
    count: number;
  }[];
};
