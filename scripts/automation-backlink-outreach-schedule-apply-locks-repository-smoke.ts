import {
  releaseBacklinkOutreachScheduleApplyLock,
  tryAcquireBacklinkOutreachScheduleApplyLock,
} from "../lib/automation/repositories/backlinkOutreachScheduleApplyLocksRepository";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const calls: Array<{ rpc: string; args: Record<string, unknown> }> = [];
  let mode: "acquire" | "locked" | "release" = "acquire";

  const client = {
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      calls.push({ rpc, args });
      if (rpc === "acquire_backlink_outreach_schedule_apply_lock") {
        if (mode === "locked") {
          return { data: [], error: null };
        }
        mode = "release";
        return {
          data: [
            {
              lock_key: "backlinks:outreach:schedule:apply-all",
              holder_id: "holder-1",
              acquired_at: "2026-08-13T08:15:00.000Z",
              lease_expires_at: "2026-08-13T08:25:00.000Z",
              released_at: null,
              created_at: "2026-08-13T08:15:00.000Z",
              updated_at: "2026-08-13T08:15:00.000Z",
            },
          ],
          error: null,
        };
      }
      if (rpc === "release_backlink_outreach_schedule_apply_lock") {
        if (mode === "locked") {
          return { data: [], error: null };
        }
        return {
          data: [
            {
              lock_key: "backlinks:outreach:schedule:apply-all",
              holder_id: "holder-1",
              acquired_at: "2026-08-13T08:15:00.000Z",
              lease_expires_at: "2026-08-13T08:15:00.000Z",
              released_at: "2026-08-13T08:16:00.000Z",
              created_at: "2026-08-13T08:15:00.000Z",
              updated_at: "2026-08-13T08:16:00.000Z",
            },
          ],
          error: null,
        };
      }
      return { data: [], error: new Error("unexpected rpc") };
    },
  };

  const acquired = await tryAcquireBacklinkOutreachScheduleApplyLock(client, {
    lockKey: "backlinks:outreach:schedule:apply-all",
    holderId: "holder-1",
    acquiredAt: "2026-08-13T08:15:00.000Z",
    leaseDurationSeconds: 600,
  });
  assert(acquired.kind === "acquired", "Lock acquisition must succeed once.");
  assert(acquired.lock.lockKey === "backlinks:outreach:schedule:apply-all", "Lock key must be preserved.");

  mode = "locked";
  const locked = await tryAcquireBacklinkOutreachScheduleApplyLock(client, {
    lockKey: "backlinks:outreach:schedule:apply-all",
    holderId: "holder-2",
    acquiredAt: "2026-08-13T08:16:00.000Z",
    leaseDurationSeconds: 600,
  });
  assert(locked.kind === "already_running", "Concurrent acquisition must report already_running.");

  mode = "release";
  await releaseBacklinkOutreachScheduleApplyLock(client, {
    lockKey: "backlinks:outreach:schedule:apply-all",
    holderId: "holder-1",
    releasedAt: "2026-08-13T08:16:00.000Z",
  });

  assert(calls.map((call) => call.rpc).join(",") === "acquire_backlink_outreach_schedule_apply_lock,acquire_backlink_outreach_schedule_apply_lock,release_backlink_outreach_schedule_apply_lock", "RPC sequence must stay acquire/acquire/release.");
  assert(calls[0]?.args.p_lease_duration_seconds === 600, "Lease duration must be forwarded.");
  assert(calls[1]?.args.p_holder_id === "holder-2", "Second holder must be forwarded.");

  console.log("PASS — Automation backlinks outreach schedule apply lock repository smoke");
}

void main();
