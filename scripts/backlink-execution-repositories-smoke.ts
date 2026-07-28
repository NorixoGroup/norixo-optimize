import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import {
  updateBacklinkLink,
  type CreateBacklinkLinkInput,
  type UpdateBacklinkLinkInput,
} from "../lib/backlinks/repositories/linksRepository";
import {
  updateBacklinkNote,
  type CreateBacklinkNoteInput,
  type UpdateBacklinkNoteInput,
} from "../lib/backlinks/repositories/notesRepository";
import {
  updateBacklinkOutreach,
  type CreateBacklinkOutreachInput,
  type UpdateBacklinkOutreachInput,
} from "../lib/backlinks/repositories/outreachRepository";
import type { CreateBacklinkActivityInput } from "../lib/backlinks/repositories/activityRepository";

const mutableRepositoryFiles = [
  "lib/backlinks/repositories/outreachRepository.ts",
  "lib/backlinks/repositories/linksRepository.ts",
  "lib/backlinks/repositories/notesRepository.ts",
];

const createOutreachInput: CreateBacklinkOutreachInput = {
  campaign_id: "00000000-0000-0000-0000-000000000001",
  channel: "email",
  contact_id: "00000000-0000-0000-0000-000000000002",
  opportunity_id: "00000000-0000-0000-0000-000000000003",
  outreach_key: "BL-OUT-2026-001",
  createdBy: "00000000-0000-0000-0000-000000000004",
};

const invalidOutreachInput: CreateBacklinkOutreachInput = {
  ...createOutreachInput,
  // @ts-expect-error workspace_id is injected by the repository.
  workspace_id: "workspace-id",
};
void invalidOutreachInput;

const createLinkInput: CreateBacklinkLinkInput = {
  acquired_at: "2026-07-28T00:00:00.000Z",
  asset_id: "00000000-0000-0000-0000-000000000001",
  backlink_key: "BL-LNK-000001",
  domain_id: "00000000-0000-0000-0000-000000000002",
  opportunity_id: "00000000-0000-0000-0000-000000000003",
  outreach_id: "00000000-0000-0000-0000-000000000004",
  source_url: "https://example.com/resources",
  target_url: "https://norixo.io/tools/airbnb-revpar-calculator",
  createdBy: "00000000-0000-0000-0000-000000000005",
};

const invalidLinkInput: CreateBacklinkLinkInput = {
  ...createLinkInput,
  // @ts-expect-error created_at is injected by the repository.
  created_at: "2026-07-28T00:00:00.000Z",
};
void invalidLinkInput;

const createNoteInput: CreateBacklinkNoteInput = {
  body: "Relevant editorial evidence.",
  note_type: "research",
  opportunity_id: "00000000-0000-0000-0000-000000000003",
  authorId: "00000000-0000-0000-0000-000000000005",
};

const invalidNoteInput: CreateBacklinkNoteInput = {
  ...createNoteInput,
  // @ts-expect-error author_id is injected by the repository.
  author_id: "00000000-0000-0000-0000-000000000005",
};
void invalidNoteInput;

const createActivityInput: CreateBacklinkActivityInput = {
  action_type: "created",
  activity_key: "BL-ACT-000001",
  entity_id: "00000000-0000-0000-0000-000000000003",
  entity_type: "backlink_opportunity",
  actorUserId: "00000000-0000-0000-0000-000000000005",
};

const invalidActivityInput: CreateBacklinkActivityInput = {
  ...createActivityInput,
  // @ts-expect-error occurred_at is injected by the repository.
  occurred_at: "2026-07-28T00:00:00.000Z",
};
void invalidActivityInput;

const outreachUpdateInput: UpdateBacklinkOutreachInput = { status: "ready" };
const linkUpdateInput: UpdateBacklinkLinkInput = { status: "active" };
const noteUpdateInput: UpdateBacklinkNoteInput = { body: "Updated evidence." };
assert.equal(outreachUpdateInput.status, "ready");
assert.equal(linkUpdateInput.status, "active");
assert.equal(noteUpdateInput.body, "Updated evidence.");

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
  for (const repositoryFile of mutableRepositoryFiles) {
    const source = await fs.readFile(repositoryFile, "utf8");
    assert.match(source, /normalizeRepositoryPage/);
    assert.match(source, /count: "exact"/);
    assert.match(source, /\.eq\("workspace_id", workspaceId\)/);
    assert.match(source, /workspace_id: workspaceId/);
    assert.match(source, /assertNonEmptyUpdate/);
    assert.match(source, /normalizeBacklinkRepositoryError/);
    assert.match(source, /code: "NOT_FOUND"/);
  }

  const activitySource = await fs.readFile(
    "lib/backlinks/repositories/activityRepository.ts",
    "utf8",
  );
  assert.match(activitySource, /normalizeRepositoryPage/);
  assert.match(activitySource, /count: "exact"/);
  assert.match(activitySource, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(activitySource, /workspace_id: workspaceId/);
  assert.match(activitySource, /occurred_at: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(activitySource, /export async function updateBacklinkActivity/);
  assert.doesNotMatch(activitySource, /export async function deleteBacklinkActivity/);
  assert.doesNotMatch(activitySource, /\.update\(/);
  assert.doesNotMatch(activitySource, /\.delete\(/);

  await assertEmptyUpdateRejected(
    () => updateBacklinkOutreach(null!, "workspace-id", "outreach-id", {}),
    "updateBacklinkOutreach",
  );
  await assertEmptyUpdateRejected(
    () => updateBacklinkLink(null!, "workspace-id", "link-id", {}),
    "updateBacklinkLink",
  );
  await assertEmptyUpdateRejected(
    () => updateBacklinkNote(null!, "workspace-id", "note-id", {}),
    "updateBacklinkNote",
  );

  console.info("Backlink execution repositories smoke passed.");
}

void main();
