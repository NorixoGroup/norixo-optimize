import { TOPIC_REQUIREMENTS, type TopicRequirements } from "../lib/seo/v3/topicRequirements";
import { runExclusive } from "./seo-v3-test-guard";

/**
 * TEST SUPPORT ONLY. Since draft-2 the long-stay rule is OPTIONAL, so the real table raises no order and blocks nothing
 * for it. Several suites rehearse the rule/time-zone mechanism through `long-stay-guide`; they call this to make the
 * REAL `long_stay_rule` requirement (same definition and type filter) required for the duration of `fn`, in this test
 * process only. The table is restored when `fn` returns or throws; an asynchronous `fn` and a nested call are refused.
 * No file is written.
 */
export function withLongStayRuleRequired<T>(fn: () => T): T {
  const table = TOPIC_REQUIREMENTS as Record<string, TopicRequirements>;
  const original = table["long-stay-guide"]!;
  return runExclusive(
    "withLongStayRuleRequired",
    fn,
    () => {
      table["long-stay-guide"] = original;
    },
    () => {
      const rule = original.optional.find((r) => r.requirementId === "long_stay_rule")!;
      table["long-stay-guide"] = { ...original, required: [rule], optional: original.optional.filter((r) => r !== rule), standalonePolicy: "requires_all_required_facts" };
    },
  );
}
