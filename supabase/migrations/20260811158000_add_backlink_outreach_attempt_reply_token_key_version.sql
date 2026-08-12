begin;

alter table public.backlink_outreach_attempts
  add column reply_token_key_version text;

comment on column public.backlink_outreach_attempts.reply_token_key_version is
  'Version of the server-side HMAC key used to deterministically reconstruct the Reply-To UUID. Null denotes a legacy non-reconstructible identity.';

commit;
