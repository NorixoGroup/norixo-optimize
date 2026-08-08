import {
  applyBacklinkCampaignMembership,
} from "../lib/automation/backlink-campaign-membership-application";
import {
  BacklinkCampaignMembershipApplicationError,
  type ApplyBacklinkCampaignMembershipDependencies,
} from "../lib/automation/backlink-campaign-membership-application-types";
import type {
  BacklinkCampaignOpportunityRow,
} from "../lib/backlinks/repositories/campaignOpportunitiesRepository";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const workspaceId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const campaignId = "00000000-0000-4000-8000-000000000003";
const opportunityId = "00000000-0000-4000-8000-000000000004";

function membership(
  overrides: Partial<BacklinkCampaignOpportunityRow> = {},
): BacklinkCampaignOpportunityRow {
  return {
    workspace_id: workspaceId,
    campaign_id: campaignId,
    opportunity_id: opportunityId,
    campaign_priority: 1,
    membership_status: "planned",
    added_by: actorUserId,
    added_at: "2026-08-06T12:00:00.000Z",
    removed_at: null,
    removal_reason: null,
    ...overrides,
  };
}

function dependencies(
  existing: BacklinkCampaignOpportunityRow | null,
): {
  value: ApplyBacklinkCampaignMembershipDependencies;
  calls: {
    get: number;
    create: number;
    update: number;
  };
} {
  const calls = { get: 0, create: 0, update: 0 };

  return {
    calls,
    value: {
      async getMembership() {
        calls.get += 1;
        return existing;
      },

      async createMembership(input) {
        calls.create += 1;
        return membership({
          membership_status: input.membershipStatus,
          campaign_priority: input.campaignPriority,
        });
      },

      async updateMembership(input) {
        calls.update += 1;
        return membership({
          membership_status: input.membershipStatus,
          campaign_priority: input.campaignPriority,
          removed_at: input.removedAt,
          removal_reason: input.removalReason,
        });
      },
    },
  };
}

async function main(): Promise<void> {
  const createdDependencies = dependencies(null);
  const created = await applyBacklinkCampaignMembership(
    createdDependencies.value,
    {
      workspaceId,
      actorUserId,
      campaignId,
      opportunityId,
      proposedMembershipStatus: "planned",
      proposedPriority: "Tier A",
    },
  );

  assert(created.disposition === "created", "Missing membership must be created");
  assert(created.membership.campaign_priority === 1, "Tier A must map to 1");
  assert(createdDependencies.calls.get === 1, "Created path must read once");
  assert(createdDependencies.calls.create === 1, "Created path must create once");
  assert(createdDependencies.calls.update === 0, "Created path must not update");

  const existingRow = membership({
    membership_status: "active",
    campaign_priority: 9,
  });
  const existingDependencies = dependencies(existingRow);
  const existing = await applyBacklinkCampaignMembership(
    existingDependencies.value,
    {
      workspaceId,
      actorUserId,
      campaignId,
      opportunityId,
      proposedMembershipStatus: "planned",
      proposedPriority: "Tier B",
    },
  );

  assert(existing.disposition === "existing", "Existing membership must be reused");
  assert(existing.membership === existingRow, "Existing reference must be preserved");
  assert(existingDependencies.calls.create === 0, "Existing path must not create");
  assert(existingDependencies.calls.update === 0, "Existing path must not mutate");

  const removedDependencies = dependencies(
    membership({
      membership_status: "removed",
      campaign_priority: null,
      removed_at: "2026-08-01T12:00:00.000Z",
      removal_reason: "removed_from_campaign",
    }),
  );

  const reactivated = await applyBacklinkCampaignMembership(
    removedDependencies.value,
    {
      workspaceId,
      actorUserId,
      campaignId,
      opportunityId,
      proposedMembershipStatus: "planned",
      proposedPriority: "Tier C",
    },
  );

  assert(
    reactivated.disposition === "reactivated",
    "Removed membership must be reactivated",
  );
  assert(reactivated.membership.membership_status === "planned", "Status must reset");
  assert(reactivated.membership.campaign_priority === 3, "Tier C must map to 3");
  assert(reactivated.membership.removed_at === null, "removed_at must be cleared");
  assert(
    reactivated.membership.removal_reason === null,
    "removal_reason must be cleared",
  );
  assert(removedDependencies.calls.create === 0, "Reactivation must not create");
  assert(removedDependencies.calls.update === 1, "Reactivation must update once");

  let invalidRejected = false;

  try {
    await applyBacklinkCampaignMembership(createdDependencies.value, {
      workspaceId: "invalid",
      actorUserId,
      campaignId,
      opportunityId,
      proposedMembershipStatus: "planned",
      proposedPriority: "Tier A",
    });
  } catch (error) {
    invalidRejected =
      error instanceof BacklinkCampaignMembershipApplicationError;
  }

  assert(invalidRejected, "Invalid input must be rejected");

  const wrongScopeDependencies = dependencies(null);
  wrongScopeDependencies.value.createMembership = async () =>
    membership({
      workspace_id: "00000000-0000-4000-8000-000000000099",
    });

  let wrongScopeRejected = false;

  try {
    await applyBacklinkCampaignMembership(wrongScopeDependencies.value, {
      workspaceId,
      actorUserId,
      campaignId,
      opportunityId,
      proposedMembershipStatus: "planned",
      proposedPriority: "Tier A",
    });
  } catch (error) {
    wrongScopeRejected =
      error instanceof BacklinkCampaignMembershipApplicationError;
  }

  assert(wrongScopeRejected, "Wrong-scope repository result must be rejected");

  console.log("PASS — Campaign membership application smoke");
}

void main();
