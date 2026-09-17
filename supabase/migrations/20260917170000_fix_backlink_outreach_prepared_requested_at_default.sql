begin;

alter table public.backlink_outreach_attempts
  alter column requested_at drop default;

commit;
