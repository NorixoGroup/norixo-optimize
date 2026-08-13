import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { Database } from "@/types/database.types";

type BacklinkOutreachScheduleApplyLockRow =
  Database["public"]["Tables"]["backlink_outreach_schedule_apply_locks"]["Row"];

type BacklinkOutreachScheduleApplyLockClient = {
  rpc: (
    functionName:
      | "acquire_backlink_outreach_schedule_apply_lock"
      | "release_backlink_outreach_schedule_apply_lock",
    args:
      | Database["public"]["Functions"]["acquire_backlink_outreach_schedule_apply_lock"]["Args"]
      | Database["public"]["Functions"]["release_backlink_outreach_schedule_apply_lock"]["Args"],
  ) => PromiseLike<{ data: BacklinkOutreachScheduleApplyLockRow[] | null; error: unknown }>;
};

function mapBacklinkOutreachScheduleApplyLock(row: BacklinkOutreachScheduleApplyLockRow) {
  return {
    lockKey: row.lock_key,
    holderId: row.holder_id,
    acquiredAt: row.acquired_at,
    leaseExpiresAt: row.lease_expires_at,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function callLockRpc(
  client: BacklinkOutreachScheduleApplyLockClient,
  operation: string,
  rpc: "acquire_backlink_outreach_schedule_apply_lock" | "release_backlink_outreach_schedule_apply_lock",
  args: Database["public"]["Functions"]["acquire_backlink_outreach_schedule_apply_lock"]["Args"] | Database["public"]["Functions"]["release_backlink_outreach_schedule_apply_lock"]["Args"],
) {
  const { data, error } = await client.rpc(rpc, args);
  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (!Array.isArray(data) || data.length > 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation,
      message: "The database returned an invalid orchestration lock result.",
    });
  }
  return data[0] == null ? null : mapBacklinkOutreachScheduleApplyLock(data[0] as BacklinkOutreachScheduleApplyLockRow);
}

export async function tryAcquireBacklinkOutreachScheduleApplyLock(
  client: BacklinkOutreachScheduleApplyLockClient,
  input: {
    lockKey: string;
    holderId: string;
    acquiredAt: string;
    leaseDurationSeconds: number;
  },
): Promise<{ kind: "acquired"; lock: ReturnType<typeof mapBacklinkOutreachScheduleApplyLock> } | { kind: "already_running" }> {
  const operation = "tryAcquireBacklinkOutreachScheduleApplyLock";
  const lock = await callLockRpc(client, operation, "acquire_backlink_outreach_schedule_apply_lock", {
    p_lock_key: input.lockKey,
    p_holder_id: input.holderId,
    p_acquired_at: input.acquiredAt,
    p_lease_duration_seconds: input.leaseDurationSeconds,
  });
  return lock == null ? { kind: "already_running" } : { kind: "acquired", lock };
}

export async function releaseBacklinkOutreachScheduleApplyLock(
  client: BacklinkOutreachScheduleApplyLockClient,
  input: {
    lockKey: string;
    holderId: string;
    releasedAt: string;
  },
): Promise<void> {
  await callLockRpc(client, "releaseBacklinkOutreachScheduleApplyLock", "release_backlink_outreach_schedule_apply_lock", {
    p_lock_key: input.lockKey,
    p_holder_id: input.holderId,
    p_released_at: input.releasedAt,
  });
}
