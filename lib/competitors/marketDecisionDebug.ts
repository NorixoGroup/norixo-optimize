import type { ExtractedListing } from "@/lib/extractors/types";
import type { MarketResolutionResult } from "./marketResolution";

function safeJsonLog(label: string, payload: Record<string, unknown>) {
  console.log(label, JSON.stringify(payload));
}

function readListingCountry(listing: ExtractedListing): string | null {
  const directCountry = (listing as ExtractedListing & { country?: string | null }).country;
  if (typeof directCountry === "string" && directCountry.trim().length > 0) {
    return directCountry.trim();
  }
  const location = (listing as ExtractedListing & {
    location?: { country?: string | null } | null;
  }).location;
  const locationCountry = location?.country;
  return typeof locationCountry === "string" && locationCountry.trim().length > 0
    ? locationCountry.trim()
    : null;
}

export function logMarketResolutionInput(
  target: ExtractedListing,
  candidate: ExtractedListing,
  stage: string
) {
  safeJsonLog("[market-resolution][input]", {
    stage,
    targetUrl: target.url ?? null,
    candidateUrl: candidate.url ?? null,
    rawTargetCity: target.locationLabel ?? null,
    rawCandidateCity: candidate.locationLabel ?? null,
    rawTargetCountry: readListingCountry(target),
    rawCandidateCountry: readListingCountry(candidate),
    rawTargetType: target.propertyType ?? null,
    rawCandidateType: candidate.propertyType ?? null,
    targetPrice:
      typeof target.price === "number" && Number.isFinite(target.price) ? target.price : null,
    candidatePrice:
      typeof candidate.price === "number" && Number.isFinite(candidate.price)
        ? candidate.price
        : null,
  });
}

export function logMarketResolutionDecision(result: MarketResolutionResult) {
  safeJsonLog("[market-resolution][decision]", {
    stage:
      typeof result.debug.stage === "string" && result.debug.stage.trim().length > 0
        ? result.debug.stage
        : null,
    targetUrl: typeof result.debug.targetUrl === "string" ? result.debug.targetUrl : null,
    candidateUrl:
      typeof result.debug.candidateUrl === "string" ? result.debug.candidateUrl : null,
    canonicalTargetCity: result.normalizedTarget.canonicalCity,
    canonicalCandidateCity: result.normalizedCandidate.canonicalCity,
    normalizedTargetType: result.normalizedTarget.normalizedComparableType,
    normalizedCandidateType: result.normalizedCandidate.normalizedComparableType,
    nightlyPrice: result.normalizedCandidate.nightlyPrice,
    priceBasis: result.normalizedCandidate.priceBasis,
    geoCompatible: result.geo.compatible,
    geoReason: result.geo.reason,
    typeCompatible: result.type.compatible,
    typeReason: result.type.reason,
    priceUsable: result.price.usable,
    priceReason: result.price.reason,
    decision: result.decision,
    rejectionReason: result.rejectionReason,
    ruleSetApplied:
      typeof result.debug.ruleSetApplied === "string" ? result.debug.ruleSetApplied : null,
  });
}

export function logMarketResolutionDiff(diff: Record<string, unknown>) {
  const currentReasons = Array.isArray(diff.currentReasons)
    ? diff.currentReasons.filter((value): value is string => typeof value === "string")
    : [];
  const resolverGeo =
    typeof diff.resolverGeo === "string"
      ? diff.resolverGeo
      : typeof diff.geoReason === "string"
        ? diff.geoReason
        : null;
  const resolverType =
    typeof diff.resolverType === "string"
      ? diff.resolverType
      : typeof diff.typeReason === "string"
        ? diff.typeReason
        : null;
  const resolverReason =
    typeof diff.resolverReason === "string"
      ? diff.resolverReason
      : typeof diff.rejectionReason === "string"
        ? diff.rejectionReason
        : null;

  safeJsonLog("[market-resolution][diff-current-vs-resolver]", {
    candidateUrl: typeof diff.candidateUrl === "string" ? diff.candidateUrl : null,
    currentKeep: diff.currentKeep === true,
    resolverDecision:
      typeof diff.resolverDecision === "string"
        ? diff.resolverDecision
        : diff.resolverKeep === true
          ? "accept"
          : "defer_to_legacy",
    currentReasons,
    resolverReason,
    currentGeo: currentReasons.includes("geo_mismatch") ? "geo_mismatch" : "geo_ok",
    resolverGeo,
    currentType: currentReasons.includes("property_type_mismatch") ? "type_mismatch" : "type_ok",
    resolverType,
  });
}

export function logMarketResolutionFinal(snapshot: Record<string, unknown>) {
  safeJsonLog("[market-resolution][final]", {
    discovered:
      typeof snapshot.discovered === "number" && Number.isFinite(snapshot.discovered)
        ? snapshot.discovered
        : null,
    extractionAttempts:
      typeof snapshot.extractionAttempts === "number" &&
      Number.isFinite(snapshot.extractionAttempts)
        ? snapshot.extractionAttempts
        : null,
    extractedRawKept:
      typeof snapshot.extractedRawKept === "number" && Number.isFinite(snapshot.extractedRawKept)
        ? snapshot.extractedRawKept
        : null,
    evaluateAccepted:
      typeof snapshot.evaluateAccepted === "number" && Number.isFinite(snapshot.evaluateAccepted)
        ? snapshot.evaluateAccepted
        : null,
    finalComparables:
      typeof snapshot.finalComparables === "number" && Number.isFinite(snapshot.finalComparables)
        ? snapshot.finalComparables
        : null,
    resolverAcceptedCount:
      typeof snapshot.resolverAcceptedCount === "number" &&
      Number.isFinite(snapshot.resolverAcceptedCount)
        ? snapshot.resolverAcceptedCount
        : null,
    legacyAcceptedCount:
      typeof snapshot.legacyAcceptedCount === "number" &&
      Number.isFinite(snapshot.legacyAcceptedCount)
        ? snapshot.legacyAcceptedCount
        : null,
    divergenceCount:
      typeof snapshot.divergenceCount === "number" && Number.isFinite(snapshot.divergenceCount)
        ? snapshot.divergenceCount
        : null,
  });
}
