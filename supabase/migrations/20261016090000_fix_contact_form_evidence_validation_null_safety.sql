
-- backlink_contact_form_verification_evidence_valid(jsonb) returned NULL, not false, when a required
-- key was missing or JSON null: `NULL = 'true'` is NULL and `NULL AND ...` stays NULL. Its callers use
-- `not valid(...)` (PL/pgSQL IF: NULL means "no error") and a CHECK constraint (NULL means "pass"), so
-- incomplete evidence was accepted as verified.
--
-- This replaces the body only. CREATE OR REPLACE keeps the oid, owner, ACL, comment and every dependent
-- (CHECK constraint, triggers, has_current_backlink_contact_form_verification). Signature, volatility,
-- SECURITY INVOKER and search_path are unchanged. The function now always returns true or false:
--   true  only for a complete, entirely valid evidence object;
--   false for absent, incomplete, JSON-null, non-object, oversized or otherwise invalid evidence.
-- Accepted evidence is exactly what was accepted before. The form_count guard is additionally
-- bounded to 18 digits and compared as bigint so that an absurdly long number returns false instead of
-- raising an integer-overflow error.
--
-- Existing rows are not rewritten. A verified row that holds incomplete evidence was already ignored by
-- has_current_backlink_contact_form_verification; after this migration any later UPDATE of such a row
-- is refused by the CHECK constraint and trigger until its evidence is corrected.

create or replace function public.backlink_contact_form_verification_evidence_valid(p_safe_evidence jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = public
as $$
  select coalesce(
    case
      when p_safe_evidence is null then false
      when jsonb_typeof(p_safe_evidence) <> 'object' then false
      when length(p_safe_evidence::text) > 8192 then false
      when coalesce(p_safe_evidence->>'form_count', '') !~ '^[0-9]{1,18}$' then false
      else
        coalesce(p_safe_evidence->>'actual_form_observed' = 'true', false)
        and (p_safe_evidence->>'form_count')::bigint >= 1
        and coalesce(p_safe_evidence->>'message_field_present' = 'true', false)
        and coalesce(p_safe_evidence->>'submit_control_present' = 'true', false)
        and coalesce(p_safe_evidence->>'contact_intent' = 'true', false)
        and coalesce(p_safe_evidence->>'newsletter_only' = 'false', false)
        and coalesce(p_safe_evidence->>'login_only' = 'false', false)
        and coalesce(p_safe_evidence->>'support_only' = 'false', false)
        and coalesce(p_safe_evidence->>'sales_demo_only' = 'false', false)
    end,
    false
  )
$$;
