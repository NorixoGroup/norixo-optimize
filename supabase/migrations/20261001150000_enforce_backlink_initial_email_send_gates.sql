begin;

-- A2 (G03 + G04): authoritative, reservation-side gates for REAL initial email sends.
--
-- Enforced where the Attempt row is inserted, inside the reservation transaction, so no
-- caller (UI, API, direct RPC) can avoid it:
--   * the workspace automation control row must exist (fail closed when absent);
--   * backlinks_enabled must be explicitly true;
--   * dry_run_only must be explicitly false;
--   * the campaign must be 'active';
--   * the campaign must have live_initial_send_enabled = true.
--
-- backlink_outreach_schedule_apply_enabled is intentionally NOT checked here: its
-- column comment defines it as the capability gate for automated scheduling apply, not
-- a send gate. Manual sends remain valid without it; the automated send paths keep
-- their own application-level requirement for it.
--
-- Follow-up sends are not changed: mark_backlink_outreach_follow_up_attempt_requested
-- already requires the workspace controls and an active campaign. Only INSERTs of
-- initial email Attempts are gated, so no follow-up lifecycle behaviour is redefined.
--
-- Row locks (FOR SHARE) keep the checked state stable until the reservation commits.

create or replace function public.backlink_enforce_initial_email_send_gates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  control public.automation_workspace_controls;
  campaign public.backlink_campaigns;
begin
  if new.channel <> 'email' or new.attempt_kind <> 'initial' or new.status <> 'requested' then
    return new;
  end if;

  select * into control
  from public.automation_workspace_controls as workspace_control
  where workspace_control.workspace_id = new.workspace_id
  for share;
  if not found then
    raise exception 'BACKLINK_SEND_WORKSPACE_CONTROL_MISSING';
  end if;
  if control.backlinks_enabled is not true then
    raise exception 'BACKLINK_SEND_BACKLINKS_DISABLED';
  end if;
  if control.dry_run_only is not false then
    raise exception 'BACKLINK_SEND_DRY_RUN';
  end if;

  select backlink_campaign.* into campaign
  from public.backlink_outreach as outreach
  join public.backlink_campaigns as backlink_campaign
    on backlink_campaign.id = outreach.campaign_id
   and backlink_campaign.workspace_id = outreach.workspace_id
  where outreach.id = new.outreach_id
    and outreach.workspace_id = new.workspace_id
  for share of backlink_campaign;
  if not found then
    raise exception 'BACKLINK_SEND_CAMPAIGN_MISSING';
  end if;
  if campaign.status <> 'active' then
    raise exception 'BACKLINK_SEND_CAMPAIGN_NOT_ACTIVE';
  end if;
  if campaign.live_initial_send_enabled is not true then
    raise exception 'BACKLINK_SEND_CAMPAIGN_LIVE_DISABLED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backlink_outreach_attempts_enforce_initial_email_send_gates
  on public.backlink_outreach_attempts;
create trigger trg_backlink_outreach_attempts_enforce_initial_email_send_gates
before insert on public.backlink_outreach_attempts
for each row execute function public.backlink_enforce_initial_email_send_gates();

comment on function public.backlink_enforce_initial_email_send_gates() is
  'Fail-closed reservation gate for initial email Attempts: workspace control present, backlinks enabled, not dry-run, campaign active and live_initial_send_enabled.';

commit;
