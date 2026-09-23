begin;

-- H5.2-B
-- Global outbound email budget:
--   100 attempts / rolling 30 days
-- Shared by initial sends + follow-ups.
--
-- Existing protections remain:
--   5 / rolling 24h
--   2 / rolling hour
--   1 / domain / rolling 24h
--   1 / contact / rolling 24h
--
-- This migration intentionally patches the CURRENT database functions
-- without changing autonomy controls or creating/sending any outreach.

do $$
declare
  initial_definition text;
  followup_definition text;
begin
  select pg_get_functiondef(p.oid)
    into initial_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'reserve_backlink_outreach_initial_attempt'
  order by p.oid desc
  limit 1;

  if initial_definition is null then
    raise exception 'H52B_INITIAL_RPC_NOT_FOUND';
  end if;

  -- Add a rolling 30-day workspace cap immediately before the existing
  -- rolling-24h workspace admission check.
  initial_definition := replace(
    initial_definition,
    'select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = ''email''
    and attempt.status in (''requested'', ''accepted'', ''failed'', ''unknown'')
    and attempt.requested_at >= daily_cutoff;',
    'select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = ''email''
    and attempt.status in (''requested'', ''accepted'', ''failed'', ''unknown'')
    and attempt.requested_at >= p_requested_at - interval ''30 days'';

  if workspace_count >= 100 then
    return query select ''rate_limited'', null::uuid, ''WORKSPACE_30_DAY_LIMIT_REACHED'';
    return;
  end if;

  select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.channel = ''email''
    and attempt.status in (''requested'', ''accepted'', ''failed'', ''unknown'')
    and attempt.requested_at >= daily_cutoff;'
  );

  if position('WORKSPACE_30_DAY_LIMIT_REACHED' in initial_definition) = 0 then
    raise exception 'H52B_INITIAL_PATCH_FAILED';
  end if;

  execute initial_definition;

  select pg_get_functiondef(p.oid)
    into followup_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mark_backlink_outreach_follow_up_attempt_requested'
  order by p.oid desc
  limit 1;

  if followup_definition is null then
    raise exception 'H52B_FOLLOWUP_RPC_NOT_FOUND';
  end if;

  followup_definition := replace(
    followup_definition,
    'select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as item
  where item.workspace_id = p_workspace_id
    and item.channel = ''email''
    and item.status in (''requested'', ''accepted'', ''failed'', ''unknown'')
    and item.requested_at >= daily_cutoff;',
    'select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as item
  where item.workspace_id = p_workspace_id
    and item.channel = ''email''
    and item.status in (''requested'', ''accepted'', ''failed'', ''unknown'')
    and item.requested_at >= p_requested_at - interval ''30 days'';

  if workspace_count >= 100 then
    raise exception ''FOLLOW_UP_SEND_WORKSPACE_30_DAY_RATE_LIMIT'';
  end if;

  select count(*)::integer into workspace_count
  from public.backlink_outreach_attempts as item
  where item.workspace_id = p_workspace_id
    and item.channel = ''email''
    and item.status in (''requested'', ''accepted'', ''failed'', ''unknown'')
    and item.requested_at >= daily_cutoff;'
  );

  if position('FOLLOW_UP_SEND_WORKSPACE_30_DAY_RATE_LIMIT' in followup_definition) = 0 then
    raise exception 'H52B_FOLLOWUP_PATCH_FAILED';
  end if;

  execute followup_definition;
end
$$;

commit;
