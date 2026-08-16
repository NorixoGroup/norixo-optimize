begin;

alter table public.automation_workspace_controls
  drop constraint if exists automation_workspace_controls_dry_run_only_check;

commit;
