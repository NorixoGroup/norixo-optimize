begin;

alter table public.marketing_studio_linkedin_connections
  add column workspace_id uuid references public.workspaces(id) on delete restrict;

alter table public.marketing_studio_linkedin_connections
  drop constraint marketing_studio_linkedin_connections_pkey;

alter table public.marketing_studio_linkedin_connections
  add constraint marketing_studio_linkedin_connections_provider_workspace_id_key
  unique nulls not distinct (provider, workspace_id);

commit;
