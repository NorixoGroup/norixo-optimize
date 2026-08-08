export const DEFAULT_BACKLINK_CAMPAIGN_MEMBERSHIP_PRIORITY_POLICY_V1 = {
  version: 1,
  priorityToOrder: {
    "Tier A": 1,
    "Tier B": 2,
    "Tier C": 3,
  } as const,
} as const;

export function resolveCampaignPriority(
  priority: "Tier A" | "Tier B" | "Tier C",
): 1 | 2 | 3 {
  return DEFAULT_BACKLINK_CAMPAIGN_MEMBERSHIP_PRIORITY_POLICY_V1
    .priorityToOrder[priority];
}