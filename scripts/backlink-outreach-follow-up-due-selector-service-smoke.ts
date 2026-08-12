import { listBacklinkOutreachDueFollowUps } from "../lib/backlinks/services/outreachFollowUpDueSelectorService";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  let received: unknown = null;
  const rpc = async (_name: string, args: Record<string, unknown>) => {
      received = args;
      return {
        data: [
          {
            outreach_id: "outreach",
            next_follow_up_at: "2026-08-12T09:00:00.000Z",
            current_attempt: 1,
            max_attempts: 3,
            latest_attempt_id: "attempt-1",
            latest_attempt_status: "accepted",
          },
        ],
        error: null,
      };
  };
  const service = listBacklinkOutreachDueFollowUps({ rpc: rpc as never });

  const result = await service({
    workspaceId: "workspace",
    now: "2026-08-12T10:00:00.000Z",
    limit: 0,
  });

  assert(JSON.stringify(received) === JSON.stringify({
    p_workspace_id: "workspace",
    p_now: "2026-08-12T10:00:00.000Z",
    p_limit: 50,
  }), "Service must normalize workspace-scoped now/limit input.");
  assert(JSON.stringify(result) === JSON.stringify({
    items: [
      {
        outreachId: "outreach",
        nextFollowUpAt: "2026-08-12T09:00:00.000Z",
        currentAttempt: 1,
        maxAttempts: 3,
        latestAttemptId: "attempt-1",
        latestAttemptStatus: "accepted",
      },
    ],
  }), "Service must return the minimal due follow-up projection.");

  console.log("PASS — Backlink outreach follow-up due selector service smoke");
}

void main();
