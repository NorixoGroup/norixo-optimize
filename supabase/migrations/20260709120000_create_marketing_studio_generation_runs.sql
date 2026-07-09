create table if not exists public.marketing_studio_generation_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  submission_key text not null,
  request_id uuid not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  input_json jsonb not null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_studio_generation_runs enable row level security;

create unique index if not exists marketing_studio_generation_runs_workspace_submission_idx
  on public.marketing_studio_generation_runs (workspace_id, submission_key);

create index if not exists marketing_studio_generation_runs_status_created_idx
  on public.marketing_studio_generation_runs (status, created_at asc);

create index if not exists marketing_studio_generation_runs_campaign_idx
  on public.marketing_studio_generation_runs (campaign_id);

create policy "marketing_studio_generation_runs_select_workspace_members"
  on public.marketing_studio_generation_runs
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "marketing_studio_generation_runs_insert_workspace_members"
  on public.marketing_studio_generation_runs
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "marketing_studio_generation_runs_update_workspace_members"
  on public.marketing_studio_generation_runs
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_studio_generation_runs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create or replace function public.enqueue_marketing_studio_generation_run(
  p_workspace_id uuid,
  p_created_by uuid,
  p_submission_key text,
  p_request_id uuid,
  p_name text,
  p_objective text,
  p_language text,
  p_timeframe text,
  p_channels text[],
  p_input_json jsonb
)
returns table (
  run_id uuid,
  campaign_id uuid,
  status text,
  was_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_run public.marketing_studio_generation_runs;
  created_campaign public.marketing_campaigns;
  created_run public.marketing_studio_generation_runs;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_workspace_id::text || ':' || coalesce(p_submission_key, ''),
      0
    )
  );

  select *
  into existing_run
  from public.marketing_studio_generation_runs
  where workspace_id = p_workspace_id
    and submission_key = p_submission_key
  order by created_at desc
  limit 1;

  if found then
    return query
    select
      existing_run.id,
      existing_run.campaign_id,
      existing_run.status,
      false;
    return;
  end if;

  insert into public.marketing_campaigns (
    workspace_id,
    created_by,
    name,
    objective,
    language,
    timeframe,
    channels,
    status,
    updated_at
  )
  values (
    p_workspace_id,
    p_created_by,
    coalesce(nullif(trim(p_name), ''), 'Campagne sans nom'),
    coalesce(nullif(trim(p_objective), ''), 'Campagne marketing Norixo'),
    coalesce(nullif(trim(p_language), ''), 'fr'),
    coalesce(nullif(trim(p_timeframe), ''), '7 jours'),
    coalesce(p_channels, array['Instagram', 'Facebook', 'LinkedIn', 'TikTok']),
    'draft',
    now()
  )
  returning *
  into created_campaign;

  insert into public.marketing_studio_generation_runs (
    campaign_id,
    workspace_id,
    created_by,
    submission_key,
    request_id,
    status,
    input_json,
    updated_at
  )
  values (
    created_campaign.id,
    p_workspace_id,
    p_created_by,
    p_submission_key,
    p_request_id,
    'queued',
    p_input_json,
    now()
  )
  returning *
  into created_run;

  return query
  select
    created_run.id,
    created_run.campaign_id,
    created_run.status,
    true;
end;
$$;

create or replace function public.claim_marketing_studio_generation_run()
returns public.marketing_studio_generation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_run public.marketing_studio_generation_runs;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('marketing_studio_generation_runs_claim', 0)
  ) then
    return null;
  end if;

  if exists (
    select 1
    from public.marketing_studio_generation_runs
    where status = 'running'
  ) then
    return null;
  end if;

  select *
  into claimed_run
  from public.marketing_studio_generation_runs
  where status = 'queued'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.marketing_studio_generation_runs
  set
    status = 'running',
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = claimed_run.id
  returning *
  into claimed_run;

  return claimed_run;
end;
$$;

revoke all on function public.enqueue_marketing_studio_generation_run(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text[],
  jsonb
) from public;

revoke all on function public.enqueue_marketing_studio_generation_run(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text[],
  jsonb
) from anon;

revoke all on function public.enqueue_marketing_studio_generation_run(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text[],
  jsonb
) from authenticated;

grant execute on function public.enqueue_marketing_studio_generation_run(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text[],
  jsonb
) to service_role;

revoke all on function public.claim_marketing_studio_generation_run()
  from public;

revoke all on function public.claim_marketing_studio_generation_run()
  from anon;

revoke all on function public.claim_marketing_studio_generation_run()
  from authenticated;

grant execute on function public.claim_marketing_studio_generation_run()
  to service_role;
