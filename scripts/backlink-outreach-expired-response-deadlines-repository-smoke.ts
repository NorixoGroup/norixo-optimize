import { listBacklinkOutreachExpiredResponseDeadlines } from "../lib/backlinks/repositories/outreachRepository";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      assert(name === "list_backlink_outreach_expired_response_deadlines", "RPC name must be canonical.");
      assert(args.p_workspace_id === "workspace", "Workspace scope must be passed.");
      assert(args.p_now === "2026-08-12T10:00:00.000Z", "Server now must be passed.");
      assert(args.p_limit === 50, "Default limit must normalize to 50.");
      return {
        data: [
          {
            outreach_id: "outreach",
            response_deadline_at: "2026-08-12T09:00:00.000Z",
            current_attempt: 3,
            max_attempts: 3,
            latest_attempt_id: "attempt-1",
            latest_attempt_status: "accepted",
          },
        ],
        error: null,
      };
    },
  };

  const rows = await listBacklinkOutreachExpiredResponseDeadlines(client as never, {
    workspaceId: "workspace",
    now: "2026-08-12T10:00:00.000Z",
  });
  assert(calls.length === 1, "Selector must batch via one RPC.");
  assert(JSON.stringify(rows) === JSON.stringify([
    {
      outreachId: "outreach",
      responseDeadlineAt: "2026-08-12T09:00:00.000Z",
      currentAttempt: 3,
      maxAttempts: 3,
      latestAttemptId: "attempt-1",
      latestAttemptStatus: "accepted",
    },
  ]), "Repository must project a minimal expired deadline row.");

  const limitedCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const limitedClient = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      limitedCalls.push({ name, args });
      assert(args.p_limit === 200, "Limit must clamp to 200.");
      return { data: [], error: null };
    },
  };
  await listBacklinkOutreachExpiredResponseDeadlines(limitedClient as never, {
    workspaceId: "workspace",
    now: "2026-08-12T10:00:00.000Z",
    limit: 999,
  });
  assert(limitedCalls.length === 1, "Clamped selector call must still be a single RPC.");

  console.log("PASS — Backlink outreach expired response deadline selector repository smoke");
}

void main();
