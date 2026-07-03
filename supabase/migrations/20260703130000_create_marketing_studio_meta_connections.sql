create table if not exists public.marketing_studio_meta_connections (
  provider text primary key check (provider = 'meta'),
  status text not null check (status in ('connected', 'no_pages', 'error')),
  facebook_page_id text,
  facebook_page_name text,
  facebook_page_access_token text,
  facebook_page_token_obtained_at timestamptz,
  instagram_business_account_id text,
  instagram_username text,
  granted_scopes text[] not null default '{}'::text[],
  raw_pages_snapshot jsonb not null default '[]'::jsonb,
  last_connected_by_user_id uuid references auth.users(id) on delete set null,
  last_connected_by_email text,
  updated_at timestamptz not null default now()
);

alter table public.marketing_studio_meta_connections enable row level security;

comment on table public.marketing_studio_meta_connections is
  'Single admin-only Meta connection for Norixo Marketing Studio. Written and read server-side only.';
