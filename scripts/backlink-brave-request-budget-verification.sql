-- Manual verification for migrations 20261012120000_add_backlink_brave_request_budget.sql and
-- 20261020120000_increase_backlink_brave_request_budget_to_100.sql.
--
-- NOT executed by the repository's test suite and NOT run as part of writing it.
--
-- Run it ONLY against an isolated, local, disposable PostgreSQL database that:
--   * has both migrations applied in chronological order,
--   * has the Supabase roles anon, authenticated and service_role,
--   * had the migration applied by a NON-superuser owner (part 1 refuses a superuser or
--     RLS-bypassing owner of the reservation function),
--   * is reached over a unix socket or loopback (127.0.0.1 / ::1). A Docker-hosted local database
--     (for example `supabase start`) reports the container address instead; for that case only, also
--     set brave_budget_verify.allow_non_loopback=yes, which you may do only for a database you created,
--   * is connected as its owner / superuser (the script uses SET ROLE and fixture updates).
--
-- Never run it against staging or production. Two guards refuse to run otherwise:
--   1. the session setting brave_budget_verify.disposable must be 'yes' (set deliberately below);
--   2. the connection must be local (unix socket or loopback), unless allow_non_loopback is 'yes'.
-- Part 1 never deletes pre-existing data: it aborts if the ledger is not empty, and rolls back.
-- Part 2 truncates the ledger, which is why both guards exist.
--
--   export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'   # disposable DB only
--   export PGOPTIONS='-c brave_budget_verify.disposable=yes'
--     # Docker-hosted local DB only:  -c brave_budget_verify.allow_non_loopback=yes  (append to PGOPTIONS)
--
-- PART 1 - single session (cap, rolling window, replay, privileges, isolation). Rolled back.
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/backlink-brave-request-budget-verification.sql
--
-- PART 2 - concurrency (real parallel sessions, committed transactions). Run after part 1.
--   The commands are the comment lines between the COMMANDS marker below and the first SQL statement,
--   each prefixed with "--" plus three spaces. Extract, syntax-check, then run them:
--     sed -n '/^-- ---- PART 2 COMMANDS/,/^begin;/ s/^--   //p' scripts/backlink-brave-request-budget-verification.sql > /tmp/brave_budget_part2.sh
--     bash -n /tmp/brave_budget_part2.sh
--     bash /tmp/brave_budget_part2.sh
--   The extracted script stops at the first failure (set -e), re-checks the disposable-database guard before
--   every destructive step, and asserts the expected counts itself (it prints PASS/FAIL lines).
--
-- ---- PART 2 COMMANDS (do not edit the "--" + three-space prefix) ----
--   set -euo pipefail
--   : "${LOCAL_DB_URL:?set LOCAL_DB_URL to a disposable local database}"
--
--   # Refuses unless the session is flagged disposable and local. Called before every destructive step.
--   guard() {
--     psql "$LOCAL_DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
--   do $$ begin
--     if coalesce(current_setting('brave_budget_verify.disposable', true), '') <> 'yes' then
--       raise exception 'Refusing: set PGOPTIONS=-c brave_budget_verify.disposable=yes on a disposable DB';
--     end if;
--     if inet_server_addr() is not null
--        and coalesce(current_setting('brave_budget_verify.allow_non_loopback', true), '') <> 'yes'
--        and not (inet_server_addr() <<= '127.0.0.0/8'::inet or inet_server_addr() = '::1'::inet) then
--       raise exception 'Refusing: connection is not local';
--     end if;
--   end $$;
--   SQL
--   }
--
--   # expect "<sql returning one value>" "<expected>" "<label>"
--   expect() {
--     local got
--     got="$(psql "$LOCAL_DB_URL" -At -v ON_ERROR_STOP=1 -c "$1")"
--     if [ "$got" != "$2" ]; then echo "FAIL: $3: expected '$2', got '$got'"; exit 1; fi
--     echo "PASS: $3"
--   }
--
--   # 2.0 reset the ledger and create a scratch outcomes table
--   guard
--   psql "$LOCAL_DB_URL" -q -v ON_ERROR_STOP=1 -c "truncate public.backlink_brave_request_reservations; drop table if exists public.brave_budget_verify_outcomes; create table public.brave_budget_verify_outcomes (outcome text not null)"
--
--   # 2.1 cap under concurrency: 20 sessions x 10 transactions = 200 distinct keys
--   cat > /tmp/brave_budget_cap.sql <<'SQL'
--   insert into public.brave_budget_verify_outcomes
--   select reservation_outcome from public.reserve_backlink_brave_request(
--     '00000000-0000-0000-0000-0000000000aa'::uuid, null, 'cap:' || gen_random_uuid()::text);
--   SQL
--   pgbench "$LOCAL_DB_URL" -n -c 20 -j 4 -t 10 -f /tmp/brave_budget_cap.sql
--   expect "select count(*) filter (where outcome = 'reserved') || '/' || count(*) filter (where outcome = 'limit_reached') from public.brave_budget_verify_outcomes" "100/100" "cap: 100 reserved, 100 refused"
--   expect "select count(*) from public.backlink_brave_request_reservations" "100" "cap: ledger holds exactly 100 rows"
--
--   # 2.2 the same key raced by 20 sessions x 5 transactions: exactly one may be reserved
--   guard
--   psql "$LOCAL_DB_URL" -q -v ON_ERROR_STOP=1 -c "truncate public.backlink_brave_request_reservations; truncate public.brave_budget_verify_outcomes"
--   cat > /tmp/brave_budget_same_key.sql <<'SQL'
--   insert into public.brave_budget_verify_outcomes
--   select reservation_outcome from public.reserve_backlink_brave_request(
--     '00000000-0000-0000-0000-0000000000bb'::uuid, null, 'race:same-key');
--   SQL
--   pgbench "$LOCAL_DB_URL" -n -c 20 -j 4 -t 5 -f /tmp/brave_budget_same_key.sql
--   expect "select count(*) filter (where outcome = 'reserved') || '/' || count(*) filter (where outcome = 'replayed') from public.brave_budget_verify_outcomes" "1/99" "same key: one reserved, 99 replayed"
--   expect "select count(*) from public.backlink_brave_request_reservations" "1" "same key: ledger holds exactly 1 row"
--
--   # 2.3 cleanup
--   guard
--   psql "$LOCAL_DB_URL" -q -v ON_ERROR_STOP=1 -c "drop table public.brave_budget_verify_outcomes; truncate public.backlink_brave_request_reservations"
--   echo "PART 2 COMPLETE"

begin;

-- Guards and preconditions ----------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  if coalesce(current_setting('brave_budget_verify.disposable', true), '') <> 'yes' then
    raise exception 'Refusing: set PGOPTIONS=-c brave_budget_verify.disposable=yes and run only on a disposable local DB';
  end if;
  if inet_server_addr() is not null
     and coalesce(current_setting('brave_budget_verify.allow_non_loopback', true), '') <> 'yes'
     and not (inet_server_addr() <<= '127.0.0.0/8'::inet or inet_server_addr() = '::1'::inet) then
    raise exception 'Refusing: connection is not local (%)', inet_server_addr();
  end if;

  select string_agg(role_name, ', ')
    into v_missing
  from unnest(array['anon', 'authenticated', 'service_role']) as role_name
  where not exists (select 1 from pg_roles where rolname = role_name);
  if v_missing is not null then
    raise exception 'Missing Supabase roles: %', v_missing;
  end if;

  if to_regclass('public.backlink_brave_request_reservations') is null
     or to_regprocedure('public.reserve_backlink_brave_request(uuid, uuid, text)') is null then
    raise exception 'Brave request budget migrations are not applied in this database';
  end if;

  -- Empty-ledger precondition: old rows inside the 30-day window would change every count below.
  if exists (select 1 from public.backlink_brave_request_reservations) then
    raise exception 'Ledger is not empty; use a fresh disposable database (part 1 never deletes data)';
  end if;

  raise notice 'PASS: guards and preconditions.';
end;
$$;

-- Privileges: catalog view -----------------------------------------------------------------------
do $$
declare
  v_role text;
  v_privilege text;
  -- Every table privilege that is not SELECT. MAINTAIN only exists from PostgreSQL 17.
  v_non_select text[] := array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  v_acl text;
begin
  if current_setting('server_version_num')::integer >= 170000 then
    v_non_select := array_append(v_non_select, 'MAINTAIN');
  end if;

  -- Ownership: the SECURITY DEFINER function and the ledger share one non-superuser owner.
  if exists (
    select 1
    from pg_proc as p
    join pg_class as c on c.oid = 'public.backlink_brave_request_reservations'::regclass
    where p.oid = 'public.reserve_backlink_brave_request(uuid, uuid, text)'::regprocedure
      and p.proowner <> c.relowner
  ) then
    raise exception 'the reservation function and the ledger must have the same owner';
  end if;
  if exists (
    select 1
    from pg_proc as p
    join pg_roles as o on o.oid = p.proowner
    where p.oid = 'public.reserve_backlink_brave_request(uuid, uuid, text)'::regprocedure
      and (o.rolsuper or o.rolbypassrls)
  ) then
    raise exception 'the reservation function owner must not be a superuser nor bypass RLS';
  end if;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_privilege in array array['SELECT'] || v_non_select loop
      if has_table_privilege(v_role, 'public.backlink_brave_request_reservations', v_privilege) then
        raise exception '% must not have % on the ledger', v_role, v_privilege;
      end if;
    end loop;
    foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
      if has_any_column_privilege(v_role, 'public.backlink_brave_request_reservations', v_privilege) then
        raise exception '% must not have column-level % on the ledger', v_role, v_privilege;
      end if;
    end loop;
    if has_function_privilege(v_role, 'public.reserve_backlink_brave_request(uuid, uuid, text)', 'EXECUTE') then
      raise exception '% must not execute the reservation function', v_role;
    end if;
  end loop;

  -- service_role: may read, holds no other direct privilege, may execute the function.
  foreach v_privilege in array v_non_select loop
    if has_table_privilege('service_role', 'public.backlink_brave_request_reservations', v_privilege) then
      raise exception 'service_role must not have % on the ledger', v_privilege;
    end if;
  end loop;
  foreach v_privilege in array array['INSERT', 'UPDATE', 'REFERENCES'] loop
    if has_any_column_privilege('service_role', 'public.backlink_brave_request_reservations', v_privilege) then
      raise exception 'service_role must not have column-level % on the ledger', v_privilege;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.reserve_backlink_brave_request(uuid, uuid, text)', 'EXECUTE') then
    raise exception 'service_role must be able to execute the reservation function';
  end if;
  if not has_table_privilege('service_role', 'public.backlink_brave_request_reservations', 'SELECT') then
    raise exception 'service_role should keep SELECT for audit';
  end if;

  -- The stored ACL itself: service_role's direct grant is exactly SELECT.
  select string_agg(a.privilege_type, ',' order by a.privilege_type)
    into v_acl
  from pg_class as c
  cross join lateral aclexplode(c.relacl) as a
  join pg_roles as r on r.oid = a.grantee
  where c.oid = 'public.backlink_brave_request_reservations'::regclass
    and r.rolname = 'service_role';
  if v_acl is distinct from 'SELECT' then
    raise exception 'service_role direct ACL on the ledger must be exactly SELECT, found %', coalesce(v_acl, '<none>');
  end if;
  raise notice 'PASS: catalog privileges and ownership.';
end;
$$;

-- Privileges: behavioural view (SET ROLE) ----------------------------------------------------------
set local role service_role;
do $$
declare
  r record;
begin
  -- Direct writes are refused ...
  begin
    insert into public.backlink_brave_request_reservations (workspace_id, request_key)
    values ('00000000-0000-0000-0000-0000000000f1', 'direct:insert');
    raise exception 'service_role direct INSERT was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.backlink_brave_request_reservations;
    raise exception 'service_role direct DELETE was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.backlink_brave_request_reservations set reserved_at = now();
    raise exception 'service_role direct UPDATE was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.backlink_brave_request_reservations;
    raise exception 'service_role TRUNCATE was accepted';
  exception when insufficient_privilege then null;
  end;

  -- ... but the SECURITY DEFINER function can still insert using its owner's privileges.
  select * into r from public.reserve_backlink_brave_request('00000000-0000-0000-0000-0000000000f1', null, 'role:service');
  if r.reservation_outcome <> 'reserved' then
    raise exception 'service_role reservation via RPC failed: %', r.reservation_outcome;
  end if;
  raise notice 'PASS: service_role can reserve via RPC but cannot write the ledger directly.';
end;
$$;
reset role;

set local role authenticated;
do $$
begin
  begin
    perform 1 from public.backlink_brave_request_reservations;
    raise exception 'authenticated could read the ledger';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.reserve_backlink_brave_request('00000000-0000-0000-0000-0000000000f2', null, 'role:auth');
    raise exception 'authenticated could execute the reservation function';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: authenticated has no access.';
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform * from public.reserve_backlink_brave_request('00000000-0000-0000-0000-0000000000f3', null, 'role:anon');
    raise exception 'anon could execute the reservation function';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: anon has no access.';
end;
$$;
reset role;

-- Cap, global scope, replay, key validation, rolling window ----------------------------------------
do $$
declare
  c_ws1 constant uuid := '00000000-0000-0000-0000-0000000000a1';
  c_ws2 constant uuid := '00000000-0000-0000-0000-0000000000a2';
  r record;
  v_count integer;
begin
  -- One reservation already exists from the role test above ('role:service', workspace f1).
  select count(*) into v_count from public.backlink_brave_request_reservations;
  if v_count <> 1 then raise exception 'expected 1 fixture row, found %', v_count; end if;

  -- 99 more succeed across two workspaces: the budget is global, not per workspace.
  for i in 1..99 loop
    select * into r from public.reserve_backlink_brave_request(case when i % 2 = 0 then c_ws1 else c_ws2 end, null, 'verify:' || i);
    if r.reservation_outcome <> 'reserved' then raise exception 'expected reserved at %, got %', i, r.reservation_outcome; end if;
  end loop;
  if r.window_used <> 100 then raise exception 'expected window_used 100 on the 100th reservation, got %', r.window_used; end if;

  -- The 101st and 102nd are refused, from either workspace, and add no row.
  select * into r from public.reserve_backlink_brave_request(c_ws1, null, 'verify:101');
  if r.reservation_outcome <> 'limit_reached' or r.reservation_id is not null then raise exception 'expected limit_reached, got %', r.reservation_outcome; end if;
  select * into r from public.reserve_backlink_brave_request(c_ws2, null, 'verify:102');
  if r.reservation_outcome <> 'limit_reached' then raise exception 'expected limit_reached (other workspace), got %', r.reservation_outcome; end if;
  select count(*) into v_count from public.backlink_brave_request_reservations;
  if v_count <> 100 then raise exception 'ledger must hold exactly 100 rows, found %', v_count; end if;

  -- An idempotent replay is 'replayed' (never 'reserved'), even when the budget is full, and adds no row.
  select * into r from public.reserve_backlink_brave_request(c_ws2, null, 'verify:1');
  if r.reservation_outcome <> 'replayed' or r.reservation_id is null then raise exception 'expected replayed, got %', r.reservation_outcome; end if;
  select count(*) into v_count from public.backlink_brave_request_reservations;
  if v_count <> 100 then raise exception 'replay must not add a row (found %)', v_count; end if;

  -- The same key in another workspace is a different reservation (and the budget is full).
  select * into r from public.reserve_backlink_brave_request(c_ws1, null, 'verify:1');
  if r.reservation_outcome <> 'limit_reached' then raise exception 'same key, other workspace: expected limit_reached, got %', r.reservation_outcome; end if;

  -- Invalid input is rejected with 22023 and writes nothing.
  begin
    perform * from public.reserve_backlink_brave_request(c_ws1, null, 'bad key with spaces');
    raise exception 'invalid key was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform * from public.reserve_backlink_brave_request(null, null, 'verify:null-workspace');
    raise exception 'null workspace was accepted';
  exception when sqlstate '22023' then null;
  end;

  -- Rolling window: reservations older than 30 days stop counting.
  update public.backlink_brave_request_reservations
     set reserved_at = clock_timestamp() - interval '31 days'
   where id in (select id from public.backlink_brave_request_reservations order by request_key limit 10);
  for i in 1..10 loop
    select * into r from public.reserve_backlink_brave_request(c_ws1, null, 'verify:after:' || i);
    if r.reservation_outcome <> 'reserved' then raise exception 'expected a freed slot at %, got %', i, r.reservation_outcome; end if;
  end loop;
  select * into r from public.reserve_backlink_brave_request(c_ws1, null, 'verify:after:11');
  if r.reservation_outcome <> 'limit_reached' then raise exception 'expected limit_reached after refill, got %', r.reservation_outcome; end if;

  -- Expired rows leave the window entirely: age everything, the full budget returns.
  update public.backlink_brave_request_reservations set reserved_at = clock_timestamp() - interval '31 days';
  select * into r from public.reserve_backlink_brave_request(c_ws2, null, 'verify:fresh');
  if r.reservation_outcome <> 'reserved' or r.window_used <> 1 then raise exception 'expected a fresh window, got % / %', r.reservation_outcome, r.window_used; end if;

  raise notice 'PASS: cap, global scope, replay, validation and rolling-window expiry verified.';
end;
$$;

rollback;

-- Isolation-level guard (each in its own transaction; nothing is written) -----------------------------
begin transaction isolation level repeatable read;
do $$
begin
  begin
    perform * from public.reserve_backlink_brave_request('00000000-0000-0000-0000-0000000000c1', null, 'iso:repeatable-read');
    raise exception 'REPEATABLE READ was accepted';
  exception when sqlstate '55000' then null;
  end;
  raise notice 'PASS: REPEATABLE READ is refused.';
end;
$$;
rollback;

begin transaction isolation level serializable;
do $$
begin
  begin
    perform * from public.reserve_backlink_brave_request('00000000-0000-0000-0000-0000000000c2', null, 'iso:serializable');
    raise exception 'SERIALIZABLE was accepted';
  exception when sqlstate '55000' then null;
  end;
  raise notice 'PASS: SERIALIZABLE is refused.';
end;
$$;
rollback;

-- Everything above ran inside rolled-back transactions; confirm nothing persisted.
do $$
begin
  if exists (select 1 from public.backlink_brave_request_reservations) then
    raise exception 'ledger must be empty after part 1';
  end if;
  raise notice 'PASS: part 1 left no data behind. Now run part 2 (concurrency) from the header.';
end;
$$;
