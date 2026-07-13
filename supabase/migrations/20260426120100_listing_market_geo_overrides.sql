-- Localisation marché confirmée par l'utilisateur (prioritaire sur le guessing).
alter table public.listings
  add column if not exists market_country_override text;

alter table public.listings
  add column if not exists market_city_override text;
