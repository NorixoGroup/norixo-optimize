-- Production rollback for supabase/migrations/20261115120000_fix_free_plan_audit_entitlement.sql
-- Step 1/3: PRECONDITIONS CHECK -- read-only, no writes, safe to run at any time.
--
-- Run this FIRST, by hand, against Production, and read every row before
-- deciding whether 02_rollback_free_plan_audit_entitlement.sql applies at
-- all. This script makes no decision and takes no action; a human reads
-- the output and decides. Section A reports the same three-way
-- classification (original / fixed / rolled-back / unexpected) that
-- 02's guard enforces, so there should be no surprise when running 02.
--
-- Functions are identified by exact schema-qualified signature via
-- ::regprocedure, never by bare name -- this resolves to exactly one
-- function or fails loudly if the signature does not match what is
-- expected, instead of silently matching an unrelated or overloaded
-- function that happens to share the name.

-- A. Exact state classification of each function, by content hash
-- (md5 of pg_get_functiondef), not by loose text pattern matching.
-- Expected hashes, computed locally from the three real migration files
-- (supabase/migrations/20260714110000_... and .../20261115120000_...)
-- plus scripts/production-rollback/02_...sql's own rollback body:
--   reserve_audit_entitlement:
--     original (2026-07-14, ambiguity bug, no free_plan) = 5a5425ad46f0f8b8d2bcfd9f44858433
--     fixed + free_plan (20261115120000, live)            = 55a3852265b0b65ebd18793aa5ba37f2
--     rolled back (fixed, no free_plan)                   = e3d2b891289cc19167bc70e502d8317b
--   finalize_audit_entitlement:
--     original (ambiguity bug)                            = 02bdf99633e37d13a24625b99f41e5ce
--     fixed (unchanged by rollback)                        = b11f6e4e15d7c5af5f2d139323badf1a
--   release_audit_entitlement:
--     original (ambiguity bug)                            = 5652282072cf9211bc995a19d145c9db
--     fixed (unchanged by rollback)                        = a93023fe0945933cfe3d8f9210ea885c
select
  'reserve_audit_entitlement' as function_name,
  md5(pg_get_functiondef(oid)) as current_hash,
  case md5(pg_get_functiondef(oid))
    when '5a5425ad46f0f8b8d2bcfd9f44858433' then 'ORIGINAL (2026-07-14, nothing to roll back)'
    when '55a3852265b0b65ebd18793aa5ba37f2' then 'FIXED_WITH_FREE_PLAN (expected precondition for step 2)'
    when 'e3d2b891289cc19167bc70e502d8317b' then 'ALREADY_ROLLED_BACK (step 2 would be a safe no-op)'
    else 'UNEXPECTED -- does not match any known state, investigate before running step 2'
  end as state
from pg_proc
where oid = 'public.reserve_audit_entitlement(uuid,uuid,text,text,text,integer,boolean,boolean)'::regprocedure
union all
select
  'finalize_audit_entitlement',
  md5(pg_get_functiondef(oid)),
  case md5(pg_get_functiondef(oid))
    when '02bdf99633e37d13a24625b99f41e5ce' then 'ORIGINAL (ambiguity bug still present -- partial-apply state)'
    when 'b11f6e4e15d7c5af5f2d139323badf1a' then 'FIXED (expected)'
    else 'UNEXPECTED -- does not match any known state, investigate before running step 2'
  end
from pg_proc
where oid = 'public.finalize_audit_entitlement(uuid,text,uuid,uuid,uuid,text,text)'::regprocedure
union all
select
  'release_audit_entitlement',
  md5(pg_get_functiondef(oid)),
  case md5(pg_get_functiondef(oid))
    when '5652282072cf9211bc995a19d145c9db' then 'ORIGINAL (ambiguity bug still present -- partial-apply state)'
    when 'a93023fe0945933cfe3d8f9210ea885c' then 'FIXED (expected)'
    else 'UNEXPECTED -- does not match any known state, investigate before running step 2'
  end
from pg_proc
where oid = 'public.release_audit_entitlement(uuid,text,text)'::regprocedure;

-- A bis. The constraint side of the same classification -- if this is
-- empty while reserve_ above is FIXED_WITH_FREE_PLAN or
-- ALREADY_ROLLED_BACK, that is itself a partial/unexpected state (the
-- constraint should have been widened in the same migration that
-- produces those function bodies) and must be investigated before
-- running step 2.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.audit_entitlement_reservations'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%source%';

-- B. Blast radius: how much live data would be FROZEN (not deleted) by
-- the rollback -- i.e. existing free_plan reservations/audits that must
-- keep working exactly as they are now.
select
  count(*) filter (where status = 'reserved')  as free_plan_reserved_in_flight,
  count(*) filter (where status = 'consumed')  as free_plan_finalized,
  count(*) filter (where status = 'released')  as free_plan_released,
  count(*)                                      as free_plan_total
from public.audit_entitlement_reservations
where source = 'free_plan';

select count(*) as audits_linked_to_a_free_plan_reservation
from public.audits a
join public.audit_entitlement_reservations aer on aer.id = a.entitlement_reservation_id
where aer.source = 'free_plan';

-- C. Baseline permissions/security posture to compare against AFTER the
-- rollback (step 3 must show the exact same result). Functions
-- identified by exact signature, not bare name. PUBLIC is checked via
-- the raw ACL (aclexplode), not has_function_privilege('public', ...):
-- both were verified empirically to agree on this Postgres version (see
-- the mission notes), but the raw-ACL form does not rely on knowing
-- that 'public' is accepted as a special-cased pseudo-role name by
-- has_function_privilege -- it is self-evidently correct from the ACL
-- array alone, which is the more directly auditable property to assert
-- here.
with targets (proname, oid) as (
  values
    ('reserve_audit_entitlement', 'public.reserve_audit_entitlement(uuid,uuid,text,text,text,integer,boolean,boolean)'::regprocedure),
    ('finalize_audit_entitlement', 'public.finalize_audit_entitlement(uuid,text,uuid,uuid,uuid,text,text)'::regprocedure),
    ('release_audit_entitlement', 'public.release_audit_entitlement(uuid,text,text)'::regprocedure)
)
select
  t.proname,
  p.prosecdef as security_definer,
  has_function_privilege('service_role', t.oid, 'execute')       as service_role_can_exec,
  has_function_privilege('anon', t.oid, 'execute')                as anon_can_exec,
  has_function_privilege('authenticated', t.oid, 'execute')       as authenticated_can_exec,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0              -- grantee = 0 means PUBLIC in a Postgres ACL array
      and a.privilege_type = 'EXECUTE'
  ) as public_can_exec
from targets t
join pg_proc p on p.oid = t.oid
order by t.proname;

-- D. Business-state context, NOT a locking signal: how many reservations
-- (any source) are currently sitting in 'reserved' status, i.e. created
-- but not yet finalized or released. This says nothing about whether
-- anyone is mid-call right now -- a row can stay 'reserved' for a long
-- time with no lock held at all, since the `for update` lock inside
-- reserve_/finalize_/release_audit_entitlement is only held for the
-- duration of that one function call, not for as long as the row's
-- status remains 'reserved'.
select count(*) as reservations_currently_in_flight_business_state_only
from public.audit_entitlement_reservations
where status = 'reserved';

-- D bis. The actually relevant signal for step 2's locking behaviour:
-- CREATE OR REPLACE FUNCTION takes a lock on the function object itself
-- and will wait only if another session is CURRENTLY executing inside
-- that exact function when step 2 runs (typically sub-second, since
-- these functions return quickly). This is a best-effort check against
-- pg_stat_activity's query text, not a guarantee (a call issued through
-- a prepared statement with a generic name would not be caught by a
-- text match) -- it exists to catch the common case, not as a formal
-- proof of absence of contention.
select pid, state, query_start, left(query, 160) as query_snippet
from pg_stat_activity
where (
    query ilike '%reserve_audit_entitlement%'
    or query ilike '%finalize_audit_entitlement%'
    or query ilike '%release_audit_entitlement%'
  )
  and pid <> pg_backend_pid();
