begin;

create unique index backlink_attempts_one_accepted_initial_per_outreach_idx
  on public.backlink_outreach_attempts (outreach_id)
  where attempt_kind = 'initial'
    and status = 'accepted';

drop policy if exists "backlink_outreach_attempts_insert_workspace_admins"
  on public.backlink_outreach_attempts;

commit;
