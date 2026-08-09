begin;

create or replace function public.reserve_backlink_key(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  case p_kind
    when 'domain' then
      return 'BK-' || lpad(nextval('public.backlink_domain_key_sequence')::text, 4, '0');
    when 'opportunity' then
      return 'OP-' || lpad(nextval('public.backlink_opportunity_key_sequence')::text, 6, '0');
    else
      raise exception 'BACKLINK_KEY_KIND_INVALID' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.reserve_backlink_key(text) from public;
revoke all on function public.reserve_backlink_key(text) from anon;
revoke all on function public.reserve_backlink_key(text) from authenticated;
grant execute on function public.reserve_backlink_key(text) to service_role;

comment on function public.reserve_backlink_key(text) is
  'Reserves a globally unique canonical Backlink Domain or Opportunity key for backend use.';

commit;
