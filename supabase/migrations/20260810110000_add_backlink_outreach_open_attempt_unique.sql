begin;

create unique index backlink_outreach_attempts_one_open_per_outreach_unique
  on public.backlink_outreach_attempts (workspace_id, outreach_id)
  where status in ('requested', 'unknown');

comment on index public.backlink_outreach_attempts_one_open_per_outreach_unique is
  'At most one unresolved send attempt may exist for an Outreach; failed and accepted attempts remain append-only.';

commit;
