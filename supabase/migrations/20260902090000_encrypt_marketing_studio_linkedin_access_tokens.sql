begin;

alter table public.marketing_studio_linkedin_connections
  add column access_token_ciphertext text,
  add column access_token_iv text,
  add column access_token_auth_tag text,
  add column access_token_key_version text;

-- Scoped plaintext credentials must not remain usable after the encrypted-only
-- application rollout. Legacy global rows remain untouched and are not selected.
update public.marketing_studio_linkedin_connections
set
  status = 'error',
  access_token = null,
  access_token_ciphertext = null,
  access_token_iv = null,
  access_token_auth_tag = null,
  access_token_key_version = null,
  updated_at = now()
where workspace_id is not null
  and access_token is not null;

alter table public.marketing_studio_linkedin_connections
  add constraint marketing_studio_linkedin_connections_scoped_encrypted_credential_check
  check (
    workspace_id is null
    or (
      access_token is null
      and (
        (access_token_ciphertext is null and access_token_iv is null and access_token_auth_tag is null and access_token_key_version is null)
        or
        (access_token_ciphertext is not null and access_token_iv is not null and access_token_auth_tag is not null and access_token_key_version is not null)
      )
    )
  );

commit;
