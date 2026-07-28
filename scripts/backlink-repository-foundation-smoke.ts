import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";
import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "../lib/backlinks/repositories/errors";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeRepositoryPage,
} from "../lib/backlinks/repositories/pagination";
import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import type {
  BacklinkInsert,
  BacklinkRow,
  BacklinkTableName,
  BacklinkUpdate,
} from "../lib/backlinks/repositories/types";

const DEFAULT_RANGE = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  from: 0,
  to: DEFAULT_PAGE_SIZE - 1,
};

assert.deepEqual(normalizeRepositoryPage(), DEFAULT_RANGE);
assert.deepEqual(normalizeRepositoryPage({ page: 1, pageSize: 10 }), {
  page: 1,
  pageSize: 10,
  from: 0,
  to: 9,
});
assert.deepEqual(normalizeRepositoryPage({ page: 3, pageSize: 10 }), {
  page: 3,
  pageSize: 10,
  from: 20,
  to: 29,
});
assert.equal(normalizeRepositoryPage({ pageSize: MAX_PAGE_SIZE + 1 }).pageSize, MAX_PAGE_SIZE);
assert.deepEqual(normalizeRepositoryPage(null), DEFAULT_RANGE);
assert.deepEqual(
  normalizeRepositoryPage({ page: Number.NaN, pageSize: Number.POSITIVE_INFINITY }),
  DEFAULT_RANGE,
);

const explicitError = new BacklinkRepositoryError({
  code: "VALIDATION",
  operation: "validate",
  message: "The provided data is invalid.",
});
assert.equal(explicitError.code, "VALIDATION");
assert.equal(explicitError.operation, "validate");

const duplicateError = normalizeBacklinkRepositoryError("create", { code: "23505" });
assert.equal(duplicateError.code, "CONFLICT");
assert.equal(duplicateError.operation, "create");
assert.equal(
  normalizeBacklinkRepositoryError("read", { code: "unknown" }).code,
  "DATABASE",
);

const backlinkTableNames = [
  "backlink_assets",
  "backlink_domains",
  "backlink_tags",
  "backlink_opportunities",
  "backlink_domain_tags",
  "backlink_opportunity_tags",
  "backlink_contacts",
  "backlink_campaigns",
  "backlink_campaign_opportunities",
  "backlink_outreach",
  "backlink_links",
  "backlink_notes",
  "backlink_activity",
] as const satisfies readonly BacklinkTableName[];

type AssetRow = BacklinkRow<"backlink_assets">;
type OpportunityInsert = BacklinkInsert<"backlink_opportunities">;
type CampaignOpportunityUpdate = BacklinkUpdate<"backlink_campaign_opportunities">;
type ActivityRow = BacklinkRow<"backlink_activity">;
type TypedRepositoryClient = BacklinkRepositoryClient extends SupabaseClient<Database> ? true : false;
type Assert<T extends true> = T;
type AssetRowAssertion = Assert<AssetRow extends Database["public"]["Tables"]["backlink_assets"]["Row"] ? true : false>;
type OpportunityInsertAssertion = Assert<
  OpportunityInsert extends Database["public"]["Tables"]["backlink_opportunities"]["Insert"] ? true : false
>;
type CampaignOpportunityUpdateAssertion = Assert<
  CampaignOpportunityUpdate extends Database["public"]["Tables"]["backlink_campaign_opportunities"]["Update"]
    ? true
    : false
>;
type ActivityRowAssertion = Assert<
  ActivityRow extends Database["public"]["Tables"]["backlink_activity"]["Row"] ? true : false
>;
type RepositoryClientAssertion = Assert<TypedRepositoryClient>;

void (null as unknown as
  | AssetRowAssertion
  | OpportunityInsertAssertion
  | CampaignOpportunityUpdateAssertion
  | ActivityRowAssertion
  | RepositoryClientAssertion);
assert.equal(backlinkTableNames.length, 13);

console.info("Backlink repository foundation smoke passed.");
