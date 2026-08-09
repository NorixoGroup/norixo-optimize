begin;

create table public.backlink_outreach_key_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  year integer not null,
  last_value bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, year)
);

alter table public.backlink_outreach_key_counters enable row level security;

create or replace function public.reserve_backlink_outreach_key(p_workspace_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_year integer := extract(year from timezone('utc', now()))::integer; v_value bigint;
begin
  if not exists (select 1 from public.workspaces where id = p_workspace_id) then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  insert into public.backlink_outreach_key_counters (workspace_id, year, last_value)
  values (p_workspace_id, v_year, 1)
  on conflict (workspace_id, year) do update set last_value = public.backlink_outreach_key_counters.last_value + 1, updated_at = timezone('utc', now())
  returning last_value into v_value;
  return 'BL-OUT-' || v_year::text || '-' || lpad(v_value::text, 3, '0');
end;
$$;
revoke all on function public.reserve_backlink_outreach_key(uuid) from public;
revoke all on function public.reserve_backlink_outreach_key(uuid) from anon;
revoke all on function public.reserve_backlink_outreach_key(uuid) from authenticated;
grant execute on function public.reserve_backlink_outreach_key(uuid) to service_role;
commit;
