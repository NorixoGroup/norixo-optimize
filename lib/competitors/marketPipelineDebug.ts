/**
 * Logs structurés pour diagnostiquer la chaîne comparables (désactivé par défaut).
 * Activer : DEBUG_MARKET_PIPELINE=true
 */
export function logMarketPipelineStage(payload: Record<string, unknown>): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][stage]", payload);
}

/** Compte les raisons `reasons[]` sur les décisions rejetées (evaluateComparableCandidates). */
export function countEvaluateRejectionReasons(
  decisions: Array<{ accepted: boolean; reasons: string[] }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of decisions) {
    if (d.accepted) continue;
    for (const r of d.reasons) {
      out[r] = (out[r] ?? 0) + 1;
    }
  }
  return out;
}
