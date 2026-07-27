begin;

create table if not exists public.backlink_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.backlink_opportunities(id) on delete restrict,
  note_type text not null,
  body text not null,
  visibility text not null default 'workspace_members',
  author_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz,
  supersedes_note_id uuid references public.backlink_notes(id) on delete restrict,
  constraint backlink_notes_note_type_check
    check (note_type in ('research', 'qualification', 'editorial', 'campaign', 'privacy', 'closure')),
  constraint backlink_notes_body_check
    check (char_length(trim(body)) > 0),
  constraint backlink_notes_visibility_check
    check (visibility in ('admin_only', 'workspace_members')),
  constraint backlink_notes_supersedes_not_self_check
    check (supersedes_note_id is null or supersedes_note_id <> id)
);

create index if not exists backlink_notes_opportunity_created_idx
  on public.backlink_notes (opportunity_id, created_at desc);

create or replace function public.validate_backlink_note_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_opportunities as opportunity
    where opportunity.id = new.opportunity_id
      and opportunity.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_NOTE_OPPORTUNITY_WORKSPACE_MISMATCH';
  end if;

  if new.supersedes_note_id is not null and not exists (
    select 1
    from public.backlink_notes as superseded_note
    where superseded_note.id = new.supersedes_note_id
      and superseded_note.workspace_id = new.workspace_id
      and superseded_note.opportunity_id = new.opportunity_id
  ) then
    raise exception 'BACKLINK_NOTE_SUPERSEDES_TARGET_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_notes_workspace_integrity
  on public.backlink_notes;
create trigger trg_backlink_notes_workspace_integrity
before insert or update of workspace_id, opportunity_id, supersedes_note_id on public.backlink_notes
for each row
execute function public.validate_backlink_note_workspace();

alter table public.backlink_notes enable row level security;

create policy "backlink_notes_select_visible_workspace_members"
on public.backlink_notes
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    visibility = 'workspace_members'
    or public.is_workspace_admin_or_owner(workspace_id)
  )
);

create policy "backlink_notes_insert_workspace_admins"
on public.backlink_notes
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and author_id = auth.uid()
);

create policy "backlink_notes_update_workspace_admins"
on public.backlink_notes
for update
to authenticated
using (public.is_workspace_admin_or_owner(workspace_id))
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_notes is
  'Workspace-scoped internal opportunity notes. Corrections supersede prior notes; activity and attachments are intentionally deferred.';

commit;
