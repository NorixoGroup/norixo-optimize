begin;

create table public.automation_workspace_controls (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  backlinks_enabled boolean not null default false,
  dry_run_only boolean not null default true,
  disabled_reason text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint automation_workspace_controls_dry_run_only_check check (dry_run_only),
  constraint automation_workspace_controls_disabled_reason_check
    check (disabled_reason is null or char_length(trim(disabled_reason)) > 0)
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  system text not null,
  run_kind text not null,
  idempotency_key text not null,
  status text not null default 'queued',
  mode text not null default 'dry_run',
  trigger_source text not null,
  requested_by uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  heartbeat_at timestamptz,
  lease_expires_at timestamptz,
  worker_id text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 1,
  input jsonb not null default '{}'::jsonb,
  summary jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint automation_runs_workspace_system_kind_key_unique unique (workspace_id, system, run_kind, idempotency_key),
  constraint automation_runs_system_check check (system = 'backlinks'),
  constraint automation_runs_run_kind_check check (run_kind = trim(run_kind) and char_length(run_kind) between 1 and 255),
  constraint automation_runs_idempotency_key_check check (idempotency_key = trim(idempotency_key) and char_length(idempotency_key) between 1 and 255),
  constraint automation_runs_mode_check check (mode = 'dry_run'),
  constraint automation_runs_trigger_source_check check (trigger_source in ('manual', 'scheduled', 'internal')),
  constraint automation_runs_worker_id_check check (worker_id is null or char_length(trim(worker_id)) > 0),
  constraint automation_runs_error_code_check check (error_code is null or char_length(trim(error_code)) > 0),
  constraint automation_runs_error_message_check check (error_message is null or char_length(trim(error_message)) > 0),
  constraint automation_runs_input_object_check check (jsonb_typeof(input) = 'object'),
  constraint automation_runs_summary_object_check check (summary is null or jsonb_typeof(summary) = 'object'),
  constraint automation_runs_attempt_count_check check (attempt_count >= 0 and max_attempts >= 1 and attempt_count <= max_attempts),
  constraint automation_runs_state_check check (
    (status = 'queued' and started_at is null and completed_at is null and failed_at is null and cancelled_at is null and error_code is null and error_message is null)
    or (status = 'running' and started_at is not null and completed_at is null and failed_at is null and cancelled_at is null)
    or (status = 'completed' and started_at is not null and completed_at is not null and failed_at is null and cancelled_at is null and error_code is null and error_message is null)
    or (status = 'failed' and started_at is not null and completed_at is null and failed_at is not null and cancelled_at is null and error_code is not null and error_message is not null)
    or (status = 'cancelled' and completed_at is null and failed_at is null and cancelled_at is not null and error_code is null and error_message is null)
  )
);

create index automation_runs_workspace_status_scheduled_idx on public.automation_runs (workspace_id, status, scheduled_at);
create index automation_runs_workspace_system_created_idx on public.automation_runs (workspace_id, system, created_at desc);
create index automation_runs_status_scheduled_idx on public.automation_runs (status, scheduled_at);

create or replace function public.prevent_automation_workspace_reassignment()
returns trigger language plpgsql as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'AUTOMATION_WORKSPACE_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

create or replace function public.set_automation_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_automation_runs_workspace_immutable before update of workspace_id on public.automation_runs for each row execute function public.prevent_automation_workspace_reassignment();
create trigger trg_automation_runs_updated_at before update on public.automation_runs for each row execute function public.set_automation_updated_at();
create trigger trg_automation_workspace_controls_updated_at before update on public.automation_workspace_controls for each row execute function public.set_automation_updated_at();

alter table public.automation_runs enable row level security;
alter table public.automation_workspace_controls enable row level security;

create policy "automation_runs_select_workspace_members" on public.automation_runs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "automation_runs_insert_workspace_admins" on public.automation_runs for insert to authenticated with check (public.is_workspace_admin_or_owner(workspace_id) and (requested_by is null or requested_by = auth.uid()));
create policy "automation_workspace_controls_select_workspace_members" on public.automation_workspace_controls for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.start_automation_run(p_workspace_id uuid, p_run_id uuid, p_started_at timestamptz)
returns setof public.automation_runs language plpgsql security definer set search_path = public as $$
declare updated public.automation_runs;
begin
  update public.automation_runs set status = 'running', started_at = p_started_at, attempt_count = attempt_count + 1
  where workspace_id = p_workspace_id and id = p_run_id and status = 'queued' and attempt_count < max_attempts
  returning * into updated;
  if found then return next updated; end if;
end;
$$;

create or replace function public.complete_automation_run(p_workspace_id uuid, p_run_id uuid, p_completed_at timestamptz, p_summary jsonb)
returns setof public.automation_runs language plpgsql security definer set search_path = public as $$
declare updated public.automation_runs;
begin
  update public.automation_runs set status = 'completed', completed_at = p_completed_at, summary = p_summary, error_code = null, error_message = null
  where workspace_id = p_workspace_id and id = p_run_id and status = 'running'
  returning * into updated;
  if found then return next updated; end if;
end;
$$;

create or replace function public.fail_automation_run(p_workspace_id uuid, p_run_id uuid, p_failed_at timestamptz, p_error_code text, p_error_message text)
returns setof public.automation_runs language plpgsql security definer set search_path = public as $$
declare updated public.automation_runs;
begin
  update public.automation_runs set status = 'failed', failed_at = p_failed_at, error_code = nullif(trim(p_error_code), ''), error_message = nullif(trim(p_error_message), '')
  where workspace_id = p_workspace_id and id = p_run_id and status = 'running'
  returning * into updated;
  if found then return next updated; end if;
end;
$$;

create or replace function public.cancel_automation_run(p_workspace_id uuid, p_run_id uuid, p_cancelled_at timestamptz, p_reason text)
returns setof public.automation_runs language plpgsql security definer set search_path = public as $$
declare updated public.automation_runs;
begin
  update public.automation_runs set status = 'cancelled', cancelled_at = p_cancelled_at, summary = case when nullif(trim(p_reason), '') is null then summary else jsonb_build_object('reason', trim(p_reason)) end, error_code = null, error_message = null
  where workspace_id = p_workspace_id and id = p_run_id and status in ('queued', 'running')
  returning * into updated;
  if found then return next updated; end if;
end;
$$;

revoke all on function public.start_automation_run(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.complete_automation_run(uuid,uuid,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.fail_automation_run(uuid,uuid,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.cancel_automation_run(uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.start_automation_run(uuid,uuid,timestamptz) to service_role;
grant execute on function public.complete_automation_run(uuid,uuid,timestamptz,jsonb) to service_role;
grant execute on function public.fail_automation_run(uuid,uuid,timestamptz,text,text) to service_role;
grant execute on function public.cancel_automation_run(uuid,uuid,timestamptz,text) to service_role;

comment on table public.automation_runs is 'Durable workspace-scoped dry-run automation executions; A1 has no worker or external actions.';
comment on function public.start_automation_run(uuid,uuid,timestamptz) is 'Atomically transitions an automation run from queued to running.';

commit;
