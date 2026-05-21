-- Migration 001 — Phase 1 : persistance Postgres (table app_state)
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- À lancer AVANT de déployer le code Phase 1.
--
-- La table contient une seule ligne (id = 1) dont la colonne `data` (jsonb)
-- porte tout l'état applicatif. L'accès se fait côté serveur avec la clé
-- service_role (qui contourne la RLS), donc aucune policy n'est nécessaire.

create table if not exists public.app_state (
  id          integer primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- (Optionnel) Trace de la dernière écriture, utile pour le suivi.
comment on table public.app_state is 'DIAG-LTS — état applicatif complet (Phase 1 migration JSON → Postgres). 1 ligne, id=1.';
