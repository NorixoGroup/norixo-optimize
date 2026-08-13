begin;

alter table public.automation_workspace_controls
  add column if not exists backlink_outreach_schedule_apply_enabled boolean not null default false;

comment on column public.automation_workspace_controls.backlink_outreach_schedule_apply_enabled is
  'Explicit capability gate for automated Outreach scheduling apply. Defaults to false and does not alter dry-run behavior.';

commit;
