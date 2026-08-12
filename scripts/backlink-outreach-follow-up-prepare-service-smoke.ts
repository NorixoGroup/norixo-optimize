import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { prepareBacklinkOutreachFollowUp } from "../lib/backlinks/services/outreachFollowUpPreparationService";

async function main() {
  const source = await readFile("lib/backlinks/services/outreachFollowUpPreparationService.ts", "utf8");
  for (const forbidden of ["outreachEmailProvider", "sendTransactionalEmail", "outreachEmailSendService", "Resend", "scheduler"]) {
    assert(!source.includes(forbidden), `Forbidden orchestration dependency: ${forbidden}`);
  }

  const calls: string[] = [];
  const prepare = prepareBacklinkOutreachFollowUp({
    replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "follow-up-secret" } },
    reserveAttempt: async (input) => {
      calls.push(`reserve:${input.idempotencyKey}`);
      assert(input.workspaceId === "workspace" && input.outreachId === "outreach" && input.actorUserId === "actor", "Reservation must receive the server-scoped identity.");
      assert(input.idempotencyKey === "follow-up:001", "Reservation must use the UI idempotency key.");
      assert(input.attemptId.length > 10, "The service must preallocate an attempt id.");
      assert(typeof input.replyTokenHash === "string" && /^[0-9a-f]{64}$/.test(input.replyTokenHash), "Reservation must receive a reply token hash.");
      assert(input.replyTokenKeyVersion === "v1", "Reservation must receive the active reply token key version.");
      assert(typeof input.reservedAt === "string" && input.reservedAt.length > 10, "Reservation must carry a timestamp.");
      return { disposition: "reserved", attemptId: input.attemptId, outreachId: input.outreachId, attemptStatus: "prepared", attemptKind: "follow_up", preparedAt: input.reservedAt, requestedAt: null };
    },
    prepareDraft: async (input) => {
      calls.push(`prepare:${input.attemptId}`);
      assert(input.workspaceId === "workspace" && input.outreachId === "outreach" && input.actorUserId === "actor", "Draft preparation must stay workspace scoped.");
      return { disposition: "created", id: "draft", outreachId: input.outreachId, attemptId: input.attemptId, followUpNumber: 1, subject: "Subject", body: "Body", preparedAt: "2026-08-12T10:00:00.000Z", updatedAt: "2026-08-12T10:00:00.000Z", updatedBy: "actor" };
    },
    now: () => "2026-08-12T10:00:00.000Z",
  });

  const created = await prepare({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "follow-up:001" });
  assert(created.disposition === "prepared", "A fresh reservation must report prepared.");
  assert(calls.length === 2 && calls[0]?.startsWith("reserve:") && calls[1]?.startsWith("prepare:"), "The orchestrator must reserve before preparing the draft.");

  let prepareCalls = 0;
  const prepareExisting = prepareBacklinkOutreachFollowUp({
    replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "follow-up-secret" } },
    reserveAttempt: async (input) => ({ disposition: "existing", attemptId: input.attemptId, outreachId: input.outreachId, attemptStatus: "prepared", attemptKind: "follow_up", preparedAt: "2026-08-12T10:00:00.000Z", requestedAt: null }),
    prepareDraft: async (input) => {
      prepareCalls += 1;
      return { disposition: "existing", id: "draft", outreachId: input.outreachId, attemptId: input.attemptId, followUpNumber: 1, subject: "Subject", body: "Body", preparedAt: "2026-08-12T10:00:00.000Z", updatedAt: "2026-08-12T10:00:00.000Z", updatedBy: "actor" };
    },
  });
  assert((await prepareExisting({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "follow-up:001" })).disposition === "existing", "The same idempotency key must stay idempotent.");
  assert(prepareCalls === 1, "The draft should still be ensured when the attempt already exists.");

  const recovered = prepareBacklinkOutreachFollowUp({
    replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "follow-up-secret" } },
    reserveAttempt: async (input) => ({ disposition: "existing", attemptId: input.attemptId, outreachId: input.outreachId, attemptStatus: "prepared", attemptKind: "follow_up", preparedAt: "2026-08-12T10:00:00.000Z", requestedAt: null }),
    prepareDraft: async () => ({ disposition: "created", id: "draft", outreachId: "outreach", attemptId: "attempt", followUpNumber: 1, subject: "Subject", body: "Body", preparedAt: "2026-08-12T10:00:00.000Z", updatedAt: "2026-08-12T10:00:00.000Z", updatedBy: "actor" }),
  });
  assert((await recovered({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "follow-up:001" })).disposition === "existing", "A recovered retry should remain idempotent.");

  const stopRace = prepareBacklinkOutreachFollowUp({
    replyTokenKeyring: { activeKeyVersion: "v1", secrets: { v1: "follow-up-secret" } },
    reserveAttempt: async (input) => ({ disposition: "reserved", attemptId: input.attemptId, outreachId: input.outreachId, attemptStatus: "prepared", attemptKind: "follow_up", preparedAt: input.reservedAt, requestedAt: null }),
    prepareDraft: async () => { throw new Error("FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED"); },
  });
  await assert.rejects(stopRace({ workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "follow-up:001" }), /FOLLOW_UP_DRAFT_ATTEMPT_NOT_PREPARED/, "A stop race must fail safely.");

  console.log("PASS — Backlink follow-up prepare service smoke");
}

void main();
