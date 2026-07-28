import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import {
  updateBacklinkContact,
  type CreateBacklinkContactInput,
  type UpdateBacklinkContactInput,
} from "../lib/backlinks/repositories/contactsRepository";
import {
  updateBacklinkOpportunity,
  type CreateBacklinkOpportunityInput,
  type UpdateBacklinkOpportunityInput,
} from "../lib/backlinks/repositories/opportunitiesRepository";

const repositoryFiles = [
  "lib/backlinks/repositories/opportunitiesRepository.ts",
  "lib/backlinks/repositories/contactsRepository.ts",
];

const createOpportunityInput: CreateBacklinkOpportunityInput = {
  asset_id: "00000000-0000-0000-0000-000000000001",
  domain_id: "00000000-0000-0000-0000-000000000002",
  evidence_summary: "Relevant calculator resource.",
  opportunity_key: "OP-000001",
  opportunity_type: "Calculator Reference",
  page_type: "Resource Page",
  target_page_title: "Revenue management resources",
  target_page_url: "https://example.com/resources",
  createdBy: "00000000-0000-0000-0000-000000000003",
};
assert.equal(createOpportunityInput.createdBy, "00000000-0000-0000-0000-000000000003");

const invalidOpportunityInput: CreateBacklinkOpportunityInput = {
  ...createOpportunityInput,
  // @ts-expect-error workspace_id is injected by the repository.
  workspace_id: "workspace-id",
};
void invalidOpportunityInput;

const createContactInput: CreateBacklinkContactInput = {
  contact_key: "CT-000001",
  domain_id: "00000000-0000-0000-0000-000000000002",
  createdBy: "00000000-0000-0000-0000-000000000003",
};
assert.equal(createContactInput.createdBy, "00000000-0000-0000-0000-000000000003");

const invalidContactInput: CreateBacklinkContactInput = {
  ...createContactInput,
  // @ts-expect-error workspace_id is injected by the repository.
  workspace_id: "workspace-id",
};
void invalidContactInput;

const opportunityUpdateInput: UpdateBacklinkOpportunityInput = { priority: "Tier A" };
const contactUpdateInput: UpdateBacklinkContactInput = { role_title: "Editor" };
assert.equal(opportunityUpdateInput.priority, "Tier A");
assert.equal(contactUpdateInput.role_title, "Editor");

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

  await assertEmptyUpdateRejected(
    () => updateBacklinkOpportunity(null!, "workspace-id", "opportunity-id", {}),
    "updateBacklinkOpportunity",
  );
  await assertEmptyUpdateRejected(
    () => updateBacklinkContact(null!, "workspace-id", "contact-id", {}),
    "updateBacklinkContact",
  );

  console.info("Backlink opportunities and contacts repositories smoke passed.");
}

void main();
