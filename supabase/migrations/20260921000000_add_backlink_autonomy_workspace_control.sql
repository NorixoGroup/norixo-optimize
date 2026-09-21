-- G1Y: a separate fail-closed capability. Existing controls remain disabled.
alter table public.automation_workspace_controls
  add column if not exists backlink_autonomy_enabled boolean not null default false;

comment on column public.automation_workspace_controls.backlink_autonomy_enabled is
  'Fail-closed workspace authorization for the closed Backlinks autonomy runtime; does not authorize campaign apply or live outbound execution.';
