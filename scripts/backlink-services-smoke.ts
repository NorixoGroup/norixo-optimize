import assert from "node:assert/strict";
import fs from "node:fs/promises";

import type { CreateOpportunityInput } from "../lib/backlinks/services/opportunityService";
import type { CreateCampaignInput } from "../lib/backlinks/services/campaignService";
import type { CreateContactInput, CreateOutreachInput } from "../lib/backlinks/services/outreachService";
import type { CreateLinkInput } from "../lib/backlinks/services/linkService";

const serviceFiles = [
  "lib/backlinks/services/opportunityService.ts",
  "lib/backlinks/services/campaignService.ts",
  "lib/backlinks/services/outreachService.ts",
  "lib/backlinks/services/linkService.ts",
];

const createOpportunityInput: CreateOpportunityInput = {
  asset_id: "00000000-0000-0000-0000-000000000001",
  domain_id: "00000000-0000-0000-0000-000000000002",
  evidence_summary: "Relevant calculator resource.",
  opportunity_key: "OP-000001",
  opportunity_type: "Calculator Reference",
  page_type: "Resource Page",
  target_page_title: "Revenue management resources",
  target_page_url: "https://example.com/resources",
};

const invalidOpportunityInput: CreateOpportunityInput = {
  ...createOpportunityInput,
  // @ts-expect-error workspace_id is injected by the Service and repository.
  workspace_id: "workspace-id",
};
void invalidOpportunityInput;

const createCampaignInput: CreateCampaignInput = {
  campaign_key: "BL-CAM-2026-001",
  name: "Revenue management resources",
  objective: "Earn editorial citations.",
};

const invalidCampaignInput: CreateCampaignInput = {
  ...createCampaignInput,
  // @ts-expect-error owner_id is injected from actorUserId by the Service.
  owner_id: "00000000-0000-0000-0000-000000000003",
};
void invalidCampaignInput;

const createOutreachInput: CreateOutreachInput = {
  campaign_id: "00000000-0000-0000-0000-000000000001",
  channel: "email",
  contact_id: "00000000-0000-0000-0000-000000000002",
  opportunity_id: "00000000-0000-0000-0000-000000000003",
  outreach_key: "BL-OUT-2026-001",
};
assert.equal(createOutreachInput.channel, "email");

const createContactInput: CreateContactInput = {
  contact_key: "CT-000001",
  domain_id: "00000000-0000-0000-0000-000000000002",
};
assert.equal(createContactInput.contact_key, "CT-000001");

const createLinkInput: CreateLinkInput = {
  acquired_at: "2026-07-29T00:00:00.000Z",
  asset_id: "00000000-0000-0000-0000-000000000001",
  backlink_key: "BL-LNK-000001",
  domain_id: "00000000-0000-0000-0000-000000000002",
  opportunity_id: "00000000-0000-0000-0000-000000000003",
  outreach_id: "00000000-0000-0000-0000-000000000004",
  source_url: "https://example.com/resources",
  target_url: "https://norixo.io/tools/airbnb-revpar-calculator",
};
assert.equal(createLinkInput.backlink_key, "BL-LNK-000001");

async function main(): Promise<void> {
  for (const serviceFile of serviceFiles) {
    const source = await fs.readFile(serviceFile, "utf8");
    assert.match(source, /BacklinkRepositoryClient/);
    assert.match(source, /WorkspaceId/);
    assert.doesNotMatch(
      source,
      /createRequestSupabaseClient|createClient|service_role|fetch\(|\.from\(|NextRequest|NextResponse|cookies\(|headers\(|use client|use server|app\/api|as any|: any/,
    );
  }

  const opportunitySource = await fs.readFile(serviceFiles[0], "utf8");
  assert.match(opportunitySource, /createdBy: actorUserId/);
  assert.match(opportunitySource, /qualification_status: "Qualified"/);

  const campaignSource = await fs.readFile(serviceFiles[1], "utf8");
  assert.match(campaignSource, /owner_id: actorUserId/);
  assert.match(campaignSource, /createdBy: actorUserId/);
  assert.match(campaignSource, /addedBy: actorUserId/);
  assert.match(campaignSource, /return removeCampaignOpportunity/);
  assert.doesNotMatch(campaignSource, /\.delete\(/);

  const outreachSource = await fs.readFile(serviceFiles[2], "utf8");
  assert.match(outreachSource, /createdBy: actorUserId/);
  assert.match(
    outreachSource,
    /"status" \| "last_response_type" \| "closed_at" \| "stop_reason"/,
  );

  const linkSource = await fs.readFile(serviceFiles[3], "utf8");
  assert.match(linkSource, /createdBy: actorUserId/);
  assert.match(linkSource, /"verification_source"/);
  assert.match(linkSource, /"verification_evidence"/);

  console.info("Backlink services smoke passed.");
}

void main();
