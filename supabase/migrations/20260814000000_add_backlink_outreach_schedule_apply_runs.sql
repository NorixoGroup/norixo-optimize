create table if not exists public.backlink_outreach_schedule_apply_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  workspace_scope jsonb not null default '[]'::jsonb,
  trigger_kind text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  workspaces_scanned integer not null,
  workspaces_applied integer not null,
  workspaces_failed integer not null,
  outreach_scanned integer not null,
  scheduled integer not null,
  existing integer not null,
  not_applicable integer not null,
  conflicts integer not null,
  failed integer not null,
  workspace_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_schedule_apply_runs_trigger_kind_check check (trigger_kind in ('manual_internal', 'cron')),
  constraint backlink_outreach_schedule_apply_runs_counts_check check (
    workspaces_scanned >= 0 and
    workspaces_applied >= 0 and
    workspaces_failed >= 0 and
    outreach_scanned >= 0 and
    scheduled >= 0 and
    existing >= 0 and
    not_applicable >= 0 and
    conflicts >= 0 and
    failed >= 0
  ),
  constraint backlink_outreach_schedule_apply_runs_scope_object_check check (jsonb_typeof(workspace_scope) = 'array'),
  constraint backlink_outreach_schedule_apply_runs_results_object_check check (jsonb_typeof(workspace_results) = 'array')
);

create index if not exists backlink_outreach_schedule_apply_runs_created_at_idx
  on public.backlink_outreach_schedule_apply_runs (created_at desc);

create index if not exists backlink_outreach_schedule_apply_runs_started_at_idx
  on public.backlink_outreach_schedule_apply_runs (started_at desc);

create index if not exists backlink_outreach_schedule_apply_runs_workspace_created_at_idx
  on public.backlink_outreach_schedule_apply_runs (workspace_id, created_at desc);

alter table public.backlink_outreach_schedule_apply_runs enable row level security;

comment on table public.backlink_outreach_schedule_apply_runs is
  'Operational audit for multi-workspace backlinks outreach schedule apply orchestration. It records when apply-all ran and the aggregated outcomes without using dry_run automation runs.';

comment on column public.backlink_outreach_schedule_apply_runs.workspace_scope is
  'JSON array of workspace ids included in the orchestration scope.';

comment on column public.backlink_outreach_schedule_apply_runs.workspace_results is
  'JSON array of per-workspace summaries, suitable for operational visibility without exposing PII.';
