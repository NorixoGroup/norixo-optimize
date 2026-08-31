begin;

create or replace function public.reserve_backlink_approved_initial_attempt_v2(
  p_workspace_id uuid,
  p_campaign_id uuid,
  p_outreach_id uuid,
  p_actor_user_id uuid,
  p_attempt_id uuid,
  p_idempotency_key text,
  p_reply_token_hash text,
  p_reply_token_key_version text,
  p_requested_at timestamptz
)
returns table (
  disposition text,
  attempt_id uuid,
  rate_limit_reason text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.reserve_backlink_outreach_initial_attempt_for_approved_auto_sen(
    p_workspace_id,
    p_campaign_id,
    p_outreach_id,
    p_attempt_id,
    p_actor_user_id,
    p_idempotency_key,
    p_reply_token_hash,
    p_reply_token_key_version,
    p_requested_at
  );
end;
$$;

revoke all on function public.reserve_backlink_approved_initial_attempt_v2(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) from public;
revoke all on function public.reserve_backlink_approved_initial_attempt_v2(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) from anon;
revoke all on function public.reserve_backlink_approved_initial_attempt_v2(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) from authenticated;
grant execute on function public.reserve_backlink_approved_initial_attempt_v2(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) to service_role;

comment on function public.reserve_backlink_approved_initial_attempt_v2(uuid, uuid, uuid, uuid, uuid, text, text, text, timestamptz) is
  'Stable short PostgREST RPC alias that delegates to the hardened V2 reservation function and avoids PostgreSQL identifier truncation.';

commit;
