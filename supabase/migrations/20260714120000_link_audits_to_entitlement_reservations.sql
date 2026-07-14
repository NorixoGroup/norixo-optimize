begin;

alter table public.audits
  add column if not exists entitlement_reservation_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audits_entitlement_reservation_id_fkey'
      and conrelid = 'public.audits'::regclass
  ) then
    alter table public.audits
      add constraint audits_entitlement_reservation_id_fkey
      foreign key (entitlement_reservation_id)
      references public.audit_entitlement_reservations(id)
      on delete set null;
  end if;
end
$$;

create index if not exists audits_entitlement_reservation_id_idx
  on public.audits (entitlement_reservation_id)
  where entitlement_reservation_id is not null;

create unique index if not exists audits_entitlement_reservation_id_unique
  on public.audits (entitlement_reservation_id)
  where entitlement_reservation_id is not null;

commit;
