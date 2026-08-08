import {
  addOpportunityToCampaign,
  getCampaignOpportunity,
  reactivateOpportunityInCampaign,
} from "@/lib/backlinks/repositories/campaignOpportunitiesRepository";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import type {
  ApplyBacklinkCampaignMembershipDependencies,
} from "../backlink-campaign-membership-application-types";

export function createBacklinkCampaignMembershipApplicationRepository(
  client: BacklinkRepositoryClient,
): ApplyBacklinkCampaignMembershipDependencies {
  return {
    async getMembership(input) {
      try {
        return await getCampaignOpportunity(
          client,
          input.workspaceId,
          input.campaignId,
          input.opportunityId,
        );
      } catch (error) {
        if (
          error instanceof BacklinkRepositoryError &&
          error.code === "NOT_FOUND"
        ) {
          return null;
        }

        throw error;
      }
    },

    createMembership(input) {
      return addOpportunityToCampaign(
        client,
        input.workspaceId,
        input.campaignId,
        input.opportunityId,
        {
          addedBy: input.actorUserId,
          membership_status: input.membershipStatus,
          campaign_priority: input.campaignPriority,
        },
      );
    },

    updateMembership(input) {
      if (
        input.membershipStatus !== "planned" ||
        input.removedAt !== null ||
        input.removalReason !== null
      ) {
        throw new Error(
          "BACKLINK_CAMPAIGN_MEMBERSHIP_REACTIVATION_INVARIANT",
        );
      }

      return reactivateOpportunityInCampaign(
        client,
        input.workspaceId,
        input.campaignId,
        input.opportunityId,
        {
          campaignPriority: input.campaignPriority,
        },
      );
    },
  };
}
