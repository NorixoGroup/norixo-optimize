import { strict as assert } from "node:assert";

import { recordLinkedInReplyConfirmed } from "../lib/backlinks/repositories/linkedinInteractionsRepository";
import { confirmLinkedInReply } from "../lib/backlinks/services/outreachLinkedInInteractionService";

type RpcCall = {
  fn: string;
  args: Record<string, unknown>;
};

async function main() {
  const calls: RpcCall[] = [];

  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });

      return {
        data: [
          {
            disposition: "created",
            interaction_id: "interaction-1",
            occurred_at: "2026-09-16T12:00:00.000Z",
            outreach_status: "replied",
            classification: "positive",
          },
        ],
        error: null,
      };
    },
  };

  const result = await confirmLinkedInReply(client as never, {
    workspaceId: "workspace-1",
    outreachId: "outreach-1",
    actorUserId: "actor-1",
    classification: "positive",
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].fn,
    "record_backlink_manual_linkedin_reply_confirmed",
  );
  assert.deepEqual(calls[0].args, {
    p_workspace_id: "workspace-1",
    p_outreach_id: "outreach-1",
    p_actor_user_id: "actor-1",
    p_classification: "positive",
    p_idempotency_key:
      "manual-linkedin:outreach-1:reply_confirmed:positive",
  });

  assert.deepEqual(result, {
    disposition: "created",
    interactionId: "interaction-1",
    occurredAt: "2026-09-16T12:00:00.000Z",
    outreachStatus: "replied",
    classification: "positive",
  });

  let invalidResultRejected = false;

  try {
    await recordLinkedInReplyConfirmed(
      {
        rpc: async () => ({
          data: [
            {
              disposition: "created",
              interaction_id: "interaction-2",
              occurred_at: "2026-09-16T12:00:00.000Z",
              outreach_status: "replied",
              classification: "negative",
            },
          ],
          error: null,
        }),
      } as never,
      {
        workspaceId: "workspace-1",
        outreachId: "outreach-2",
        actorUserId: "actor-1",
        classification: "positive",
        idempotencyKey:
          "manual-linkedin:outreach-2:reply_confirmed:positive",
      },
    );
  } catch {
    invalidResultRejected = true;
  }

  assert.equal(invalidResultRejected, true);

  console.log(
    "PASS — LinkedIn reply confirmation repository/service smoke (offline)",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
