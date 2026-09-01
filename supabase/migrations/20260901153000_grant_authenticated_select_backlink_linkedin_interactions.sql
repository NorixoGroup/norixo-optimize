begin;

grant select
on table public.backlink_linkedin_interactions
to authenticated;

commit;
