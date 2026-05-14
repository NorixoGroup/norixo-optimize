import type { ExtractedListing } from "@/lib/extractors/types";
import { normalizeMarketEntity } from "./marketNormalization";
import {
  describeBookingMoroccoRuleApplication,
  detectBookingMoroccoRuleSet,
  matchBookingMoroccoGeo,
} from "./platformRules/bookingMoroccoRules";

const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";

export type MarketResolutionInput = {
  target: ExtractedListing;
  candidate: ExtractedListing;
  context: { stage: string; sourcePrevalidated?: boolean };
};

export type MarketResolutionResult = {
  normalizedTarget: ReturnType<typeof normalizeMarketEntity>;
  normalizedCandidate: ReturnType<typeof normalizeMarketEntity>;
  geo: { compatible: boolean; reason: string };
  type: { compatible: boolean; reason: string };
  price: { usable: boolean; reason: string };
  decision: "accept" | "reject" | "defer_to_legacy";
  rejectionReason: string | null;
  debug: Record<string, unknown>;
};

export function resolveMarketTargetContext(target: ExtractedListing) {
  const normalizedTarget = normalizeMarketEntity(target);
  const ruleSet = detectBookingMoroccoRuleSet(target);
  return { normalizedTarget, ruleSet };
}

export function resolveMarketCandidateForEvaluation(input: MarketResolutionInput): MarketResolutionResult {
  const targetContext = resolveMarketTargetContext(input.target);
  const normalizedCandidate = normalizeMarketEntity(input.candidate);
  const baseGeoMatch = matchBookingMoroccoGeo(
    targetContext.normalizedTarget.canonicalCity,
    normalizedCandidate.canonicalCity
  );
  const targetPlatform = String(input.target.platform ?? "").toLowerCase();
  const candidatePlatform = String(input.candidate.platform ?? "").toLowerCase();
  const canonicalTargetCity = targetContext.normalizedTarget.canonicalCity;
  const canonicalCandidateCity = normalizedCandidate.canonicalCity;
  const canonicalTargetCountry = targetContext.normalizedTarget.canonicalCountry;
  const targetNormalizedType = targetContext.normalizedTarget.normalizedComparableType;
  const canonicalGeoBypassEligible =
    targetPlatform === "airbnb" &&
    candidatePlatform === "airbnb" &&
    canonicalTargetCountry === "ma" &&
    targetNormalizedType === "apartment_like" &&
    canonicalTargetCity === "marrakech" &&
    canonicalCandidateCity === "marrakech";
  const geoMatch = canonicalGeoBypassEligible ? true : baseGeoMatch;
  const geoReason =
    canonicalGeoBypassEligible && !baseGeoMatch ? "canonical_city_match" : geoMatch ? "city_match" : "city_mismatch";
  const typeMatch =
    targetContext.normalizedTarget.normalizedComparableType ===
    normalizedCandidate.normalizedComparableType;
  const priceUsable = normalizedCandidate.nightlyPrice != null && normalizedCandidate.nightlyPrice > 0;

  if (DEBUG_MARKET_PIPELINE && canonicalGeoBypassEligible && !baseGeoMatch) {
    console.log(
      "[market][canonical-geo-bypass-applied]",
      JSON.stringify({
        targetCanonicalCityOverride: canonicalTargetCity,
        candidateCanonicalCityOverride: canonicalCandidateCity,
        candidateUrl: input.candidate.url ?? null,
      })
    );
  }

  return {
    normalizedTarget: targetContext.normalizedTarget,
    normalizedCandidate,
    geo: { compatible: geoMatch, reason: geoReason },
    type: { compatible: typeMatch, reason: typeMatch ? "type_match" : "type_mismatch" },
    price: { usable: priceUsable, reason: priceUsable ? "nightly_price_available" : "nightly_price_missing" },
    decision: "defer_to_legacy",
    rejectionReason: null,
    debug: {
      stage: input.context.stage,
      sourcePrevalidated: Boolean(input.context.sourcePrevalidated),
      targetUrl: input.target.url ?? null,
      candidateUrl: input.candidate.url ?? null,
      ruleSetApplied: describeBookingMoroccoRuleApplication(targetContext.ruleSet),
    },
  };
}

export function compareCurrentDecisionVsResolver(currentAccepted: boolean, resolver: MarketResolutionResult) {
  return {
    currentKeep: currentAccepted,
    resolverKeep: resolver.decision === "accept",
    resolverDecision: resolver.decision,
    resolverReason: resolver.rejectionReason,
    resolverGeo: resolver.geo.reason,
    resolverType: resolver.type.reason,
    diverged: currentAccepted !== (resolver.decision === "accept"),
  };
}
