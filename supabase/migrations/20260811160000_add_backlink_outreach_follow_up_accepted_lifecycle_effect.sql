begin;

create table public.backlink_outreach_attempt_lifecycle_effects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  attempt_id uuid not null references public.backlink_outreach_attempts(id) on delete restrict,
  effect_kind text not null check (effect_kind = 'follow_up_accepted'),
  status text not null check (status = 'applied'),
  applied_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (attempt_id)
);

create index backlink_outreach_attempt_lifecycle_effects_outreach_idx
  on public.backlink_outreach_attempt_lifecycle_effects (workspace_id, outreach_id, applied_at desc);

alter table public.backlink_outreach_attempt_lifecycle_effects enable row level security;

create policy "Workspace members can read outreach attempt lifecycle effects"
  on public.backlink_outreach_attempt_lifecycle_effects
  for select
  using (public.is_workspace_member(workspace_id));

comment on table public.backlink_outreach_attempt_lifecycle_effects is
  'Append-only audit of atomic Outreach lifecycle effects applied from accepted Attempts.';
comment on column public.backlink_outreach_attempt_lifecycle_effects.effect_kind is
  'Only follow_up_accepted is supported in D4.2.';

create function public.apply_backlink_outreach_follow_up_accepted(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_attempt_id uuid,
  p_provider_message_id text,
  p_accepted_at timestamptz
)
returns table (
  disposition text,
  attempt_status text,
  outreach_status text,
  current_attempt integer,
  last_attempt_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  outreach public.backlink_outreach;
  attempt public.backlink_outreach_attempts;
  effect public.backlink_outreach_attempt_lifecycle_effects;
  normalized_provider_message_id text := nullif(trim(coalesce(p_provider_message_id, '')), '');
begin
  if p_workspace_id is null or p_outreach_id is null or p_attempt_id is null or p_accepted_at is null then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_INVALID';
  end if;

  select * into attempt
  from public.backlink_outreach_attempts
  where id = p_attempt_id
    and workspace_id = p_workspace_id
    and outreach_id = p_outreach_id
  for update;
  if not found or attempt.attempt_kind <> 'follow_up' or attempt.status not in ('requested', 'unknown', 'accepted') then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_INVALID';
  end if;
  if attempt.status = 'accepted' and attempt.provider_message_id is distinct from normalized_provider_message_id then
    raise exception 'FOLLOW_UP_ACCEPTED_RECONCILIATION_CONFLICT';
  end if;

  select * into outreach
  from public.backlink_outreach
  where id = p_outreach_id
    and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_INVALID';
  end if;

  select * into effect
  from public.backlink_outreach_attempt_lifecycle_effects as lifecycle_effect
  where lifecycle_effect.workspace_id = p_workspace_id
    and lifecycle_effect.attempt_id = p_attempt_id
    and lifecycle_effect.effect_kind = 'follow_up_accepted'
  for update;
  if found then
    return query select 'existing', attempt.status, outreach.status, outreach.current_attempt, outreach.last_attempt_at;
    return;
  end if;

  if outreach.current_attempt >= outreach.max_attempts then
    raise exception 'FOLLOW_UP_ACCEPTED_ATTEMPT_LIMIT_REACHED';
  end if;

  update public.backlink_outreach_attempts
  set status = 'accepted',
      accepted_at = p_accepted_at,
      resolved_at = p_accepted_at,
      failed_at = null,
      error_code = null,
      error_message = null,
      provider_message_id = normalized_provider_message_id
  where id = attempt.id
    and workspace_id = p_workspace_id;

  insert into public.backlink_outreach_attempt_lifecycle_effects (
    workspace_id,
    outreach_id,
    attempt_id,
    effect_kind,
    status,
    applied_at
  )
  values (
    p_workspace_id,
    p_outreach_id,
    p_attempt_id,
    'follow_up_accepted',
    'applied',
    p_accepted_at
  );

  update public.backlink_outreach
  set current_attempt = current_attempt + 1,
      last_attempt_at = p_accepted_at,
      next_follow_up_at = null
  where id = p_outreach_id
    and workspace_id = p_workspace_id
  returning * into outreach;

  return query select 'applied', 'accepted', outreach.status, outreach.current_attempt, outreach.last_attempt_at;
end;
$$;

revoke all on function public.apply_backlink_outreach_follow_up_accepted(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_backlink_outreach_follow_up_accepted(uuid, uuid, uuid, text, timestamptz) to service_role;
comment on function public.apply_backlink_outreach_follow_up_accepted(uuid, uuid, uuid, text, timestamptz) is
  'Atomically marks a follow-up Attempt accepted and applies its Outreach lifecycle increment exactly once; never calls a provider.';

commit;
