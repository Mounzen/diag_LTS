-- Migration 008 — Phase 2 : table `interventions`.
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Ordre : après 003 (logements) — FK logement_id → logements(id).
--
-- Interventions/travaux planifiés ou réalisés sur un logement. Collection
-- aujourd'hui vide mais prévue au schéma cible ; détail souple dans `data`.

create table if not exists public.interventions (
  id           text primary key,
  logement_id  text references public.logements (id) on delete cascade,
  type         text,
  date         timestamptz,
  statut       text,
  data         jsonb       not null,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_interventions_logement_id on public.interventions (logement_id);

comment on table public.interventions is 'DIAG-LTS — interventions/travaux (Phase 2). Colonnes structurées + data jsonb.';
