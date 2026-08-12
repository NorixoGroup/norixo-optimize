begin;

alter table public.backlink_outreach
  add column if not exists response_deadline_at timestamptz;

comment on column public.backlink_outreach.response_deadline_at is
  'Final response window deadline after the last accepted attempt. NULL means no final response deadline is currently scheduled.';

commit;
