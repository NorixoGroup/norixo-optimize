import assert from "node:assert/strict";
import fs from "node:fs/promises";

const collectionRoute = "app/api/backlinks/campaigns/[id]/opportunities/route.ts";
const itemRoute = "app/api/backlinks/campaigns/[id]/opportunities/[opportunityId]/route.ts";

async function main(): Promise<void> {
  const [collection, item] = await Promise.all([
    fs.readFile(collectionRoute, "utf8"),
    fs.readFile(itemRoute, "utf8"),
  ]);
  assert.match(collection, /export async function GET/);
  assert.match(collection, /export async function POST/);
  assert.match(item, /export async function DELETE/);
  assert.match(collection, /listCampaignOpportunities/);
  assert.match(collection, /addOpportunityToCampaign/);
  assert.match(item, /removeOpportunityFromCampaign/);
  assert.match(item, /removed_from_campaign/);
  assert.match(collection, /getRequestUserAndWorkspace/);
  assert.match(item, /getRequestUserAndWorkspace/);
  assert.match(collection, /opportunity_id/);
  assert.match(collection, /uuid\.test\(id\)/);
  assert.match(item, /uuid\.test\(opportunityId\)/);
  assert.doesNotMatch(collection, /repositories\/|\.from\(|createClient|SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.doesNotMatch(item, /repositories\/|\.from\(|createClient|SUPABASE_SERVICE_ROLE_KEY|service_role/);
  console.info("Campaign opportunities API smoke passed.");
}

void main();
