import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import {
  updateBacklinkAsset,
  type CreateBacklinkAssetInput,
  type UpdateBacklinkAssetInput,
} from "../lib/backlinks/repositories/assetsRepository";
import { updateBacklinkDomain } from "../lib/backlinks/repositories/domainsRepository";
import { updateBacklinkTag } from "../lib/backlinks/repositories/tagsRepository";

const repositoryFiles = [
  "lib/backlinks/repositories/assetsRepository.ts",
  "lib/backlinks/repositories/domainsRepository.ts",
  "lib/backlinks/repositories/tagsRepository.ts",
];

const createInput: CreateBacklinkAssetInput = {
  asset_key: "revpar-calculator",
  display_name: "RevPAR Calculator",
  asset_type: "calculator",
  createdBy: "00000000-0000-0000-0000-000000000001",
};
assert.equal(createInput.createdBy, "00000000-0000-0000-0000-000000000001");

// @ts-expect-error workspace_id is injected by the repository.
const invalidCreateInput: CreateBacklinkAssetInput = { ...createInput, workspace_id: "workspace-id" };
void invalidCreateInput;

const updateInput: UpdateBacklinkAssetInput = { display_name: "Updated calculator" };
assert.equal(updateInput.display_name, "Updated calculator");

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
    assert.match(source, /\.eq\("workspace_id", workspaceId\)/);
    assert.match(source, /workspace_id: workspaceId/);
    assert.match(source, /assertNonEmptyUpdate/);
    assert.match(source, /normalizeBacklinkRepositoryError/);
    assert.match(source, /code: "NOT_FOUND"/);
  }

  await assertEmptyUpdateRejected(
    () => updateBacklinkAsset(null!, "workspace-id", "asset-id", {}),
    "updateBacklinkAsset",
  );
  await assertEmptyUpdateRejected(
    () => updateBacklinkDomain(null!, "workspace-id", "domain-id", {}),
    "updateBacklinkDomain",
  );
  await assertEmptyUpdateRejected(
    () => updateBacklinkTag(null!, "workspace-id", "tag-id", {}),
    "updateBacklinkTag",
  );

  console.info("Backlink core repositories smoke passed.");
}

void main();
