import type { BacklinkCampaignOpportunityRow } from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import type { BacklinkCampaignOpportunityPriority } from "./backlink-campaign-engine-types";

export type ApplyBacklinkCampaignMembershipInput = {
  workspaceId: string;
  actorUserId: string;
  campaignId: string;
  opportunityId: string;
  proposedMembershipStatus: "planned";
  proposedPriority: BacklinkCampaignOpportunityPriority;
};

export type ApplyBacklinkCampaignMembershipDisposition =
  | "created"
  | "existing"
  | "reactivated";

export type ApplyBacklinkCampaignMembershipResult = {
  disposition: ApplyBacklinkCampaignMembershipDisposition;
  membership: BacklinkCampaignOpportunityRow;
};

export type ApplyBacklinkCampaignMembershipDependencies = {
  getMembership(input: {
    workspaceId: string;
    campaignId: string;
    opportunityId: string;
  }): Promise<BacklinkCampaignOpportunityRow | null>;

  createMembership(input: {
    workspaceId: string;
    actorUserId: string;
    campaignId: string;
    opportunityId: string;
    membershipStatus: "planned";
    campaignPriority: number;
  }): Promise<BacklinkCampaignOpportunityRow>;

  updateMembership(input: {
    workspaceId: string;
    campaignId: string;
    opportunityId: string;
    membershipStatus: "planned";
    campaignPriority: number;
    removedAt: null;
    removalReason: null;
  }): Promise<BacklinkCampaignOpportunityRow>;
};

export class BacklinkCampaignMembershipApplicationError extends Error {
  readonly code =
    "BACKLINK_CAMPAIGN_MEMBERSHIP_APPLICATION_INVARIANT" as const;

  constructor() {
    super("Backlink campaign membership application invariant failed");
    this.name = "BacklinkCampaignMembershipApplicationError";
  }
}
