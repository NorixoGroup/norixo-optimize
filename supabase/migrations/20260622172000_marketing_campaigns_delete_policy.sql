create policy "marketing_campaigns_delete_workspace_members"
  on public.marketing_campaigns
  for delete
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = marketing_campaigns.workspace_id
        and wm.user_id = auth.uid()
    )
  );
