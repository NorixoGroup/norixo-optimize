begin;

-- audit_credit_lots : isolation multi-tenant ; écriture des lots via service_role (webhook).
-- UPDATE pour authenticated : nécessaire pour consumeWorkspaceAuditCredits (JWT utilisateur).
alter table public.audit_credit_lots enable row level security;

drop policy if exists "audit_credit_lots_select_member_scoped" on public.audit_credit_lots;
drop policy if exists "audit_credit_lots_update_member_scoped" on public.audit_credit_lots;

create policy "audit_credit_lots_select_member_scoped"
on public.audit_credit_lots
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = audit_credit_lots.workspace_id
      and wm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = audit_credit_lots.workspace_id
      and w.owner_user_id = auth.uid()
  )
);

create policy "audit_credit_lots_update_member_scoped"
on public.audit_credit_lots
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = audit_credit_lots.workspace_id
      and wm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = audit_credit_lots.workspace_id
      and w.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = audit_credit_lots.workspace_id
      and wm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = audit_credit_lots.workspace_id
      and w.owner_user_id = auth.uid()
  )
);

-- billing_payments : lecture limitée au workspace ; écritures via service_role uniquement.
do $$
begin
  if to_regclass('public.billing_payments') is not null then
    execute 'alter table public.billing_payments enable row level security';
    execute 'drop policy if exists billing_payments_select_member_scoped on public.billing_payments';
    execute $p$
      create policy "billing_payments_select_member_scoped"
      on public.billing_payments
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = billing_payments.workspace_id
            and wm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.workspaces w
          where w.id = billing_payments.workspace_id
            and w.owner_user_id = auth.uid()
        )
      )
    $p$;
  end if;
end$$;

commit;
