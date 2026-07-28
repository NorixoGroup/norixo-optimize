begin;

create table if not exists public.backlink_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activity_key text not null,
  entity_type text not null,
  entity_id uuid not null,
  action_type text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default timezone('utc', now()),
  before_state jsonb,
  after_state jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  constraint backlink_activity_workspace_activity_key_unique
    unique (workspace_id, activity_key),
  constraint backlink_activity_activity_key_check
    check (activity_key = upper(trim(activity_key)) and activity_key ~ '^BL-ACT-[0-9]{6,}$'),
  constraint backlink_activity_entity_type_check
    check (char_length(trim(entity_type)) > 0),
  constraint backlink_activity_action_type_check
    check (char_length(trim(action_type)) > 0),
  constraint backlink_activity_reason_check
    check (reason is null or char_length(trim(reason)) > 0),
  constraint backlink_activity_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists backlink_activity_workspace_entity_occurred_idx
  on public.backlink_activity (workspace_id, entity_type, entity_id, occurred_at desc);

alter table public.backlink_activity enable row level security;

create policy "backlink_activity_select_workspace_members"
on public.backlink_activity
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_activity_insert_workspace_admins"
on public.backlink_activity
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and actor_user_id = auth.uid()
);

comment on table public.backlink_activity is
  'Append-only workspace-scoped backlink activity journal. Current state remains in the respective business tables.';

commit;
