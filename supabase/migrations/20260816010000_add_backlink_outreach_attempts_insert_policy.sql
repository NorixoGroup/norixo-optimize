begin;

create policy "backlink_outreach_attempts_insert_workspace_admins"
on public.backlink_outreach_attempts
for insert
to authenticated
with check (
  public.is_workspace_admin_or_owner(workspace_id)
  and actor_user_id = auth.uid()
);

commit;
