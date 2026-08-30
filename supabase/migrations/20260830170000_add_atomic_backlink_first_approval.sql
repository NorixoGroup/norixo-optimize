begin;

create extension if not exists pgcrypto;

create or replace function public.backlink_js_trim(value text)
returns text language sql immutable strict set search_path = public as $$
  select regexp_replace(value,
    '^[' || chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279) || ']+|[' || chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279) || ']+$', '', 'g');
$$;

create or replace function public.approve_backlink_outreach_initial_send(
  p_workspace_id uuid, p_outreach_id uuid, p_approved_by uuid
) returns table(outreach_id uuid, disposition text)
language plpgsql security definer set search_path = public as $$
declare o public.backlink_outreach; c public.backlink_contacts; op public.backlink_opportunities; serialized text; fingerprint text; approved_at timestamptz := timezone('utc', now());
begin
  select * into o from public.backlink_outreach where id=p_outreach_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'OUTREACH_NOT_FOUND'; end if;
  if exists(select 1 from public.backlink_outreach_attempts a where a.workspace_id=p_workspace_id and a.outreach_id=o.id for update) then raise exception 'OUTREACH_ALREADY_ATTEMPTED'; end if;
  select * into op from public.backlink_opportunities where id=o.opportunity_id and workspace_id=p_workspace_id for update;
  if not found or nullif(public.backlink_js_trim(op.target_page_url),'') is null then raise exception 'OUTREACH_TARGET_INVALID'; end if;
  select * into c from public.backlink_contacts where id=o.contact_id and workspace_id=p_workspace_id for update;
  if not found or c.contact_status <> 'verified' or c.archived_at is not null or c.do_not_contact_at is not null or nullif(public.backlink_js_trim(c.email_normalized),'') is null then raise exception 'CONTACT_NOT_ELIGIBLE'; end if;
  serialized := array_to_json(array['bl1',public.backlink_js_trim(p_workspace_id::text),public.backlink_js_trim(o.campaign_id::text),public.backlink_js_trim(o.id::text),public.backlink_js_trim(o.opportunity_id::text),public.backlink_js_trim(o.contact_id::text),public.backlink_js_trim(c.email_normalized),public.backlink_js_trim(o.channel),public.backlink_js_trim(o.subject),public.backlink_js_trim(o.body),public.backlink_js_trim(op.target_page_url)])::text;
  fingerprint := 'bl1_' || encode(digest(convert_to(serialized,'UTF8'),'sha256'),'hex');
  if o.status='ready' then
    if o.auto_send_approved_at is null or o.auto_send_approved_by is null or o.auto_send_approval_fingerprint is null
      or o.auto_send_approved_recipient is null or o.auto_send_approved_subject is null or o.auto_send_approved_body is null
      or o.auto_send_approved_channel is null or o.auto_send_approved_target_url is null or o.auto_send_approved_contact_id is null
      or o.auto_send_approved_opportunity_id is null or o.auto_send_approved_campaign_id is null
      or public.backlink_js_trim(o.auto_send_approved_recipient) <> public.backlink_js_trim(c.email_normalized)
      or public.backlink_js_trim(o.auto_send_approved_subject) <> public.backlink_js_trim(o.subject)
      or public.backlink_js_trim(o.auto_send_approved_body) <> public.backlink_js_trim(o.body)
      or public.backlink_js_trim(o.auto_send_approved_channel) <> public.backlink_js_trim(o.channel)
      or public.backlink_js_trim(o.auto_send_approved_target_url) <> public.backlink_js_trim(op.target_page_url)
      or o.auto_send_approved_contact_id <> o.contact_id or o.auto_send_approved_opportunity_id <> o.opportunity_id
      or o.auto_send_approved_campaign_id <> o.campaign_id or o.auto_send_approval_fingerprint <> fingerprint then
      raise exception 'OUTREACH_APPROVAL_INVALID';
    end if;
    return query select o.id,'already_approved'; return;
  end if;
  if o.status <> 'draft' or o.channel <> 'email' or o.current_attempt <> 0 then raise exception 'OUTREACH_NOT_FIRST_APPROVAL_ELIGIBLE'; end if;
  if nullif(public.backlink_js_trim(o.subject),'') is null or nullif(public.backlink_js_trim(o.body),'') is null then raise exception 'OUTREACH_DRAFT_CONTENT_INCOMPLETE'; end if;
  update public.backlink_outreach set status='ready', auto_send_approved_at=approved_at, auto_send_approved_by=p_approved_by, auto_send_approval_fingerprint=fingerprint, auto_send_approved_recipient=public.backlink_js_trim(c.email_normalized), auto_send_approved_subject=public.backlink_js_trim(o.subject), auto_send_approved_body=public.backlink_js_trim(o.body), auto_send_approved_channel=public.backlink_js_trim(o.channel), auto_send_approved_target_url=public.backlink_js_trim(op.target_page_url), auto_send_approved_contact_id=o.contact_id, auto_send_approved_opportunity_id=o.opportunity_id, auto_send_approved_campaign_id=o.campaign_id where id=o.id and workspace_id=p_workspace_id;
  return query select o.id,'approved';
end; $$;
revoke all on function public.approve_backlink_outreach_initial_send(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.approve_backlink_outreach_initial_send(uuid,uuid,uuid) to service_role;
commit;
