-- Configuration des 2 crons automatisés pour Citrine Pricing via pg_cron
-- 1. Cron Pricing Général : 8h, 13h, 18h UTC
-- 2. Cron Destinations Aéroport Uniquement : 20h, 23h, 2h UTC

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Déplanifier d'éventuels anciens jobs pour éviter les doublons
do $$
begin
  if exists (select 1 from cron.job where jobname = 'citrine-pricing-regular') then
    perform cron.unschedule('citrine-pricing-regular');
  end if;
  if exists (select 1 from cron.job where jobname = 'citrine-pricing-airport') then
    perform cron.unschedule('citrine-pricing-airport');
  end if;
end $$;

-- 1. Planificateur automatique général (8h, 13h, 18h)
-- Relevé complet des tarifs sur l'ensemble de la matrice intra-ville
select cron.schedule(
  'citrine-pricing-regular',
  '0 8,13,18 * * *',
  $$
  select net.http_post(
    url := 'https://ais-dev-4cdvrbiyy3d3esirxthrpi-727470315179.europe-west2.run.app/api/cron/trigger-pricing',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"mode": "all"}'::jsonb
  );
  $$
);

-- 2. Planificateur automatique aéroport uniquement (20h, 23h, 2h)
-- Relevé nocturne spécialisé reliant tous les quartiers de la ville exclusivement à l'Aéroport
select cron.schedule(
  'citrine-pricing-airport',
  '0 20,23,2 * * *',
  $$
  select net.http_post(
    url := 'https://ais-dev-4cdvrbiyy3d3esirxthrpi-727470315179.europe-west2.run.app/api/cron/trigger-airport-pricing',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"mode": "airport"}'::jsonb
  );
  $$
);
