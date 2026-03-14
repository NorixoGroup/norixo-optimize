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
  let message = "This listing is roughly in line with nearby competitors.";

  if (competitorCount === 0) {
    message = "No nearby competitors were analyzed for this audit yet.";
  } else if (deltaVsAverage >= 0.7) {
    label = "above_market";
    message = "This listing appears stronger than the nearby local average.";
  } else if (deltaVsAverage <= -0.7) {
    label = "below_market";
    message = "This listing appears weaker than the nearby local average.";
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