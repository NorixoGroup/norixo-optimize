import type { AuditResult } from "@/ai/runAudit";

export type MarketPositionSummary = {
  competitorCount: number;
  averageOverallScore: number;
  targetOverallScore: number;
  deltaVsAverage: number;
  label: "above_market" | "near_market" | "below_market";
  message: string;
};

export function buildMarketPositionSummary(
  audit: AuditResult
): MarketPositionSummary {
  const competitorCount = audit.competitorSummary?.competitorCount ?? 0;
  const averageOverallScore = Number(
    audit.competitorSummary?.averageOverallScore ?? 0
  );
  const targetOverallScore = Number(audit.overallScore ?? 0);
  const deltaVsAverage = Number(
    (targetOverallScore - averageOverallScore).toFixed(1)
  );

  let label: MarketPositionSummary["label"] = "near_market";
  let message = "Cette annonce se situe globalement dans la moyenne des concurrents proches.";

  if (competitorCount === 0) {
    message = "Aucun concurrent proche n’a encore été analysé pour cet audit.";
  } else if (deltaVsAverage >= 0.7) {
    label = "above_market";
    message = "Cette annonce semble plus performante que la moyenne locale à proximité.";
  } else if (deltaVsAverage <= -0.7) {
    label = "below_market";
    message = "Cette annonce semble plus faible que la moyenne locale à proximité.";
  }

  return {
    competitorCount,
    averageOverallScore,
    targetOverallScore,
    deltaVsAverage,
    label,
    message,
  };
}
