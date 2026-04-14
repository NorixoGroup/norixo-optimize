begin;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'workspaces',
        'workspace_members',
        'listings',
        'audits',
        'subscriptions',
        'usage_events'
      ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end
$$;

drop function if exists public.has_pending_workspace_invitation(uuid);
drop function if exists public.is_workspace_admin_or_owner(uuid);
drop function if exists public.is_workspace_member(uuid);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin_or_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function public.has_pending_workspace_invitation(target_workspace_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if to_regclass('public.workspace_invitations') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.workspace_invitations as wi
    where wi.workspace_id = target_workspace_id
      and lower(wi.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and wi.status = 'pending'
      and (wi.expires_at is null or wi.expires_at > now())
  );
end;
$$;



alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.listings enable row level security;
alter table public.audits enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy "workspaces_select_member_scoped"
on public.workspaces
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_workspace_member(id)
);

create policy "workspaces_insert_owner_only"
on public.workspaces
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
);

create policy "workspaces_update_owner_only"
on public.workspaces
for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
);

create policy "workspaces_delete_owner_only"
on public.workspaces
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

create policy "workspace_members_select_member_scoped"
on public.workspace_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_workspace_member(workspace_id)
);

create policy "workspace_members_insert_scoped"
on public.workspace_members
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and exists (
      select 1
      from public.workspaces as w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
  )
  or (
    user_id = auth.uid()
    and public.has_pending_workspace_invitation(workspace_id)
  )
);

create policy "workspace_members_update_admin_only"
on public.workspace_members
for update
to authenticated
using (
  public.is_workspace_admin_or_owner(workspace_id)
)
with check (
  public.is_workspace_admin_or_owner(workspace_id)
);

create policy "workspace_members_delete_admin_or_self"
on public.workspace_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_workspace_admin_or_owner(workspace_id)
);

create policy "listings_select_member_scoped"
on public.listings
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "listings_insert_member_scoped"
on public.listings
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
);

create policy "listings_update_member_scoped"
on public.listings
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
);

create policy "listings_delete_member_scoped"
on public.listings
for delete
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "audits_select_member_scoped"
on public.audits
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "audits_insert_member_scoped"
on public.audits
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
  and exists (
    select 1
    from public.listings as l
    where l.id = listing_id
      and l.workspace_id = audits.workspace_id
  )
);

create policy "audits_update_member_scoped"
on public.audits
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
)
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.listings as l
    where l.id = listing_id
      and l.workspace_id = audits.workspace_id
  )
);

create policy "audits_delete_member_scoped"
on public.audits
for delete
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "subscriptions_select_member_scoped"
on public.subscriptions
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "subscriptions_insert_admin_scoped"
on public.subscriptions
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
);

create policy "subscriptions_update_admin_scoped"
on public.subscriptions
for update
to authenticated
using (
  public.is_workspace_admin_or_owner(workspace_id)
)
with check (
  public.is_workspace_admin_or_owner(workspace_id)
);

create policy "subscriptions_delete_admin_scoped"
on public.subscriptions
for delete
to authenticated
using (
  public.is_workspace_admin_or_owner(workspace_id)
);

create policy "usage_events_select_member_scoped"
on public.usage_events
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
);

create policy "usage_events_insert_member_scoped"
on public.usage_events
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and user_id = auth.uid()
);

commit;
