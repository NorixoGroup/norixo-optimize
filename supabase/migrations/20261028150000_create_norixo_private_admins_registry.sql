begin;

-- Norixo AI / Marketing Studio: dedicated private-admin registry, independent
-- of workspace_members.role and of any e-mail supplied by a client. Row Level
-- Security is enabled with NO policy for `authenticated` or `anon` on this
-- table, so no signed-in user -- including an existing private admin -- can
-- INSERT/UPDATE/DELETE it through their own session. Table-level grants are
-- also explicitly revoked from public/anon/authenticated below, as a second,
-- independent layer on top of RLS. Only service_role (which bypasses RLS and
-- already has Supabase's default table privileges) or a direct database
-- connection (Supabase SQL editor) can provision rows. This is the
-- self-attribution protection: there is no policy, function, grant, or
-- application code path that lets a user grant themselves this status.
--
-- Deliberately split from the Marketing Studio RLS tightening: this migration
-- ONLY creates the registry and its lookup function. It does NOT touch any
-- existing policy on marketing_campaigns / marketing_studio_generation_runs --
-- the seven original _workspace_members policies remain fully active after
-- this migration runs, so applying it alone changes no observable behavior
-- and locks nobody out. The actual policy replacement, and the admin
-- provisioning it depends on, live in a separate, later migration (see
-- 20261028160000_restrict_marketing_studio_tables_to_private_admins_policies.sql
-- and the deployment order documented there).
create table if not exists public.norixo_private_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  note text
);

alter table public.norixo_private_admins enable row level security;

revoke all on public.norixo_private_admins from public, anon, authenticated;

comment on table public.norixo_private_admins is
  'Source of truth for Norixo AI / Marketing Studio private-admin access. No authenticated/anon policy or grant exists on this table by design: provisioning requires direct database access (service_role or SQL editor), never a user session.';

create or replace function public.is_norixo_private_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.norixo_private_admins as npa
    where npa.user_id = auth.uid()
  );
$$;

revoke all on function public.is_norixo_private_admin() from public;
grant execute on function public.is_norixo_private_admin() to authenticated;

comment on function public.is_norixo_private_admin() is
  'True only when auth.uid() is present in norixo_private_admins. Independent of workspace_members.role and of any client-supplied e-mail. search_path is empty; every reference is fully schema-qualified.';

commit;
