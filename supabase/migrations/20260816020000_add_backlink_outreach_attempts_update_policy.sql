begin;

create policy "backlink_outreach_attempts_update_workspace_admins"
on public.backlink_outreach_attempts
for update
to authenticated
using (
  public.is_workspace_admin_or_owner(workspace_id)
)
with check (
  public.is_workspace_admin_or_owner(workspace_id)
);

commit;
