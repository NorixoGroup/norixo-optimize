begin;

alter table public.backlink_outreach_delivery_events
  add column bounce_type text;

alter table public.backlink_outreach_delivery_events
  add constraint backlink_outreach_delivery_events_bounce_type_check
  check (
    (event_type = 'email.bounced' and bounce_type in ('permanent', 'transient', 'undetermined', 'unknown'))
    or (event_type = 'email.bounced' and bounce_type is null)
    or (event_type <> 'email.bounced' and bounce_type is null)
  );

comment on column public.backlink_outreach_delivery_events.bounce_type is
  'Canonical Resend bounce classification: permanent, transient, undetermined, or unknown. Historical and non-bounce events remain null.';

commit;
