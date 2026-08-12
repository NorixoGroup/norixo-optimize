import { applyBacklinkOutreachFinalNoResponse } from "../lib/backlinks/services/outreachFinalNoResponseService";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  let received: unknown = null;
  const rpc = async (_name: string, args: Record<string, unknown>) => {
    received = args;
    return {
      data: [{
        disposition: "applied",
        outreach_id: "outreach",
        outreach_status: "no_response",
        closed_at: "2026-08-12T10:00:00.000Z",
        stop_reason: "attempt_limit",
        next_follow_up_at: null,
        response_deadline_at: null,
      }],
      error: null,
    };
  };
  const service = applyBacklinkOutreachFinalNoResponse({ rpc: rpc as never });
  const result = await service({
    workspaceId: "workspace",
    actorUserId: "actor",
    outreachId: "outreach",
    appliedAt: "2026-08-12T10:00:00.000Z",
  });
  assert(JSON.stringify(received) === JSON.stringify({
    p_workspace_id: "workspace",
    p_outreach_id: "outreach",
    p_applied_at: "2026-08-12T10:00:00.000Z",
  }), "Service must pass workspace-scoped canonical args.");
  assert(result.disposition === "applied" && result.outreachStatus === "no_response" && result.stopReason === "attempt_limit", "Service must normalize the final no-response result.");
  console.log("PASS — Backlink outreach final no-response service smoke");
}

void main();
