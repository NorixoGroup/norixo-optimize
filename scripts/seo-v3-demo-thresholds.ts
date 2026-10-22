import { TOPIC_REQUIREMENTS, type FactRequirement, type TopicRequirements } from "../lib/seo/v3/topicRequirements";
import { runExclusive } from "./seo-v3-test-guard";

/**
 * TEST SUPPORT ONLY — FICTIONAL. The optional facts used by the S5.4 demonstrations (`demand_driver` and `neighbourhood_context` for pricing-guide,
 * `calendar_unavailability_rate` for market-analysis) still carry PROVISIONAL thresholds, so the real engine does not render
 * them. For the duration of `fn`, in this test process only, those thresholds are treated as if a person had confirmed
 * them. THAT DECISION HAS NOT BEEN TAKEN and nothing here may be read as such. The table is restored when `fn` returns or
 * throws. An asynchronous `fn` and a nested call are refused (see seo-v3-test-guard.ts).
 */
const SIMULATED: readonly (readonly [string, string])[] = [
  ["pricing-guide", "demand_driver"],
  ["market-analysis", "calendar_unavailability_rate"],
  ["pricing-guide", "neighbourhood_context"],
];

export function withSimulatedThresholdDecision<T>(fn: () => T): T {
  const table = TOPIC_REQUIREMENTS as Record<string, TopicRequirements>;
  const originals = new Map<string, TopicRequirements>();
  return runExclusive(
    "withSimulatedThresholdDecision",
    fn,
    () => {
      for (const [topic, original] of originals) table[topic] = original;
    },
    () => {
      for (const [topic, requirementId] of SIMULATED) {
        const current = table[topic]!;
        // two requirements of one topic: the ORIGINAL entry is the one to restore
        if (!originals.has(topic)) originals.set(topic, current);
        const optional: FactRequirement[] = current.optional.map((r) => (r.requirementId === requirementId ? ({ ...r, thresholdBasis: "aligned_with_v2_public_overview" } as FactRequirement) : r));
        table[topic] = { ...current, optional };
      }
    },
  );
}
