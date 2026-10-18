begin;

create role norixo_manual_discovery_owner
  nologin nosuperuser nobypassrls noinherit nocreatedb nocreaterole;

grant usage on schema public to norixo_manual_discovery_owner;
grant select on table public.workspaces, public.workspace_members to norixo_manual_discovery_owner;
grant select, update on table public.automation_workspace_controls to norixo_manual_discovery_owner;
grant select, insert on table public.automation_runs, public.automation_tasks to norixo_manual_discovery_owner;

create table public.manual_backlink_discovery_tests (
  test_id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null unique references public.automation_runs(id) on delete cascade,
  task_id uuid not null unique references public.automation_tasks(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.manual_backlink_discovery_tests enable row level security;

grant insert on table public.manual_backlink_discovery_tests to norixo_manual_discovery_owner;

create policy "manual_discovery_owner_insert"
on public.manual_backlink_discovery_tests
for insert
to norixo_manual_discovery_owner
with check (true);

create policy "manual_discovery_owner_select_controls"
on public.automation_workspace_controls
for select
to norixo_manual_discovery_owner
using (true);

create policy "manual_discovery_owner_update_controls"
on public.automation_workspace_controls
for update
to norixo_manual_discovery_owner
using (true)
with check (true);

create policy "manual_discovery_owner_select_workspaces"
on public.workspaces
for select
to norixo_manual_discovery_owner
using (true);

create policy "manual_discovery_owner_select_members"
on public.workspace_members
for select
to norixo_manual_discovery_owner
using (true);

create policy "manual_discovery_owner_select_runs"
on public.automation_runs
for select
to norixo_manual_discovery_owner
using (true);

create policy "manual_discovery_owner_insert_runs"
on public.automation_runs
for insert
to norixo_manual_discovery_owner
with check (true);

create policy "manual_discovery_owner_select_tasks"
on public.automation_tasks
for select
to norixo_manual_discovery_owner
using (true);

create policy "manual_discovery_owner_insert_tasks"
on public.automation_tasks
for insert
to norixo_manual_discovery_owner
with check (true);

grant create on schema public to norixo_manual_discovery_owner;

create function public.create_and_claim_manual_backlink_discovery_test(
  p_workspace_id uuid,
  p_test_id uuid,
  p_query text,
  p_worker_id text,
  p_claimed_at timestamptz,
  p_lease_duration_seconds integer,
  p_requested_by uuid
) returns setof public.automation_tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_run public.automation_runs;
  created_task public.automation_tasks;
begin
  if p_workspace_id is null
    or p_test_id is null
    or p_requested_by is null
    or p_claimed_at is null
    or char_length(trim(coalesce(p_query, ''))) not between 1 and 500
    or char_length(trim(coalesce(p_worker_id, ''))) = 0
    or p_lease_duration_seconds not between 30 and 3600 then
    raise exception 'MANUAL_DISCOVERY_TEST_INVALID_INPUT';
  end if;

  perform 1
  from public.automation_workspace_controls control
  where control.workspace_id = p_workspace_id
    and control.backlinks_enabled
    and control.dry_run_only
    and control.disabled_reason is null
  for share;

  if not found then
    raise exception 'MANUAL_DISCOVERY_TEST_WORKSPACE_NOT_ELIGIBLE';
  end if;

  perform 1
  from public.workspaces workspace
  where workspace.id = p_workspace_id
    and (
      workspace.owner_user_id = p_requested_by
      or exists (
        select 1
        from public.workspace_members member
        where member.workspace_id = p_workspace_id
          and member.user_id = p_requested_by
      )
    );

  if not found then
    raise exception 'MANUAL_DISCOVERY_TEST_REQUESTER_NOT_AUTHORIZED';
  end if;

  insert into public.automation_runs (
    workspace_id,
    system,
    run_kind,
    idempotency_key,
    status,
    mode,
    trigger_source,
    requested_by,
    scheduled_at,
    started_at,
    worker_id,
    attempt_count,
    max_attempts,
    input
  ) values (
    p_workspace_id,
    'backlinks',
    'backlinks.manual_discovery_test',
    'manual-discovery-test:' || p_test_id::text,
    'running',
    'dry_run',
    'manual',
    p_requested_by,
    p_claimed_at,
    p_claimed_at,
    p_worker_id,
    1,
    1,
    jsonb_build_object('testId', p_test_id::text)
  ) returning * into created_run;

  insert into public.automation_tasks (
    workspace_id,
    run_id,
    system,
    task_kind,
    task_key,
    status,
    priority,
    scheduled_at,
    available_at,
    claimed_at,
    started_at,
    heartbeat_at,
    lease_expires_at,
    worker_id,
    attempt_count,
    max_attempts,
    backoff_base_seconds,
    input
  ) values (
    p_workspace_id,
    created_run.id,
    'backlinks',
    'backlinks.discovery.preview',
    'manual-discovery-test:' || p_test_id::text,
    'running',
    10,
    p_claimed_at,
    p_claimed_at,
    p_claimed_at,
    p_claimed_at,
    p_claimed_at,
    p_claimed_at + make_interval(secs => p_lease_duration_seconds),
    p_worker_id,
    1,
    1,
    60,
    jsonb_build_object(
      'version', 1,
      'source', 'manual_dashboard',
      'provider', 'brave_search',
      'searches', jsonb_build_array(jsonb_build_object('query', trim(p_query))),
      'maxResultsPerSearch', 10,
      'maxCandidates', 10
    )
  ) returning * into created_task;

  insert into public.manual_backlink_discovery_tests (test_id, workspace_id, run_id, task_id)
  values (p_test_id, p_workspace_id, created_run.id, created_task.id);

  return next created_task;
end;
$$;

grant norixo_manual_discovery_owner to current_user;
alter function public.create_and_claim_manual_backlink_discovery_test(uuid, uuid, text, text, timestamptz, integer, uuid)
  owner to norixo_manual_discovery_owner;
revoke norixo_manual_discovery_owner from current_user;
revoke create on schema public from norixo_manual_discovery_owner;

revoke all on table public.manual_backlink_discovery_tests from public, anon, authenticated, service_role;
revoke all on function public.create_and_claim_manual_backlink_discovery_test(uuid, uuid, text, text, timestamptz, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_and_claim_manual_backlink_discovery_test(uuid, uuid, text, text, timestamptz, integer, uuid)
  to service_role;

commit;
