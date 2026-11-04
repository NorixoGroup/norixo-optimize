-- G4-M4 synthetic fixtures. Throwaway local cluster only; no production data.
-- The table mirrors only the columns/types the G4-M3 query touches (plus recipient/provider_message_id
-- as sensitive sentinels). Status has no CHECK so 'prepared'/'cancelled' can be exercised as ineligible.
create role web_anon nologin;
create table public.backlink_outreach_attempts (
  id uuid primary key,
  workspace_id uuid not null,
  outreach_id uuid not null,
  channel text not null default 'email',
  provider text not null default 'resend',
  attempt_kind text not null default 'initial',
  recipient text not null default 'sentinel-recipient@example.invalid',
  status text not null,
  provider_message_id text,
  error_code text,
  requested_at timestamptz not null
);
grant usage on schema public to web_anon;
grant select on public.backlink_outreach_attempts to web_anon; -- read-only role: no INSERT/UPDATE/DELETE

-- Workspace A (…a001), cutoff used by the test: 2026-11-01T11:45:00.000Z
insert into public.backlink_outreach_attempts (id, workspace_id, outreach_id, status, requested_at, provider_message_id, error_code) values
('00000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000001','unknown',   '2026-11-01T11:59:00Z', 'RESEND_SENTINEL_MESSAGE_ID', 'OUTREACH_PROVIDER_RESULT_UNCONFIRMED'),
('00000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000002','unknown',   '2026-10-01T08:00:00Z', null, null),
('00000000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000003','requested', '2026-11-01T11:00:00Z', null, null),
('00000000-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000004','requested', '2026-11-01T11:45:00.000Z', null, null),
('00000000-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000005','requested', '2026-11-01T11:44:59.999Z', null, null),
('00000000-0000-4000-8000-000000000006','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000006','requested', '2026-11-01T11:45:00.001Z', null, null),
('00000000-0000-4000-8000-000000000007','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000007','requested', '2026-11-01T11:55:00Z', null, null),
('00000000-0000-4000-8000-000000000008','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000008','accepted',  '2026-10-01T08:00:00Z', 'RESEND_SENTINEL_ACCEPTED', null),
('00000000-0000-4000-8000-000000000009','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-000000000009','failed',    '2026-10-01T08:00:00Z', null, 'X'),
('00000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-00000000000a','prepared',  '2026-10-01T08:00:00Z', null, null),
('00000000-0000-4000-8000-00000000000b','aaaaaaaa-0000-4000-8000-00000000a001','11111111-0000-4000-8000-00000000000b','cancelled', '2026-10-01T08:00:00Z', null, null),
-- Workspace B: eligible rows that must never appear for workspace A.
('00000000-0000-4000-8000-0000000000b1','bbbbbbbb-0000-4000-8000-00000000b001','22222222-0000-4000-8000-0000000000b1','unknown',   '2026-10-01T08:00:00Z', null, null),
('00000000-0000-4000-8000-0000000000b2','bbbbbbbb-0000-4000-8000-00000000b001','22222222-0000-4000-8000-0000000000b2','requested', '2026-11-01T11:00:00Z', null, null);

-- Pagination workspaces. C: 201 eligible. D: exactly 200 eligible. E: 300 rows but only 150 eligible.
insert into public.backlink_outreach_attempts (id, workspace_id, outreach_id, status, requested_at)
select ('cccccccc-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'cccccccc-0000-4000-8000-00000000c001', gen_random_uuid(),
       'unknown', timestamp with time zone '2026-10-01T00:00:00Z' + n * interval '1 minute'
from generate_series(1, 201) n;
insert into public.backlink_outreach_attempts (id, workspace_id, outreach_id, status, requested_at)
select ('dddddddd-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'dddddddd-0000-4000-8000-00000000d001', gen_random_uuid(),
       'unknown', timestamp with time zone '2026-10-01T00:00:00Z' + n * interval '1 minute'
from generate_series(1, 200) n;
insert into public.backlink_outreach_attempts (id, workspace_id, outreach_id, status, requested_at)
select ('eeeeeeee-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'eeeeeeee-0000-4000-8000-00000000e001', gen_random_uuid(),
       case when n <= 150 then 'unknown' else 'accepted' end, timestamp with time zone '2026-10-01T00:00:00Z' + n * interval '1 minute'
from generate_series(1, 300) n;
