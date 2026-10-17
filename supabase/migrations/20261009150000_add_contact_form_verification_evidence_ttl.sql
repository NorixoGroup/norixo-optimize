
create or replace function public.has_current_backlink_contact_form_verification(p_workspace_id uuid, p_contact_id uuid, p_form_url text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.backlink_contacts c
    join public.backlink_contact_form_verifications v
      on v.workspace_id = c.workspace_id
      and v.contact_id = c.id
      and v.form_url = trim(c.contact_form_url)
    where p_workspace_id is not null
      and p_contact_id is not null
      and c.workspace_id = p_workspace_id
      and c.id = p_contact_id
      and nullif(trim(coalesce(c.contact_form_url, '')), '') is not null
      and trim(c.contact_form_url) = trim(coalesce(p_form_url, ''))
      and trim(c.contact_form_url) ~ '^https://[^[:space:]]+$'
      and position(chr(92) in trim(c.contact_form_url)) = 0
      and v.verification_state = 'verified'
      and v.verified_at is not null
      and v.verified_at <= now()
      and v.verified_at >= now() - interval '7 days'
      and public.backlink_contact_form_verification_evidence_valid(v.safe_evidence)
  )
$$;

revoke all on function public.has_current_backlink_contact_form_verification(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.has_current_backlink_contact_form_verification(uuid,uuid,text) to service_role;
comment on function public.has_current_backlink_contact_form_verification(uuid,uuid,text) is 'Fail-closed current-contact-form verification gate. Requires exact current URL, valid structural evidence, and verified_at between PostgreSQL server now minus seven days and now.';
