-- Soft delete : les annonces « supprimées » restent en base (références audits) mais disparaissent des listes actives.
alter table public.listings
  add column if not exists deleted_at timestamptz;

comment on column public.listings.deleted_at is 'When set, listing is hidden from workspace inventory; audits may still reference listing_id.';
