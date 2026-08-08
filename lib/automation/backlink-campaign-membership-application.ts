import {
  resolveCampaignPriority,
} from "./backlink-campaign-membership-priority-policy";
import {
  BacklinkCampaignMembershipApplicationError,
  type ApplyBacklinkCampaignMembershipDependencies,
  type ApplyBacklinkCampaignMembershipInput,
  type ApplyBacklinkCampaignMembershipResult,
} from "./backlink-campaign-membership-application-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInput(input: ApplyBacklinkCampaignMembershipInput): void {
  if (
    !UUID_PATTERN.test(input.workspaceId) ||
    !UUID_PATTERN.test(input.actorUserId) ||
    !UUID_PATTERN.test(input.campaignId) ||
    !UUID_PATTERN.test(input.opportunityId)
  ) {
    throw new BacklinkCampaignMembershipApplicationError();
  }

  if (input.proposedMembershipStatus !== "planned") {
    throw new BacklinkCampaignMembershipApplicationError();
  }

  if (
    input.proposedPriority !== "Tier A" &&
    input.proposedPriority !== "Tier B" &&
    input.proposedPriority !== "Tier C"
  ) {
    throw new BacklinkCampaignMembershipApplicationError();
  }
}

function assertMembershipScope(
  membership: {
    workspace_id: string;
    campaign_id: string;
    opportunity_id: string;
  },
  input: ApplyBacklinkCampaignMembershipInput,
): void {
  if (
    membership.workspace_id !== input.workspaceId ||
    membership.campaign_id !== input.campaignId ||
    membership.opportunity_id !== input.opportunityId
  ) {
    throw new BacklinkCampaignMembershipApplicationError();
  }
}

export async function applyBacklinkCampaignMembership(
  dependencies: ApplyBacklinkCampaignMembershipDependencies,
  input: ApplyBacklinkCampaignMembershipInput,
): Promise<ApplyBacklinkCampaignMembershipResult> {
  validateInput(input);

  const campaignPriority = resolveCampaignPriority(input.proposedPriority);
  const existing = await dependencies.getMembership({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    opportunityId: input.opportunityId,
  });

  if (existing === null) {
    const created = await dependencies.createMembership({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      campaignId: input.campaignId,
      opportunityId: input.opportunityId,
      membershipStatus: "planned",
      campaignPriority,
    });

    assertMembershipScope(created, input);

    if (
      created.membership_status !== "planned" ||
      created.campaign_priority !== campaignPriority
    ) {
      throw new BacklinkCampaignMembershipApplicationError();
    }

    return {
      disposition: "created",
      membership: created,
    };
  }

  assertMembershipScope(existing, input);

  if (existing.membership_status !== "removed") {
    return {
      disposition: "existing",
      membership: existing,
    };
  }

  const reactivated = await dependencies.updateMembership({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    opportunityId: input.opportunityId,
    membershipStatus: "planned",
    campaignPriority,
    removedAt: null,
    removalReason: null,
  });

  assertMembershipScope(reactivated, input);

  if (
    reactivated.membership_status !== "planned" ||
    reactivated.campaign_priority !== campaignPriority ||
    reactivated.removed_at !== null ||
    reactivated.removal_reason !== null
  ) {
    throw new BacklinkCampaignMembershipApplicationError();
  }

  return {
    disposition: "reactivated",
    membership: reactivated,
  };
}
