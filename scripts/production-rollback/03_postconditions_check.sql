-- Production rollback for supabase/migrations/20261115120000_fix_free_plan_audit_entitlement.sql
-- Step 3/3: POSTCONDITIONS CHECK -- read-only, run immediately after step 2.
--
-- IMPORTANT LIMITATION (see this directory's limitations note): none of
-- these checks call reserve_/finalize_/release_audit_entitlement for
-- real. Doing so would create a real reservation (and, if finalized, a
-- real audit) -- forbidden by this mission. Every check below is
-- catalog/metadata-based or a passive count against existing rows,
-- never a live function call.
--
-- Functions are identified by exact schema-qualified signature via
-- ::regprocedure, matching 01_preconditions_check.sql, never by bare
-- name.

-- A. Exact content-hash classification, same as 01's section A. Must
-- show reserve_ = ALREADY_ROLLED_BACK, and finalize_/release_ = FIXED,
-- for every row.
select
  'reserve_audit_entitlement' as function_name,
  md5(pg_get_functiondef(oid)) as current_hash,
  case md5(pg_get_functiondef(oid))
    when '5a5425ad46f0f8b8d2bcfd9f44858433' then 'ORIGINAL (unexpected here -- rollback did not apply)'
    when '55a3852265b0b65ebd18793aa5ba37f2' then 'FIXED_WITH_FREE_PLAN (unexpected here -- rollback did not apply)'
    when 'e3d2b891289cc19167bc70e502d8317b' then 'ALREADY_ROLLED_BACK (expected)'
    else 'UNEXPECTED -- investigate immediately'
  end as state
from pg_proc
where oid = 'public.reserve_audit_entitlement(uuid,uuid,text,text,text,integer,boolean,boolean)'::regprocedure
union all
select
  'finalize_audit_entitlement',
  md5(pg_get_functiondef(oid)),
  case md5(pg_get_functiondef(oid))
    when '02bdf99633e37d13a24625b99f41e5ce' then 'ORIGINAL (unexpected here -- rollback did not re-assert it)'
    when 'b11f6e4e15d7c5af5f2d139323badf1a' then 'FIXED (expected)'
    else 'UNEXPECTED -- investigate immediately'
  end
from pg_proc
where oid = 'public.finalize_audit_entitlement(uuid,text,uuid,uuid,uuid,text,text)'::regprocedure
union all
select
  'release_audit_entitlement',
  md5(pg_get_functiondef(oid)),
  case md5(pg_get_functiondef(oid))
    when '5652282072cf9211bc995a19d145c9db' then 'ORIGINAL (unexpected here -- rollback did not re-assert it)'
    when 'a93023fe0945933cfe3d8f9210ea885c' then 'FIXED (expected)'
    else 'UNEXPECTED -- investigate immediately'
  end
from pg_proc
where oid = 'public.release_audit_entitlement(uuid,text,text)'::regprocedure;

-- B. Permissions/security posture -- must be IDENTICAL to the baseline
-- captured in 01_preconditions_check.sql section C. PUBLIC is checked
-- via the raw ACL (aclexplode), matching 01 -- see that file's comment
-- for why this form is used instead of has_function_privilege('public', ...).
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
    where a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) as public_can_exec
from targets t
join pg_proc p on p.oid = t.oid
order by t.proname;

-- C. No business data was touched -- these counts must be IDENTICAL to
-- 01_preconditions_check.sql section B, down to the exact numbers.
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

-- D. The source check constraint must still list 'free_plan' as allowed
-- (this rollback never removes it -- a missing value here would mean
-- something else touched the constraint, not this script).
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.audit_entitlement_reservations'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%source%';
