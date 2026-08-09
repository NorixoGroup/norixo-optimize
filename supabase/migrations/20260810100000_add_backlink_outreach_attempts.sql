begin;

create table public.backlink_outreach_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  channel text not null,
  provider text not null,
  recipient text not null,
  idempotency_key text not null,
  status text not null default 'requested',
  provider_message_id text,
  error_code text,
  error_message text,
  requested_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  failed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_attempts_workspace_idempotency_key_unique unique (workspace_id, idempotency_key),
  constraint backlink_outreach_attempts_channel_check check (channel in ('email', 'linkedin', 'contact_form', 'slack', 'discord', 'reddit', 'other')),
  constraint backlink_outreach_attempts_status_check check (status in ('requested', 'accepted', 'failed', 'unknown')),
  constraint backlink_outreach_attempts_provider_check check (provider = trim(provider) and char_length(provider) > 0),
  constraint backlink_outreach_attempts_recipient_check check (recipient = trim(recipient) and char_length(recipient) > 0),
  constraint backlink_outreach_attempts_idempotency_key_check check (idempotency_key = trim(idempotency_key) and char_length(idempotency_key) > 0)
);

create index backlink_outreach_attempts_workspace_outreach_requested_at_idx
  on public.backlink_outreach_attempts (workspace_id, outreach_id, requested_at desc);

create or replace function public.validate_backlink_outreach_attempt_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.backlink_outreach as outreach
    where outreach.id = new.outreach_id and outreach.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_ATTEMPT_WORKSPACE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_attempts_workspace_integrity
before insert or update of workspace_id, outreach_id on public.backlink_outreach_attempts
for each row execute function public.validate_backlink_outreach_attempt_workspace();

alter table public.backlink_outreach_attempts enable row level security;
create policy "backlink_outreach_attempts_select_workspace_members"
on public.backlink_outreach_attempts for select to authenticated
using (public.is_workspace_member(workspace_id));

comment on table public.backlink_outreach_attempts is 'Append-only outreach send attempts. Subject and body remain in backlink_outreach.';
comment on column public.backlink_outreach_attempts.idempotency_key is 'Server-generated key identifying one explicitly confirmed send action within a workspace.';
comment on column public.backlink_outreach_attempts.status is 'Attempt lifecycle: requested, accepted, failed, or unknown.';
comment on column public.backlink_outreach_attempts.provider_message_id is 'Provider-side message identifier when available.';

commit;
