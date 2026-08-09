begin;

alter table public.backlink_outreach
  add column if not exists subject text,
  add column if not exists body text;

comment on column public.backlink_outreach.subject is
  'Optional plain-text subject for a manually reviewed outreach draft.';

comment on column public.backlink_outreach.body is
  'Optional plain-text body for a manually reviewed outreach draft.';

commit;
