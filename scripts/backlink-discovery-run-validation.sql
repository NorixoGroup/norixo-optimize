-- READ-ONLY export of one persisted discovery run, for scripts/backlink-discovery-output-check.ts.
--
-- NOT executed by the repository, NOT executed by the assistant. The operator runs it with a read-only
-- connection, saves the single JSON value it returns, and runs the offline checker on that file. The SQL
-- contains no INSERT / UPDATE / DELETE / DDL and runs inside a READ ONLY transaction.
--
--   psql "$READONLY_DB_URL" -At -v ON_ERROR_STOP=1 \
--        -v run_id='f08bded3-a57d-40dc-8d74-1bf9b0bc6f92' \
--        -f scripts/backlink-discovery-run-validation.sql > /tmp/discovery-export.json
--   npx tsx scripts/backlink-discovery-output-check.ts /tmp/discovery-export.json
--
-- Resume must NOT be authorized until the checker prints "RESULT: OK" and the task state below matches the
-- resume preconditions (run `running`; discovery `completed`; no dead_letter / cancelled task; qualification and
-- promotion `queued` with attempts left).

begin read only;

select jsonb_build_object(
  'run', (
    select jsonb_build_object('id', r.id, 'status', r.status, 'runKind', r.run_kind, 'mode', r.mode,
                              'triggerSource', r.trigger_source, 'attemptCount', r.attempt_count, 'maxAttempts', r.max_attempts)
    from public.automation_runs r
    where r.id = :'run_id'::uuid
  ),
  'input', d.input,
  'output', d.output,
  'tasks', (
    select jsonb_agg(jsonb_build_object(
             'taskKind', t.task_kind, 'status', t.status, 'attemptCount', t.attempt_count, 'maxAttempts', t.max_attempts,
             'availableAt', t.available_at, 'leaseExpiresAt', t.lease_expires_at, 'errorCode', t.error_code,
             'errorMessage', left(t.error_message, 200)) order by t.priority)
    from public.automation_tasks t
    where t.run_id = :'run_id'::uuid
  )
)
from public.automation_tasks d
where d.run_id = :'run_id'::uuid
  and d.task_kind = 'backlinks.discovery.preview';

rollback;
