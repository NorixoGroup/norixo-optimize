import { createHash } from "node:crypto";

import { resolveBacklinkDiscoveryProvider } from "./backlink-discovery-provider";
import { DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 } from "./backlink-qualification-policy";
import { extractBacklinkQualificationSignals } from "./backlink-qualification-signals";
import {
  mapQualificationOpportunityTypeToPromotion,
  mapQualificationPageTypeToPromotion,
} from "./backlink-promotion-mapping";
import type { BacklinkDiscoveryProviderItem } from "./backlink-discovery-provider-types";
import type {
  BacklinkDiscoveryPreviewCandidate,
  BacklinkDiscoveryPreviewOutputV1,
  BacklinkDiscoveryRejectionSummary,
  ExecuteBacklinkDiscoveryPreviewDependencies,
} from "./backlink-discovery-handler-types";
import { normalizeBacklinkDiscoveryUrl } from "./backlink-discovery-normalization";
import { validateBacklinkDiscoveryRequest } from "./backlink-discovery-validation";
import type { ExecuteAutomationTaskHandlerInput, ExecuteAutomationTaskHandlerResult } from "./handler-types";

const MAX_TITLE_LENGTH = 300;
const MAX_SNIPPET_LENGTH = 500;
const MAX_EVIDENCE_SUMMARY_LENGTH = 500;
const MAX_OUTPUT_CANDIDATE_BYTES = 60 * 1024;

const rejectionCodes = [
  "invalid_url",
  "unsupported_protocol",
  "private_host",
  "duplicate_url",
  "candidate_limit",
] as const;

type BacklinkDiscoveryRejectionCode = (typeof rejectionCodes)[number];

function isEmptyTaskInput(input: Record<string, unknown>): boolean {
  return Object.keys(input).length === 0;
}

function cleanText(value: string | null, maxLength: number): string | null {
  if (value === null) {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length === 0 ? null : cleaned.slice(0, maxLength);
}

function buildCandidateKey(sourceUrl: string): string {
  return `discovery:${createHash("sha256").update(sourceUrl).digest("hex")}`;
}

function buildEvidenceSummary(
  query: string,
  rank: number,
  pageTitle: string | null,
  snippet: string | null,
): string {
  const title = pageTitle === null ? "Untitled result" : pageTitle;
  const snippetPart = snippet === null ? "" : ` — ${snippet}`;

  return `SERP rank ${rank} for query "${query}": ${title}${snippetPart}`.slice(
    0,
    MAX_EVIDENCE_SUMMARY_LENGTH,
  );
}

function calculateDiscoveryScore(rank: number): number {
  return Math.max(0, Math.min(100, 101 - rank));
}

function determineIntakeEligibility(
  candidate: BacklinkDiscoveryPreviewCandidate,
  query: string,
): BacklinkDiscoveryPreviewCandidate["intakeEligibility"] {
  if (candidate.pageTitle === null) {
    return { status: "review_only", reason: "missing_page_title" };
  }

  const signals = extractBacklinkQualificationSignals({
    candidate,
    query: {
      query,
      countryCode: candidate.countryCode,
      languageCode: candidate.languageCode,
    },
    policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  });
  const opportunityType = mapQualificationOpportunityTypeToPromotion(
    signals.proposedOpportunityType,
  );
  if (opportunityType === null) {
    return { status: "review_only", reason: "unsupported_opportunity_type" };
  }
  const pageType = mapQualificationPageTypeToPromotion(signals.proposedPageType);
  if (pageType === null) {
    return { status: "review_only", reason: "unsupported_page_type" };
  }

  return { status: "eligible", opportunityType, pageType };
}

function classifyUrlRejection(error: unknown): BacklinkDiscoveryRejectionCode {
  if (error instanceof Error && error.message === "discovery URL must use http or https") {
    return "unsupported_protocol";
  }
  if (error instanceof Error && error.message === "discovery URL hostname must be public") {
    return "private_host";
  }

  return "invalid_url";
}

function buildRejections(
  counts: ReadonlyMap<BacklinkDiscoveryRejectionCode, number>,
): BacklinkDiscoveryRejectionSummary[] {
  return rejectionCodes.flatMap((code) => {
    const count = counts.get(code) ?? 0;
    return count === 0 ? [] : [{ code, count }];
  });
}

function incrementRejection(
  counts: Map<BacklinkDiscoveryRejectionCode, number>,
  code: BacklinkDiscoveryRejectionCode,
): void {
  counts.set(code, (counts.get(code) ?? 0) + 1);
}

function createCandidate(
  item: BacklinkDiscoveryProviderItem,
  query: string,
  queryIndex: number,
  countryCode: string | null,
  languageCode: string | null,
  suggestedAssetKey: string | null,
): BacklinkDiscoveryPreviewCandidate {
  const normalizedUrl = normalizeBacklinkDiscoveryUrl(item.url);
  const pageTitle = cleanText(item.title, MAX_TITLE_LENGTH);
  const snippet = cleanText(item.snippet, MAX_SNIPPET_LENGTH);

  const candidate: BacklinkDiscoveryPreviewCandidate = {
    candidateKey: buildCandidateKey(normalizedUrl.sourceUrl),
    hostname: normalizedUrl.hostname,
    sourceUrl: normalizedUrl.sourceUrl,
    pageTitle,
    snippet,
    queryIndex,
    rank: item.rank,
    countryCode,
    languageCode,
    proposedOpportunityType: null,
    proposedPageType: null,
    suggestedAssetKey,
    evidenceSummary: buildEvidenceSummary(query, item.rank, pageTitle, snippet),
    discoveryScore: calculateDiscoveryScore(item.rank),
  };
  return {
    ...candidate,
    intakeEligibility: determineIntakeEligibility(candidate, query),
  };
}

function createSkippedOutput(): BacklinkDiscoveryPreviewOutputV1 {
  return {
    version: 1,
    kind: "backlinks.discovery.preview",
    dryRun: true,
    provider: null,
    skipped: "no_searches",
    summary: {
      searchesRequested: 0,
      resultsReceived: 0,
      candidatesAccepted: 0,
      candidatesRejected: 0,
      truncated: false,
    },
    candidates: [],
    rejections: [],
  };
}

export async function executeBacklinkDiscoveryPreview(
  dependencies: ExecuteBacklinkDiscoveryPreviewDependencies,
  input: ExecuteAutomationTaskHandlerInput,
): Promise<ExecuteAutomationTaskHandlerResult> {
  if (isEmptyTaskInput(input.input)) {
    return { output: createSkippedOutput() };
  }

  validateBacklinkDiscoveryRequest(input.input);
  const request = input.input;
  const provider = resolveBacklinkDiscoveryProvider(dependencies.providers, request.provider);
  const rejectionCounts = new Map<BacklinkDiscoveryRejectionCode, number>();
  const sourceUrls = new Set<string>();
  const candidates: BacklinkDiscoveryPreviewCandidate[] = [];
  let resultsReceived = 0;
  let outputCandidateBytes = 0;
  let truncated = false;

  for (const [queryIndex, search] of request.searches.entries()) {
    const result = await provider.search({
      query: search.query,
      queryIndex,
      countryCode: search.countryCode ?? null,
      languageCode: search.languageCode ?? null,
      maxResults: request.maxResultsPerSearch,
    });

    for (const item of result.items) {
      resultsReceived += 1;
      let candidate: BacklinkDiscoveryPreviewCandidate;

      try {
        candidate = createCandidate(
          item,
          search.query,
          queryIndex,
          search.countryCode ?? null,
          search.languageCode ?? null,
          request.suggestedAssetKey ?? null,
        );
      } catch (error) {
        incrementRejection(rejectionCounts, classifyUrlRejection(error));
        continue;
      }

      if (sourceUrls.has(candidate.sourceUrl)) {
        incrementRejection(rejectionCounts, "duplicate_url");
        continue;
      }

      sourceUrls.add(candidate.sourceUrl);
      const candidateBytes = new TextEncoder().encode(JSON.stringify(candidate)).length;

      if (
        candidates.length >= request.maxCandidates ||
        outputCandidateBytes + candidateBytes > MAX_OUTPUT_CANDIDATE_BYTES
      ) {
        incrementRejection(rejectionCounts, "candidate_limit");
        truncated = true;
        continue;
      }

      outputCandidateBytes += candidateBytes;
      candidates.push(candidate);
    }
  }

  const rejections = buildRejections(rejectionCounts);
  const candidatesRejected = rejections.reduce((total, rejection) => total + rejection.count, 0);
  const output: BacklinkDiscoveryPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.discovery.preview",
    dryRun: true,
    provider: provider.name,
    summary: {
      searchesRequested: request.searches.length,
      resultsReceived,
      candidatesAccepted: candidates.length,
      candidatesRejected,
      truncated,
    },
    candidates,
    rejections,
  };

  return { output };
}
