import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const source = await readFile(
    "supabase/migrations/20260829120000_reclaim_expired_backlink_verification_jobs.sql",
    "utf8",
  );

  for (const fragment of [
    "create or replace function public.reclaim_expired_backlink_verification_jobs",
    "p_workspace_id uuid",
    "p_reclaimed_at timestamptz",
    "p_limit integer",
    "p_job_id uuid default null",
    "p_limit not between 1 and 100",
    "status = 'running'",
    "lease_expires_at <= p_reclaimed_at",
    "p_job_id is null or id = p_job_id",
    "for update skip locked",
    "status = case when job.attempt_count < job.max_attempts then 'queued' else 'failed' end",
    "started_at = case when job.attempt_count < job.max_attempts then null else job.started_at end",
    "worker_id = case when job.attempt_count < job.max_attempts then null else job.worker_id end",
    "claimed_at = case when job.attempt_count < job.max_attempts then null else job.claimed_at end",
    "heartbeat_at = case when job.attempt_count < job.max_attempts then null else job.heartbeat_at end",
    "lease_expires_at = case when job.attempt_count < job.max_attempts then null else job.lease_expires_at end",
    "failed_at = case when job.attempt_count < job.max_attempts then null else p_reclaimed_at end",
    "last_error_code = case when job.attempt_count < job.max_attempts then null else 'verification_job_lease_expired' end",
    "last_error_message = case when job.attempt_count < job.max_attempts then null else 'Backlink verification job lease expired before completion.' end",
    "attempt_count = job.attempt_count",
    "revoke all on function public.reclaim_expired_backlink_verification_jobs",
    "from public, anon, authenticated",
    "grant execute on function public.reclaim_expired_backlink_verification_jobs",
    "to service_role",
  ]) {
    assert(source.includes(fragment), `Missing SQL invariant: ${fragment}`);
  }

  for (const forbidden of [
    "insert into public.backlink_verification_jobs",
    "max_attempts = max_attempts + 1",
    "status = 'completed'",
    "attempt_count = greatest",
    "attempt_count - 1",
    "to authenticated",
  ]) {
    assert(!source.includes(forbidden), `Forbidden SQL behavior: ${forbidden}`);
  }

  type SimulatedJob = { id: string; status: "queued" | "running" | "failed"; attemptCount: number; maxAttempts: number };
  const claim = (job: SimulatedJob): SimulatedJob => {
    if (job.status !== "queued" || job.attemptCount >= job.maxAttempts) return job;
    return { ...job, status: "running", attemptCount: job.attemptCount + 1 };
  };
  const reclaim = (job: SimulatedJob): SimulatedJob => {
    if (job.status !== "running") return job;
    return job.attemptCount < job.maxAttempts
      ? { ...job, status: "queued" }
      : { ...job, status: "failed" };
  };

  const twoAttemptJob = { id: "same-row", status: "queued" as const, attemptCount: 0, maxAttempts: 2 };
  const twoFirstClaim = claim(twoAttemptJob);
  const twoFirstReclaim = reclaim(twoFirstClaim);
  const twoSecondClaim = claim(twoFirstReclaim);
  const twoSecondReclaim = reclaim(twoSecondClaim);
  const twoNoopReclaim = reclaim(twoSecondReclaim);
  const twoNoopClaim = claim(twoNoopReclaim);
  assert(twoFirstClaim.status === "running" && twoFirstClaim.attemptCount === 1, "max_attempts=2 first claim must run attempt 1.");
  assert(twoFirstReclaim.status === "queued" && twoFirstReclaim.attemptCount === 1, "max_attempts=2 first reclaim must requeue without decrement.");
  assert(twoSecondClaim.status === "running" && twoSecondClaim.attemptCount === 2, "max_attempts=2 second claim must run attempt 2.");
  assert(twoSecondReclaim.status === "failed" && twoSecondReclaim.attemptCount === 2, "max_attempts=2 second reclaim must fail exhausted job.");
  assert(twoNoopReclaim === twoSecondReclaim, "Terminal failed reclaim must be a no-op.");
  assert(twoNoopClaim === twoSecondReclaim, "Terminal failed claim must not become claimable.");
  assert(new Set([twoAttemptJob.id, twoFirstClaim.id, twoFirstReclaim.id, twoSecondClaim.id, twoSecondReclaim.id]).size === 1, "Reclaim policy must reuse the same job row.");

  const oneAttemptJob = { id: "same-row", status: "queued" as const, attemptCount: 0, maxAttempts: 1 };
  const oneFirstClaim = claim(oneAttemptJob);
  const oneFirstReclaim = reclaim(oneFirstClaim);
  assert(oneFirstClaim.status === "running" && oneFirstClaim.attemptCount === 1, "max_attempts=1 first claim must run attempt 1.");
  assert(oneFirstReclaim.status === "failed" && oneFirstReclaim.attemptCount === 1, "max_attempts=1 first reclaim must fail exhausted job.");

  console.log("PASS — Backlink verification stale reclaim SQL smoke");
}

void main();
