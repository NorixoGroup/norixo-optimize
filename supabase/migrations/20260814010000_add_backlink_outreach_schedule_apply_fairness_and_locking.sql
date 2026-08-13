begin;

alter table public.automation_workspace_controls
  add column if not exists last_schedule_apply_attempt_at timestamptz;

create index if not exists automation_workspace_controls_schedule_apply_fairness_idx
  on public.automation_workspace_controls (
    backlink_outreach_schedule_apply_enabled,
    dry_run_only,
    backlinks_enabled,
    last_schedule_apply_attempt_at asc nulls first,
    workspace_id asc
  );

create table if not exists public.backlink_outreach_schedule_apply_locks (
  lock_key text primary key,
  holder_id text not null,
  acquired_at timestamptz not null,
  lease_expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_schedule_apply_locks_lock_key_check check (lock_key = trim(lock_key) and char_length(trim(lock_key)) > 0),
  constraint backlink_outreach_schedule_apply_locks_holder_id_check check (holder_id = trim(holder_id) and char_length(trim(holder_id)) > 0),
  constraint backlink_outreach_schedule_apply_locks_lease_check check (lease_expires_at > acquired_at),
  constraint backlink_outreach_schedule_apply_locks_released_check check (released_at is null or released_at >= acquired_at)
);

comment on table public.backlink_outreach_schedule_apply_locks is 'Durable lease lock for Backlinks outreach schedule apply-all orchestration; only one run may hold the lock key at a time.';
comment on column public.backlink_outreach_schedule_apply_locks.lock_key is 'Stable orchestration lock key. This lock is scoped to the global outreach schedule apply-all runner.';
comment on column public.backlink_outreach_schedule_apply_locks.holder_id is 'Opaque lease holder identifier for the current orchestration attempt.';
comment on column public.backlink_outreach_schedule_apply_locks.lease_expires_at is 'The lock is considered free once this timestamp is in the past.';

create trigger trg_backlink_outreach_schedule_apply_locks_updated_at
  before update on public.backlink_outreach_schedule_apply_locks
  for each row execute function public.set_automation_updated_at();

alter table public.backlink_outreach_schedule_apply_locks enable row level security;

create or replace function public.acquire_backlink_outreach_schedule_apply_lock(
  p_lock_key text,
  p_holder_id text,
  p_acquired_at timestamptz,
  p_lease_duration_seconds integer
)
returns setof public.backlink_outreach_schedule_apply_locks
language plpgsql
security definer
set search_path = public
as $$
declare
  lock_row public.backlink_outreach_schedule_apply_locks;
begin
  if p_lock_key is null or char_length(trim(p_lock_key)) = 0 then
    raise exception 'BACKLINK_OUTREACH_SCHEDULE_APPLY_LOCK_INVALID';
  end if;
  if p_holder_id is null or char_length(trim(p_holder_id)) = 0 then
    raise exception 'BACKLINK_OUTREACH_SCHEDULE_APPLY_LOCK_INVALID';
  end if;
  if p_acquired_at is null or p_lease_duration_seconds not between 30 and 3600 then
    raise exception 'BACKLINK_OUTREACH_SCHEDULE_APPLY_LOCK_INVALID';
  end if;

  insert into public.backlink_outreach_schedule_apply_locks (
    lock_key,
    holder_id,
    acquired_at,
    lease_expires_at
  )
  values (
    trim(p_lock_key),
    trim(p_holder_id),
    p_acquired_at,
    p_acquired_at + make_interval(secs => p_lease_duration_seconds)
  )
  on conflict (lock_key) do update
    set holder_id = excluded.holder_id,
        acquired_at = excluded.acquired_at,
        lease_expires_at = excluded.lease_expires_at,
        released_at = null
    where public.backlink_outreach_schedule_apply_locks.released_at is not null
       or public.backlink_outreach_schedule_apply_locks.lease_expires_at <= excluded.acquired_at
  returning * into lock_row;

  if found then
    return next lock_row;
  end if;
end;
$$;

create or replace function public.release_backlink_outreach_schedule_apply_lock(
  p_lock_key text,
  p_holder_id text,
  p_released_at timestamptz
)
returns setof public.backlink_outreach_schedule_apply_locks
language plpgsql
security definer
set search_path = public
as $$
declare
  lock_row public.backlink_outreach_schedule_apply_locks;
begin
  if p_lock_key is null or char_length(trim(p_lock_key)) = 0 then
    raise exception 'BACKLINK_OUTREACH_SCHEDULE_APPLY_LOCK_INVALID';
  end if;
  if p_holder_id is null or char_length(trim(p_holder_id)) = 0 then
    raise exception 'BACKLINK_OUTREACH_SCHEDULE_APPLY_LOCK_INVALID';
  end if;
  if p_released_at is null then
    raise exception 'BACKLINK_OUTREACH_SCHEDULE_APPLY_LOCK_INVALID';
  end if;

  update public.backlink_outreach_schedule_apply_locks
    set released_at = p_released_at,
        lease_expires_at = p_released_at
    where lock_key = trim(p_lock_key)
      and holder_id = trim(p_holder_id)
      and released_at is null
    returning * into lock_row;

  if found then
    return next lock_row;
  end if;
end;
$$;

revoke all on function public.acquire_backlink_outreach_schedule_apply_lock(text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.release_backlink_outreach_schedule_apply_lock(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.acquire_backlink_outreach_schedule_apply_lock(text, text, timestamptz, integer) to service_role;
grant execute on function public.release_backlink_outreach_schedule_apply_lock(text, text, timestamptz) to service_role;

comment on function public.acquire_backlink_outreach_schedule_apply_lock(text, text, timestamptz, integer) is 'Acquires the global Backlinks outreach schedule apply-all lease lock if it is free or expired.';
comment on function public.release_backlink_outreach_schedule_apply_lock(text, text, timestamptz) is 'Releases the global Backlinks outreach schedule apply-all lease lock for the current holder.';

commit;
