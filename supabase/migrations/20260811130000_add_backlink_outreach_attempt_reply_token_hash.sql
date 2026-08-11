begin;

alter table public.backlink_outreach_attempts
  add column reply_token_hash text;

create unique index backlink_outreach_attempts_reply_token_hash_unique
  on public.backlink_outreach_attempts (reply_token_hash)
  where reply_token_hash is not null;

comment on column public.backlink_outreach_attempts.reply_token_hash is
  'SHA-256 hash of the opaque per-attempt Reply-To correlation token. The raw token is never persisted.';

commit;
