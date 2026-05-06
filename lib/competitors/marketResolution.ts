import type { ExtractedListing } from "@/lib/extractors/types";
import { normalizeMarketEntity } from "./marketNormalization";
import {
  describeBookingMoroccoRuleApplication,
  detectBookingMoroccoRuleSet,
  matchBookingMoroccoGeo,
} from "./platformRules/bookingMoroccoRules";

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
  const geoMatch = matchBookingMoroccoGeo(
    targetContext.normalizedTarget.canonicalCity,
    normalizedCandidate.canonicalCity
  );
  const typeMatch =
    targetContext.normalizedTarget.normalizedComparableType ===
    normalizedCandidate.normalizedComparableType;
  const priceUsable = normalizedCandidate.nightlyPrice != null && normalizedCandidate.nightlyPrice > 0;

  return {
    normalizedTarget: targetContext.normalizedTarget,
    normalizedCandidate,
    geo: { compatible: geoMatch, reason: geoMatch ? "city_match" : "city_mismatch" },
    type: { compatible: typeMatch, reason: typeMatch ? "type_match" : "type_mismatch" },
    price: { usable: priceUsable, reason: priceUsable ? "nightly_price_available" : "nightly_price_missing" },
    decision: "defer_to_legacy",
    rejectionReason: null,
    debug: {
      stage: input.context.stage,
      sourcePrevalidated: Boolean(input.context.sourcePrevalidated),
      ruleSetApplied: describeBookingMoroccoRuleApplication(targetContext.ruleSet),
    },
  };
}

export function compareCurrentDecisionVsResolver(currentAccepted: boolean, resolver: MarketResolutionResult) {
  return {
    currentKeep: currentAccepted,
    resolverKeep: resolver.decision === "accept",
    diverged: currentAccepted !== (resolver.decision === "accept"),
  };
}
