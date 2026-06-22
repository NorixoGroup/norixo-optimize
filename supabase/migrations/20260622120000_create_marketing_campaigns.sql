create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  objective text not null,
  language text not null default 'fr',
  timeframe text not null default '7 jours',
  channels text[] not null default array['Instagram', 'Facebook', 'LinkedIn', 'SEO'],
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'archived')),
  planner_json jsonb,
  social_json jsonb,
  creative_json jsonb,
  video_json jsonb,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_campaigns enable row level security;

create index if not exists marketing_campaigns_workspace_created_idx
  on public.marketing_campaigns (workspace_id, created_at desc);

create policy "marketing_campaigns_select_workspace_members"
  on public.marketing_campaigns
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "marketing_campaigns_insert_workspace_members"
  on public.marketing_campaigns
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "marketing_campaigns_update_workspace_members"
  on public.marketing_campaigns
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );
