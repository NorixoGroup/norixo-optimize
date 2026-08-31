begin;

create function public.record_backlink_manual_linkedin_initial_contact(
  p_workspace_id uuid,
  p_outreach_id uuid,
  p_actor_user_id uuid
)
returns table (
  disposition text,
  outreach_id uuid,
  attempt_id uuid,
  attempt_number smallint,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  outreach public.backlink_outreach;
  contact public.backlink_contacts;
  existing_attempt public.backlink_outreach_attempts;
  initial_attempt_count integer;
  recorded_at_value timestamptz := clock_timestamp();
  linkedin_recipient text;
begin
  if p_workspace_id is null or p_outreach_id is null or p_actor_user_id is null then
    raise exception 'MANUAL_LINKEDIN_CONTACT_INVALID_INPUT';
  end if;

  select * into outreach
  from public.backlink_outreach
  where id = p_outreach_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'MANUAL_LINKEDIN_CONTACT_NOT_FOUND';
  end if;
  if outreach.channel <> 'linkedin' then
    raise exception 'MANUAL_LINKEDIN_CONTACT_CHANNEL_NOT_SUPPORTED';
  end if;

  select * into contact
  from public.backlink_contacts
  where id = outreach.contact_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'MANUAL_LINKEDIN_CONTACT_CONTACT_NOT_FOUND';
  end if;
  if contact.contact_status = 'do_not_contact' or contact.do_not_contact_at is not null then
    raise exception 'MANUAL_LINKEDIN_CONTACT_DO_NOT_CONTACT';
  end if;
  if contact.contact_status = 'archived' or contact.archived_at is not null then
    raise exception 'MANUAL_LINKEDIN_CONTACT_ARCHIVED';
  end if;
  linkedin_recipient := nullif(trim(coalesce(contact.linkedin_url, '')), '');
  if linkedin_recipient is null then
    raise exception 'MANUAL_LINKEDIN_CONTACT_LINKEDIN_URL_REQUIRED';
  end if;

  select count(*) into initial_attempt_count
  from public.backlink_outreach_attempts as attempt
  where attempt.workspace_id = p_workspace_id
    and attempt.outreach_id = outreach.id
    and attempt.attempt_kind = 'initial';

  if outreach.status = 'active' and outreach.current_attempt = 1 then
    select * into existing_attempt
    from public.backlink_outreach_attempts as attempt
    where attempt.workspace_id = p_workspace_id
      and attempt.outreach_id = outreach.id
      and attempt.attempt_kind = 'initial'
    for update;

    if initial_attempt_count <> 1
      or not found
      or existing_attempt.channel <> 'linkedin'
      or existing_attempt.provider <> 'manual'
      or existing_attempt.recipient <> linkedin_recipient
      or existing_attempt.status <> 'accepted'
      or existing_attempt.provider_message_id is not null
      or existing_attempt.reply_token_hash is not null
      or existing_attempt.reply_token_key_version is not null
      or existing_attempt.requested_at is null
      or existing_attempt.accepted_at is null
      or existing_attempt.resolved_at is null
      or outreach.first_contact_at is null
      or outreach.last_attempt_at is null
      or outreach.first_contact_at is distinct from outreach.last_attempt_at
      or existing_attempt.requested_at is distinct from outreach.first_contact_at
      or existing_attempt.accepted_at is distinct from outreach.first_contact_at
      or existing_attempt.resolved_at is distinct from outreach.first_contact_at then
      raise exception 'MANUAL_LINKEDIN_CONTACT_INCONSISTENT_STATE';
    end if;

    return query select 'existing', outreach.id, existing_attempt.id, 1::smallint, outreach.first_contact_at;
    return;
  end if;

  if outreach.status <> 'draft' or outreach.current_attempt <> 0 then
    raise exception 'MANUAL_LINKEDIN_CONTACT_INCONSISTENT_STATE';
  end if;
  if initial_attempt_count <> 0 then
    raise exception 'MANUAL_LINKEDIN_CONTACT_INCONSISTENT_STATE';
  end if;
  if exists (
    select 1 from public.backlink_outreach_attempts as attempt
    where attempt.workspace_id = p_workspace_id and attempt.outreach_id = outreach.id
  ) then
    raise exception 'MANUAL_LINKEDIN_CONTACT_INCONSISTENT_STATE';
  end if;

  insert into public.backlink_outreach_attempts (
    workspace_id, outreach_id, actor_user_id, channel, provider, recipient,
    idempotency_key, attempt_kind, status, requested_at, accepted_at, resolved_at
  ) values (
    outreach.workspace_id, outreach.id, p_actor_user_id, 'linkedin', 'manual', linkedin_recipient,
    'manual-linkedin-initial:' || outreach.id::text, 'initial', 'accepted',
    recorded_at_value, recorded_at_value, recorded_at_value
  ) returning * into existing_attempt;

  update public.backlink_outreach
  set status = 'active',
      current_attempt = 1,
      first_contact_at = recorded_at_value,
      last_attempt_at = recorded_at_value
  where id = outreach.id and workspace_id = outreach.workspace_id;

  return query select 'created', outreach.id, existing_attempt.id, 1::smallint, recorded_at_value;
end;
$$;

revoke all on function public.record_backlink_manual_linkedin_initial_contact(uuid, uuid, uuid) from public;
revoke all on function public.record_backlink_manual_linkedin_initial_contact(uuid, uuid, uuid) from anon;
revoke all on function public.record_backlink_manual_linkedin_initial_contact(uuid, uuid, uuid) from authenticated;
grant execute on function public.record_backlink_manual_linkedin_initial_contact(uuid, uuid, uuid) to service_role;

commit;
