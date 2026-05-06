import type { ExtractedListing } from "@/lib/extractors/types";
import type { MarketResolutionResult } from "./marketResolution";

export function logMarketResolutionInput(target: ExtractedListing, candidate: ExtractedListing, stage: string) {
  console.log("[market-resolution][input]", {
    stage,
    targetUrl: target.url ?? null,
    candidateUrl: candidate.url ?? null,
    targetPlatform: target.platform ?? null,
    candidatePlatform: candidate.platform ?? null,
    rawTargetCity: target.locationLabel ?? null,
    rawCandidateCity: candidate.locationLabel ?? null,
    rawTargetType: target.propertyType ?? null,
    rawCandidateType: candidate.propertyType ?? null,
    targetPrice: target.price ?? null,
    candidatePrice: candidate.price ?? null,
  });
}

export function logMarketResolutionDecision(result: MarketResolutionResult) {
  console.log("[market-resolution][decision]", {
    canonicalTargetCity: result.normalizedTarget.canonicalCity,
    canonicalCandidateCity: result.normalizedCandidate.canonicalCity,
    normalizedTargetType: result.normalizedTarget.normalizedComparableType,
    normalizedCandidateType: result.normalizedCandidate.normalizedComparableType,
    nightlyPrice: result.normalizedCandidate.nightlyPrice,
    geo: result.geo,
    type: result.type,
    price: result.price,
    decision: result.decision,
  });
}

export function logMarketResolutionDiff(diff: Record<string, unknown>) {
  console.log("[market-resolution][diff-current-vs-resolver]", diff);
}

export function logMarketResolutionFinal(snapshot: Record<string, unknown>) {
  console.log("[market-resolution][final]", snapshot);
}
