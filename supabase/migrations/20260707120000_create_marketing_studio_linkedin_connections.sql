create table if not exists public.marketing_studio_linkedin_connections (
  provider text primary key check (provider = 'linkedin'),
  status text not null check (status in ('connected', 'error')),
  access_token text,
  expires_at timestamptz,
  organization_urn text,
  organization_id text,
  granted_scopes text[] not null default '{}'::text[],
  last_connected_by_user_id uuid references auth.users(id) on delete set null,
  last_connected_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_studio_linkedin_connections enable row level security;

comment on table public.marketing_studio_linkedin_connections is
  'Single admin-only LinkedIn company page connection for Norixo Marketing Studio. Written and read server-side only.';
