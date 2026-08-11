begin;

create table public.backlink_outreach_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  outreach_id uuid references public.backlink_outreach(id) on delete restrict,
  attempt_id uuid references public.backlink_outreach_attempts(id) on delete restrict,
  contact_id uuid references public.backlink_contacts(id) on delete restrict,
  provider text not null,
  provider_event_id text not null,
  inbound_message_id text not null,
  correlation_status text not null,
  correlation_method text,
  sender text not null,
  recipient text not null,
  subject text,
  text_body text,
  in_reply_to text,
  references_header text,
  received_at timestamptz not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_outreach_inbound_messages_provider_check check (provider = 'resend'),
  constraint backlink_outreach_inbound_messages_provider_event_id_check check (provider_event_id = trim(provider_event_id) and char_length(provider_event_id) > 0),
  constraint backlink_outreach_inbound_messages_inbound_message_id_check check (inbound_message_id = trim(inbound_message_id) and char_length(inbound_message_id) > 0),
  constraint backlink_outreach_inbound_messages_correlation_status_check check (correlation_status in ('correlated', 'unmatched', 'ambiguous', 'ignored')),
  constraint backlink_outreach_inbound_messages_correlation_method_check check (correlation_method is null or correlation_method in ('reply_token', 'rfc_headers')),
  constraint backlink_outreach_inbound_messages_correlation_shape_check check (
    (correlation_status = 'correlated' and workspace_id is not null and outreach_id is not null and attempt_id is not null and contact_id is not null and correlation_method is not null)
    or (correlation_status in ('unmatched', 'ambiguous', 'ignored') and workspace_id is null and outreach_id is null and attempt_id is null and contact_id is null and correlation_method is null)
  ),
  constraint backlink_outreach_inbound_messages_sender_check check (sender = trim(sender) and char_length(sender) > 0 and char_length(sender) <= 320),
  constraint backlink_outreach_inbound_messages_recipient_check check (recipient = trim(recipient) and char_length(recipient) > 0 and char_length(recipient) <= 320),
  constraint backlink_outreach_inbound_messages_subject_check check (subject is null or char_length(subject) <= 2048),
  constraint backlink_outreach_inbound_messages_text_body_check check (text_body is null or char_length(text_body) <= 65536),
  constraint backlink_outreach_inbound_messages_in_reply_to_check check (in_reply_to is null or char_length(in_reply_to) <= 998),
  constraint backlink_outreach_inbound_messages_references_header_check check (references_header is null or char_length(references_header) <= 8192),
  constraint backlink_outreach_inbound_messages_provider_event_unique unique (provider, provider_event_id)
);

create index backlink_outreach_inbound_messages_workspace_outreach_occurred_at_idx
  on public.backlink_outreach_inbound_messages (workspace_id, outreach_id, occurred_at desc)
  where workspace_id is not null;
create index backlink_outreach_inbound_messages_workspace_contact_occurred_at_idx
  on public.backlink_outreach_inbound_messages (workspace_id, contact_id, occurred_at desc)
  where workspace_id is not null;
create index backlink_outreach_inbound_messages_provider_message_idx
  on public.backlink_outreach_inbound_messages (provider, inbound_message_id);

create or replace function public.validate_backlink_outreach_inbound_message_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.correlation_status = 'correlated' and not exists (
    select 1 from public.backlink_outreach_attempts as attempt
    join public.backlink_outreach as outreach on outreach.id = attempt.outreach_id
    join public.backlink_contacts as contact on contact.id = outreach.contact_id
    where attempt.id = new.attempt_id and attempt.workspace_id = new.workspace_id and attempt.outreach_id = new.outreach_id
      and outreach.id = new.outreach_id and outreach.workspace_id = new.workspace_id and outreach.contact_id = new.contact_id
      and contact.id = new.contact_id and contact.workspace_id = new.workspace_id
  ) then
    raise exception 'BACKLINK_OUTREACH_INBOUND_MESSAGE_INTEGRITY_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_backlink_outreach_inbound_messages_integrity
before insert or update of workspace_id, outreach_id, attempt_id, contact_id, correlation_status, correlation_method
on public.backlink_outreach_inbound_messages for each row
execute function public.validate_backlink_outreach_inbound_message_integrity();

alter table public.backlink_outreach_inbound_messages enable row level security;
create policy "backlink_outreach_inbound_messages_select_correlated_workspace_members"
on public.backlink_outreach_inbound_messages for select to authenticated
using (correlation_status = 'correlated' and public.is_workspace_member(workspace_id));

comment on table public.backlink_outreach_inbound_messages is
  'Append-only authenticated Resend inbound email metadata and bounded plain text. HTML, attachments, and raw provider payloads are intentionally not persisted.';
comment on column public.backlink_outreach_inbound_messages.correlation_method is
  'Strong correlation method when correlated: reply_token or rfc_headers.';
comment on column public.backlink_outreach_inbound_messages.text_body is
  'Bounded normalized plain-text body for human review; raw MIME and HTML are not persisted.';

commit;
