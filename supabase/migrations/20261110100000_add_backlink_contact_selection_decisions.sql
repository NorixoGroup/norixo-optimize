begin;

-- Human contact selection is intentionally separate from automation_runs/tasks.
-- Recording a decision must never resume a historical run, schedule validation,
-- reserve a provider budget, or create outreach work.
create table public.backlink_contact_selection_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  promotion_application_id uuid not null references public.backlink_promotion_applications(id) on delete restrict,
  source_autonomy_run_id uuid not null references public.automation_runs(id) on delete restrict,
  source_resolution_task_id uuid not null references public.automation_tasks(id) on delete restrict,
  selected_contact_id uuid references public.backlink_contacts(id) on delete restrict,
  decision_status text not null,
  candidate_fingerprint text not null,
  candidate_count integer not null,
  reason_code text not null,
  idempotency_key text not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_contact_selection_decisions_source_unique
    unique (workspace_id, source_resolution_task_id),
  constraint backlink_contact_selection_decisions_idempotency_unique
    unique (workspace_id, idempotency_key),
  constraint backlink_contact_selection_decisions_status_check
    check (decision_status in ('contact_selected', 'promotion_rejected')),
  constraint backlink_contact_selection_decisions_selected_contact_check
    check (
      (decision_status = 'contact_selected' and selected_contact_id is not null)
      or (decision_status = 'promotion_rejected' and selected_contact_id is null)
    ),
  constraint backlink_contact_selection_decisions_fingerprint_check
    check (candidate_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint backlink_contact_selection_decisions_candidate_count_check
    check (candidate_count between 2 and 100),
  constraint backlink_contact_selection_decisions_reason_check
    check (
      reason_code in (
        'HUMAN_REVIEW_SELECTED',
        'HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE',
        'HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT',
        'HUMAN_REVIEW_REJECTED_POLICY_CONSTRAINT'
      )
      and (
        (decision_status = 'contact_selected' and reason_code = 'HUMAN_REVIEW_SELECTED')
        or (decision_status = 'promotion_rejected' and reason_code <> 'HUMAN_REVIEW_SELECTED')
      )
    ),
  constraint backlink_contact_selection_decisions_idempotency_key_check
    check (idempotency_key = trim(idempotency_key) and char_length(idempotency_key) between 16 and 255)
);

create index backlink_contact_selection_decisions_workspace_promotion_idx
  on public.backlink_contact_selection_decisions (workspace_id, promotion_application_id, decided_at desc);

create table public.backlink_contact_selection_events (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.backlink_contact_selection_decisions(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  reason_code text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint backlink_contact_selection_events_type_check
    check (event_type in ('DECISION_CREATED', 'CONTACT_SELECTED', 'PROMOTION_REJECTED')),
  constraint backlink_contact_selection_events_reason_check
    check (reason_code in (
      'HUMAN_REVIEW_SELECTED',
      'HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE',
      'HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT',
      'HUMAN_REVIEW_REJECTED_POLICY_CONSTRAINT'
    )),
  constraint backlink_contact_selection_events_type_reason_check
    check (
      event_type = 'DECISION_CREATED'
      or (event_type = 'CONTACT_SELECTED' and reason_code = 'HUMAN_REVIEW_SELECTED')
      or (event_type = 'PROMOTION_REJECTED' and reason_code <> 'HUMAN_REVIEW_SELECTED')
    )
);

create index backlink_contact_selection_events_decision_created_idx
  on public.backlink_contact_selection_events (decision_id, created_at, id);

create or replace function public.prevent_backlink_contact_selection_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'BACKLINK_CONTACT_SELECTION_IMMUTABLE';
end;
$$;

create trigger trg_backlink_contact_selection_decisions_immutable
before update or delete on public.backlink_contact_selection_decisions
for each row execute function public.prevent_backlink_contact_selection_mutation();

create trigger trg_backlink_contact_selection_events_immutable
before update or delete on public.backlink_contact_selection_events
for each row execute function public.prevent_backlink_contact_selection_mutation();

alter table public.backlink_contact_selection_decisions enable row level security;
alter table public.backlink_contact_selection_events enable row level security;

create policy "backlink_contact_selection_decisions_select_double_authorized"
on public.backlink_contact_selection_decisions
for select to authenticated
using (
  public.is_norixo_private_admin()
  and public.is_workspace_admin_or_owner(workspace_id)
);

create policy "backlink_contact_selection_events_select_double_authorized"
on public.backlink_contact_selection_events
for select to authenticated
using (
  public.is_norixo_private_admin()
  and public.is_workspace_admin_or_owner(workspace_id)
);

revoke all on public.backlink_contact_selection_decisions from public, anon, authenticated, service_role;
revoke all on public.backlink_contact_selection_events from public, anon, authenticated, service_role;
grant select on public.backlink_contact_selection_decisions to authenticated;
grant select on public.backlink_contact_selection_events to authenticated;

create or replace function public.record_backlink_contact_selection_decision(
  p_workspace_id uuid,
  p_promotion_application_id uuid,
  p_source_resolution_task_id uuid,
  p_selected_contact_id uuid,
  p_expected_candidate_fingerprint text,
  p_idempotency_key text,
  p_reason_code text,
  p_confirmed boolean
)
returns table (decision_id uuid, disposition text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_idempotency_key text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_expected_fingerprint text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_expected_candidate_fingerprint, '')));
  v_reason_code text := pg_catalog.btrim(coalesce(p_reason_code, ''));
  v_task public.automation_tasks%rowtype;
  v_run public.automation_runs%rowtype;
  v_application public.backlink_promotion_applications%rowtype;
  v_contact public.backlink_contacts%rowtype;
  v_existing public.backlink_contact_selection_decisions%rowtype;
  v_candidate_ids uuid[];
  v_candidate_text text;
  v_actual_fingerprint text;
  v_decision_status text;
  v_event_type text;
begin
  if v_actor_user_id is null
    or p_workspace_id is null
    or p_promotion_application_id is null
    or p_source_resolution_task_id is null
    or p_confirmed is not true
    or char_length(v_idempotency_key) not between 16 and 255
    or p_idempotency_key <> v_idempotency_key
    or v_expected_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'BACKLINK_CONTACT_SELECTION_INVALID_INPUT';
  end if;

  if not public.is_norixo_private_admin()
    or not public.is_workspace_admin_or_owner(p_workspace_id) then
    raise exception 'BACKLINK_CONTACT_SELECTION_FORBIDDEN';
  end if;

  -- The two locks make both the source decision and an idempotency key serializable.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'backlink_contact_selection:idempotency:' || p_workspace_id::text || ':' || v_idempotency_key, 0
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'backlink_contact_selection:source:' || p_workspace_id::text || ':' || p_source_resolution_task_id::text, 0
  ));

  select * into v_existing
  from public.backlink_contact_selection_decisions
  where workspace_id = p_workspace_id and idempotency_key = v_idempotency_key
  for update;
  if found then
    if v_existing.promotion_application_id = p_promotion_application_id
      and v_existing.source_resolution_task_id = p_source_resolution_task_id
      and v_existing.selected_contact_id is not distinct from p_selected_contact_id
      and v_existing.candidate_fingerprint = v_expected_fingerprint
      and v_existing.reason_code = v_reason_code then
      return query select v_existing.id, 'replayed'::text;
      return;
    end if;
    raise exception 'BACKLINK_CONTACT_SELECTION_IDEMPOTENCY_CONFLICT';
  end if;

  select * into v_existing
  from public.backlink_contact_selection_decisions
  where workspace_id = p_workspace_id and source_resolution_task_id = p_source_resolution_task_id
  for update;
  if found then
    raise exception 'BACKLINK_CONTACT_SELECTION_ALREADY_DECIDED';
  end if;

  select * into v_task
  from public.automation_tasks
  where id = p_source_resolution_task_id
    and workspace_id = p_workspace_id
    and system = 'backlinks'
    and task_kind = 'backlinks.contact_resolution'
    and status = 'completed'
  for update;
  if not found then
    raise exception 'BACKLINK_CONTACT_SELECTION_SOURCE_TASK_INVALID';
  end if;

  select * into v_run
  from public.automation_runs
  where id = v_task.run_id
    and workspace_id = p_workspace_id
    and system = 'backlinks'
    and run_kind = 'backlinks.autonomy'
    and status = 'completed'
  for update;
  if not found then
    raise exception 'BACKLINK_CONTACT_SELECTION_SOURCE_RUN_INVALID';
  end if;

  select * into v_application
  from public.backlink_promotion_applications
  where id = p_promotion_application_id
    and workspace_id = p_workspace_id
  for update;
  if not found
    or coalesce(v_task.input ->> 'promotionApplicationId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(v_task.input ->> 'opportunityId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(v_task.input ->> 'domainId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (v_task.input ->> 'promotionApplicationId')::uuid is distinct from v_application.id
    or (v_task.input ->> 'opportunityId')::uuid is distinct from v_application.opportunity_id
    or (v_task.input ->> 'domainId')::uuid is distinct from v_application.domain_id then
    raise exception 'BACKLINK_CONTACT_SELECTION_PROMOTION_SCOPE_INVALID';
  end if;

  if v_task.output is null
    or jsonb_typeof(v_task.output -> 'createdContactIds') <> 'array'
    or jsonb_typeof(v_task.output -> 'existingContactIds') <> 'array' then
    raise exception 'BACKLINK_CONTACT_SELECTION_CANDIDATES_INVALID';
  end if;

  select array_agg(value::uuid order by value::uuid)
  into v_candidate_ids
  from (
    select distinct value
    from jsonb_array_elements_text(v_task.output -> 'createdContactIds') as created(value)
    union
    select distinct value
    from jsonb_array_elements_text(v_task.output -> 'existingContactIds') as existing(value)
  ) as candidates
  where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  if coalesce(array_length(v_candidate_ids, 1), 0) < 2
    or coalesce(array_length(v_candidate_ids, 1), 0) > 100
    or coalesce(array_length(v_candidate_ids, 1), 0) <> (
      jsonb_array_length(v_task.output -> 'createdContactIds')
      + jsonb_array_length(v_task.output -> 'existingContactIds')
    ) then
    raise exception 'BACKLINK_CONTACT_SELECTION_CANDIDATES_INVALID';
  end if;

  select string_agg(candidate_id::text, ',' order by candidate_id)
  into v_candidate_text
  from unnest(v_candidate_ids) as candidate_id;
  v_actual_fingerprint := encode(extensions.digest(
    'backlink-contact-selection-v1|workspace=' || p_workspace_id::text
    || '|promotion=' || p_promotion_application_id::text
    || '|task=' || p_source_resolution_task_id::text
    || '|candidates=' || v_candidate_text,
    'sha256'
  ), 'hex');
  if v_actual_fingerprint <> v_expected_fingerprint then
    raise exception 'BACKLINK_CONTACT_SELECTION_FINGERPRINT_STALE';
  end if;

  if p_selected_contact_id is null then
    if v_reason_code not in (
      'HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE',
      'HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT',
      'HUMAN_REVIEW_REJECTED_POLICY_CONSTRAINT'
    ) then
      raise exception 'BACKLINK_CONTACT_SELECTION_REASON_INVALID';
    end if;
    v_decision_status := 'promotion_rejected';
    v_event_type := 'PROMOTION_REJECTED';
  else
    if v_reason_code <> 'HUMAN_REVIEW_SELECTED'
      or not (p_selected_contact_id = any(v_candidate_ids)) then
      raise exception 'BACKLINK_CONTACT_SELECTION_CONTACT_INVALID';
    end if;
    select * into v_contact
    from public.backlink_contacts
    where id = p_selected_contact_id
      and workspace_id = p_workspace_id
      and domain_id = v_application.domain_id
    for update;
    if not found
      or v_contact.archived_at is not null
      or v_contact.do_not_contact_at is not null
      or v_contact.contact_status in ('archived', 'do_not_contact') then
      raise exception 'BACKLINK_CONTACT_SELECTION_CONTACT_INELIGIBLE';
    end if;
    v_decision_status := 'contact_selected';
    v_event_type := 'CONTACT_SELECTED';
  end if;

  insert into public.backlink_contact_selection_decisions (
    workspace_id, promotion_application_id, source_autonomy_run_id, source_resolution_task_id,
    selected_contact_id, decision_status, candidate_fingerprint, candidate_count,
    reason_code, idempotency_key, decided_by
  ) values (
    p_workspace_id, p_promotion_application_id, v_run.id, p_source_resolution_task_id,
    p_selected_contact_id, v_decision_status, v_actual_fingerprint, array_length(v_candidate_ids, 1),
    v_reason_code, v_idempotency_key, v_actor_user_id
  ) returning id into decision_id;

  insert into public.backlink_contact_selection_events (
    decision_id, workspace_id, event_type, reason_code, actor_user_id
  ) values
    (decision_id, p_workspace_id, 'DECISION_CREATED', v_reason_code, v_actor_user_id),
    (decision_id, p_workspace_id, v_event_type, v_reason_code, v_actor_user_id);

  disposition := 'created';
  return next;
end;
$$;

revoke all on function public.record_backlink_contact_selection_decision(uuid, uuid, uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.record_backlink_contact_selection_decision(uuid, uuid, uuid, uuid, text, text, text, boolean)
  to authenticated;

comment on table public.backlink_contact_selection_decisions is
  'Immutable human choice for one completed multi-contact autonomy resolution. It does not resume automation.';
comment on table public.backlink_contact_selection_events is
  'Immutable, non-sensitive audit events for backlink human contact selection.';
comment on function public.record_backlink_contact_selection_decision(uuid, uuid, uuid, uuid, text, text, text, boolean) is
  'Records exactly one immutable human contact selection or promotion rejection after double authorization. Never creates runs/tasks or triggers downstream work.';

commit;
