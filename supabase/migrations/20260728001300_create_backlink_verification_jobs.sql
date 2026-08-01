begin;

create table if not exists public.backlink_verification_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  link_id uuid not null references public.backlink_links(id) on delete restrict,
  job_key text not null,
  trigger_source text not null,
  status text not null default 'queued',
  verification_policy jsonb not null,
  http_options jsonb not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 1,
  queued_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  result_summary jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint backlink_verification_jobs_workspace_job_key_unique
    unique (workspace_id, job_key),
  constraint backlink_verification_jobs_job_key_check
    check (job_key = trim(job_key) and char_length(job_key) between 1 and 255),
  constraint backlink_verification_jobs_trigger_source_check
    check (trigger_source in ('manual', 'scheduler', 'retry', 'system')),
  constraint backlink_verification_jobs_status_check
    check (status in ('queued', 'running', 'completed', 'failed')),
  constraint backlink_verification_jobs_verification_policy_object_check
    check (jsonb_typeof(verification_policy) = 'object'),
  constraint backlink_verification_jobs_http_options_object_check
    check (jsonb_typeof(http_options) = 'object'),
  constraint backlink_verification_jobs_attempt_count_check
    check (attempt_count >= 0 and max_attempts >= 1 and attempt_count <= max_attempts),
  constraint backlink_verification_jobs_error_code_check
    check (last_error_code is null or char_length(trim(last_error_code)) > 0),
  constraint backlink_verification_jobs_error_message_check
    check (last_error_message is null or char_length(trim(last_error_message)) > 0),
  constraint backlink_verification_jobs_result_summary_object_check
    check (result_summary is null or jsonb_typeof(result_summary) = 'object'),
  constraint backlink_verification_jobs_state_check
    check (
      (
        status = 'queued'
        and started_at is null
        and completed_at is null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'running'
        and started_at is not null
        and completed_at is null
        and failed_at is null
      )
      or (
        status = 'completed'
        and completed_at is not null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'failed'
        and failed_at is not null
        and completed_at is null
        and (last_error_code is not null or last_error_message is not null)
      )
    )
);

create index if not exists backlink_verification_jobs_workspace_status_queued_idx
  on public.backlink_verification_jobs (workspace_id, status, queued_at);

create index if not exists backlink_verification_jobs_workspace_link_created_idx
  on public.backlink_verification_jobs (workspace_id, link_id, created_at desc);

create or replace function public.validate_backlink_verification_job_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_links as backlink_link
    where backlink_link.id = new.link_id
      and backlink_link.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_VERIFICATION_JOB_LINK_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger trg_backlink_verification_jobs_workspace_integrity
before insert or update of workspace_id, link_id on public.backlink_verification_jobs
for each row
execute function public.validate_backlink_verification_job_workspace();

create trigger trg_backlink_verification_jobs_workspace_immutable
before update of workspace_id on public.backlink_verification_jobs
for each row
execute function public.prevent_backlink_workspace_reassignment();

create trigger trg_backlink_verification_jobs_updated_at
before update on public.backlink_verification_jobs
for each row
execute function public.set_backlink_foundation_updated_at();

alter table public.backlink_verification_jobs enable row level security;

create policy "backlink_verification_jobs_select_workspace_members"
on public.backlink_verification_jobs
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_verification_jobs_insert_workspace_admins"
on public.backlink_verification_jobs
for insert
to authenticated
with check (public.is_workspace_admin_or_owner(workspace_id));

create policy "backlink_verification_jobs_update_workspace_admins"
on public.backlink_verification_jobs
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_verification_jobs is
  'Workspace-scoped durable backlink verification jobs. Jobs capture execution parameters and operational state; workers and claims are intentionally deferred.';

commit;
