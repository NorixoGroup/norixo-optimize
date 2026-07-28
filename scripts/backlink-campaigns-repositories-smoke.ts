import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import {
  updateBacklinkCampaign,
  type CreateBacklinkCampaignInput,
  type UpdateBacklinkCampaignInput,
} from "../lib/backlinks/repositories/campaignsRepository";
import {
  removeOpportunityFromCampaign,
  updateCampaignOpportunity,
  type AddOpportunityToCampaignInput,
  type UpdateCampaignOpportunityInput,
} from "../lib/backlinks/repositories/campaignOpportunitiesRepository";

const repositoryFiles = [
  "lib/backlinks/repositories/campaignsRepository.ts",
  "lib/backlinks/repositories/campaignOpportunitiesRepository.ts",
];

const createCampaignInput: CreateBacklinkCampaignInput = {
  campaign_key: "BL-CAM-2026-001",
  name: "Revenue management resources",
  objective: "Earn editorial citations.",
  owner_id: "00000000-0000-0000-0000-000000000001",
  createdBy: "00000000-0000-0000-0000-000000000002",
};
assert.equal(createCampaignInput.createdBy, "00000000-0000-0000-0000-000000000002");

const invalidCampaignInput: CreateBacklinkCampaignInput = {
  ...createCampaignInput,
  // @ts-expect-error workspace_id is injected by the repository.
  workspace_id: "workspace-id",
};
void invalidCampaignInput;

const addMembershipInput: AddOpportunityToCampaignInput = {
  campaign_priority: 1,
  addedBy: "00000000-0000-0000-0000-000000000002",
};
assert.equal(addMembershipInput.campaign_priority, 1);

const invalidMembershipInput: AddOpportunityToCampaignInput = {
  ...addMembershipInput,
  // @ts-expect-error campaign_id is injected by the repository.
  campaign_id: "campaign-id",
};
void invalidMembershipInput;

const invalidMembershipWorkspaceInput: AddOpportunityToCampaignInput = {
  ...addMembershipInput,
  // @ts-expect-error workspace_id is injected by the repository.
  workspace_id: "workspace-id",
};
void invalidMembershipWorkspaceInput;

const campaignUpdateInput: UpdateBacklinkCampaignInput = { status: "active" };
const membershipUpdateInput: UpdateCampaignOpportunityInput = { campaign_priority: 2 };
assert.equal(campaignUpdateInput.status, "active");
assert.equal(membershipUpdateInput.campaign_priority, 2);

async function assertEmptyUpdateRejected(
  operation: () => Promise<unknown>,
  expectedOperation: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    return (
      error instanceof BacklinkRepositoryError &&
      error.code === "VALIDATION" &&
      error.operation === expectedOperation
    );
  });
}

async function main(): Promise<void> {
  for (const repositoryFile of repositoryFiles) {
    const source = await fs.readFile(repositoryFile, "utf8");
    assert.match(source, /normalizeRepositoryPage/);
    assert.match(source, /count: "exact"/);
    assert.match(source, /\.eq\("workspace_id", workspaceId\)/);
    assert.match(source, /workspace_id: workspaceId/);
    assert.match(source, /assertNonEmptyUpdate/);
    assert.match(source, /normalizeBacklinkRepositoryError/);
    assert.match(source, /code: "NOT_FOUND"/);
  }

  const membershipSource = await fs.readFile(
    "lib/backlinks/repositories/campaignOpportunitiesRepository.ts",
    "utf8",
  );
  assert.match(membershipSource, /membership_status: "removed"/);
  assert.match(membershipSource, /removed_at: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(membershipSource, /\.delete\(/);

  await assertEmptyUpdateRejected(
    () => updateBacklinkCampaign(null!, "workspace-id", "campaign-id", {}),
    "updateBacklinkCampaign",
  );
  await assertEmptyUpdateRejected(
    () => updateCampaignOpportunity(null!, "workspace-id", "campaign-id", "opportunity-id", {}),
    "updateCampaignOpportunity",
  );

  void removeOpportunityFromCampaign;
  console.info("Backlink campaigns repositories smoke passed.");
}

void main();
