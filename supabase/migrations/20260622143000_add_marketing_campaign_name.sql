alter table public.marketing_campaigns
  add column if not exists name text;

update public.marketing_campaigns
set name = coalesce(name, 'Campagne - ' || to_char(created_at, 'DD/MM/YYYY HH24:MI'))
where name is null;

alter table public.marketing_campaigns
  alter column name set default 'Campagne sans nom';
