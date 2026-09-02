begin;

alter table public.marketing_studio_linkedin_connections
  drop constraint if exists marketing_studio_linkedin_connections_status_check;

alter table public.marketing_studio_linkedin_connections
  add constraint marketing_studio_linkedin_connections_status_check
  check (status in ('connected', 'error', 'reconnect_required', 'disconnected'));

commit;
