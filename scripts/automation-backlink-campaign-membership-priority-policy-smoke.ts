import {
  DEFAULT_BACKLINK_CAMPAIGN_MEMBERSHIP_PRIORITY_POLICY_V1,
  resolveCampaignPriority,
} from "../lib/automation/backlink-campaign-membership-priority-policy";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  DEFAULT_BACKLINK_CAMPAIGN_MEMBERSHIP_PRIORITY_POLICY_V1.version === 1,
  "Policy version must be 1",
);

assert(resolveCampaignPriority("Tier A") === 1, "Tier A -> 1");
assert(resolveCampaignPriority("Tier B") === 2, "Tier B -> 2");
assert(resolveCampaignPriority("Tier C") === 3, "Tier C -> 3");

console.log("PASS — Campaign membership priority policy smoke");
