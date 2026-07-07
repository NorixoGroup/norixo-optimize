create table if not exists public.marketing_studio_tiktok_connections (
  id bigserial primary key,
  provider text not null unique check (provider = 'tiktok'),
  status text not null check (status in ('connected', 'error')),
  open_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  granted_scopes text[] not null default '{}'::text[],
  last_connected_by_user_id uuid references auth.users(id) on delete set null,
  last_connected_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_studio_tiktok_connections enable row level security;

comment on table public.marketing_studio_tiktok_connections is
  'Single admin-only TikTok Upload API connection for Norixo Marketing Studio. Written and read server-side only.';
