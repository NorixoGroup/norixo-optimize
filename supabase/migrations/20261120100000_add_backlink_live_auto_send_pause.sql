begin;

alter table public.automation_workspace_controls
  add column if not exists backlink_live_auto_send_paused_at timestamptz,
  add column if not exists backlink_live_auto_send_pause_reason text;

alter table public.automation_workspace_controls
  add constraint automation_workspace_controls_backlink_live_auto_send_pause_reason_check
  check (
    (backlink_live_auto_send_paused_at is null and backlink_live_auto_send_pause_reason is null)
    or (
      backlink_live_auto_send_paused_at is not null
      and backlink_live_auto_send_pause_reason is not null
      and backlink_live_auto_send_pause_reason in ('failed', 'unknown')
    )
  );

comment on column public.automation_workspace_controls.backlink_live_auto_send_paused_at is
  'Dedicated fail-closed pause for the LIVE auto-send batch only; does not alter disabled_reason or other Backlinks automations.';

create table public.backlink_live_auto_send_cycle_reservations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cycle_id text not null,
  outreach_id uuid not null references public.backlink_outreach(id) on delete restrict,
  reserved_at timestamptz not null,
  primary key (workspace_id, cycle_id),
  constraint backlink_live_auto_send_cycle_reservations_cycle_id_check
    check (cycle_id = trim(cycle_id) and char_length(cycle_id) between 1 and 64)
);

alter table public.backlink_live_auto_send_cycle_reservations enable row level security;
revoke all on table public.backlink_live_auto_send_cycle_reservations from public, anon, authenticated;
grant select, insert, delete on table public.backlink_live_auto_send_cycle_reservations to service_role;

comment on table public.backlink_live_auto_send_cycle_reservations is
  'Durable per-workspace daily LIVE auto-send cycle reservation. Its primary key is the authority that prevents a retry from selecting another outreach in the same cycle.';

commit;
