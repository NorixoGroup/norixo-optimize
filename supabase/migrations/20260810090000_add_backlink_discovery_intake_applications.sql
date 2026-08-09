begin;

create table public.backlink_discovery_intake_applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_task_id uuid not null references public.automation_tasks(id) on delete restrict,
  candidate_key text not null,
  asset_id uuid not null references public.backlink_assets(id) on delete restrict,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_discovery_intake_applications_identity_unique unique (workspace_id, discovery_task_id, candidate_key, asset_id),
  constraint backlink_discovery_intake_applications_candidate_key_check check (candidate_key = trim(candidate_key) and char_length(candidate_key) between 1 and 160)
);

create index backlink_discovery_intake_applications_opportunity_idx on public.backlink_discovery_intake_applications (opportunity_id);

create or replace function public.validate_backlink_discovery_intake_application_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.automation_tasks task where task.id = new.discovery_task_id and task.workspace_id = new.workspace_id and task.task_kind = 'backlinks.discovery.preview') then
    raise exception 'DISCOVERY_INTAKE_APPLICATION_TASK_SCOPE_MISMATCH';
  end if;
  if not exists (select 1 from public.backlink_assets asset where asset.id = new.asset_id and asset.workspace_id = new.workspace_id) then
    raise exception 'DISCOVERY_INTAKE_APPLICATION_ASSET_WORKSPACE_MISMATCH';
  end if;
  if not exists (select 1 from public.backlink_opportunities opportunity where opportunity.id = new.opportunity_id and opportunity.workspace_id = new.workspace_id and opportunity.asset_id = new.asset_id) then
    raise exception 'DISCOVERY_INTAKE_APPLICATION_OPPORTUNITY_WORKSPACE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_discovery_intake_applications_integrity
before insert or update of workspace_id, discovery_task_id, candidate_key, asset_id, opportunity_id
on public.backlink_discovery_intake_applications for each row execute function public.validate_backlink_discovery_intake_application_integrity();

alter table public.backlink_discovery_intake_applications enable row level security;
create policy "backlink_discovery_intake_applications_select_workspace_members"
on public.backlink_discovery_intake_applications for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.record_backlink_discovery_intake_application(
  p_workspace_id uuid,
  p_discovery_task_id uuid,
  p_candidate_key text,
  p_asset_id uuid,
  p_opportunity_id uuid
)
returns table (application_id uuid, opportunity_id uuid)
language plpgsql security definer set search_path = public as $$
declare existing_application public.backlink_discovery_intake_applications;
begin
  if p_candidate_key is null or p_candidate_key <> trim(p_candidate_key) or char_length(p_candidate_key) not between 1 and 160 then
    raise exception 'DISCOVERY_INTAKE_APPLICATION_INVALID';
  end if;
  select * into existing_application from public.backlink_discovery_intake_applications
  where workspace_id = p_workspace_id and discovery_task_id = p_discovery_task_id and candidate_key = p_candidate_key and asset_id = p_asset_id;
  if found then
    if existing_application.opportunity_id <> p_opportunity_id then raise exception 'DISCOVERY_INTAKE_APPLICATION_MISMATCH'; end if;
    return query select existing_application.id, existing_application.opportunity_id;
    return;
  end if;
  insert into public.backlink_discovery_intake_applications (workspace_id, discovery_task_id, candidate_key, asset_id, opportunity_id)
  values (p_workspace_id, p_discovery_task_id, p_candidate_key, p_asset_id, p_opportunity_id)
  on conflict (workspace_id, discovery_task_id, candidate_key, asset_id) do nothing;
  select * into existing_application from public.backlink_discovery_intake_applications
  where workspace_id = p_workspace_id and discovery_task_id = p_discovery_task_id and candidate_key = p_candidate_key and asset_id = p_asset_id;
  if not found then raise exception 'DISCOVERY_INTAKE_APPLICATION_FAILED'; end if;
  if existing_application.opportunity_id <> p_opportunity_id then raise exception 'DISCOVERY_INTAKE_APPLICATION_MISMATCH'; end if;
  return query select existing_application.id, existing_application.opportunity_id;
end;
$$;

commit;
