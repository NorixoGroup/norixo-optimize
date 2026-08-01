begin;

create table if not exists public.backlink_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  link_id uuid not null references public.backlink_links(id) on delete restrict,
  attempted_at timestamptz not null,
  runtime_kind text not null,
  runtime_reason text,
  verification_status text,
  source_url text not null,
  target_url text not null,
  requested_url text,
  final_url text,
  http_status integer,
  content_type text,
  redirect_count integer,
  fetch_error_code text,
  fetch_error_message text,
  verification_result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_verification_attempts_runtime_kind_check
    check (runtime_kind in ('verified', 'http_unusable', 'fetch_error')),
  constraint backlink_verification_attempts_runtime_reason_check
    check (
      runtime_reason is null
      or runtime_reason in (
        'http_client_error',
        'http_server_error',
        'unsupported_content_type',
        'empty_document'
      )
    ),
  constraint backlink_verification_attempts_verification_status_check
    check (
      verification_status is null
      or verification_status in (
        'FOUND',
        'NOT_FOUND',
        'ANCHOR_CHANGED',
        'REL_CHANGED',
        'TARGET_CHANGED',
        'UNKNOWN'
      )
    ),
  constraint backlink_verification_attempts_source_url_check
    check (source_url = trim(source_url) and source_url ~ '^https?://'),
  constraint backlink_verification_attempts_target_url_check
    check (target_url = trim(target_url) and target_url ~ '^https?://'),
  constraint backlink_verification_attempts_requested_url_check
    check (requested_url is null or (requested_url = trim(requested_url) and requested_url ~ '^https?://')),
  constraint backlink_verification_attempts_final_url_check
    check (final_url is null or (final_url = trim(final_url) and final_url ~ '^https?://')),
  constraint backlink_verification_attempts_http_status_check
    check (http_status is null or http_status between 100 and 599),
  constraint backlink_verification_attempts_redirect_count_check
    check (redirect_count is null or redirect_count >= 0),
  constraint backlink_verification_attempts_fetch_error_code_check
    check (fetch_error_code is null or char_length(trim(fetch_error_code)) > 0),
  constraint backlink_verification_attempts_fetch_error_message_check
    check (fetch_error_message is null or char_length(trim(fetch_error_message)) > 0),
  constraint backlink_verification_attempts_verification_result_object_check
    check (verification_result is null or jsonb_typeof(verification_result) = 'object'),
  constraint backlink_verification_attempts_runtime_shape_check
    check (
      (
        runtime_kind = 'verified'
        and verification_status is not null
        and verification_result is not null
        and runtime_reason is null
        and fetch_error_code is null
        and fetch_error_message is null
      )
      or (
        runtime_kind = 'http_unusable'
        and runtime_reason is not null
        and verification_status is null
        and verification_result is null
        and fetch_error_code is null
        and fetch_error_message is null
      )
      or (
        runtime_kind = 'fetch_error'
        and fetch_error_code is not null
        and fetch_error_message is not null
        and runtime_reason is null
        and verification_status is null
        and verification_result is null
        and requested_url is null
        and final_url is null
        and http_status is null
        and content_type is null
        and redirect_count is null
      )
    )
);

create index if not exists backlink_verification_attempts_workspace_link_attempted_idx
  on public.backlink_verification_attempts (workspace_id, link_id, attempted_at desc);

create index if not exists backlink_verification_attempts_workspace_attempted_idx
  on public.backlink_verification_attempts (workspace_id, attempted_at desc);

create or replace function public.validate_backlink_verification_attempt_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.backlink_links as backlink_link
    where backlink_link.id = new.link_id
      and backlink_link.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_VERIFICATION_ATTEMPT_LINK_WORKSPACE_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger trg_backlink_verification_attempts_workspace_integrity
before insert on public.backlink_verification_attempts
for each row
execute function public.validate_backlink_verification_attempt_workspace();

alter table public.backlink_verification_attempts enable row level security;

create policy "backlink_verification_attempts_select_workspace_members"
on public.backlink_verification_attempts
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "backlink_verification_attempts_insert_workspace_admins"
on public.backlink_verification_attempts
for insert
to authenticated
with check (public.is_workspace_admin_or_owner(workspace_id));

comment on table public.backlink_verification_attempts is
  'Append-only workspace-scoped verification attempt history. It records technical and business outcomes without changing current backlink state.';

commit;
