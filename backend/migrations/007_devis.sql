-- Migration 007 — Phase 2 : table `devis`.
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Ordre : après 003 (logements) — FK logement_id → logements(id).
--
-- Devis entreprise rattachés à un logement. Les postes détaillés et les
-- coordonnées entreprise restent dans `data` jsonb ; les colonnes structurées
-- portent le rattachement, le montant et le statut (pour listes/filtres).

create table if not exists public.devis (
  id           text primary key,
  logement_id  text references public.logements (id) on delete cascade,
  entreprise   text,
  montant_ht   numeric,
  montant_ttc  numeric,
  statut       text,
  date_demande timestamptz,
  data         jsonb       not null,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_devis_logement_id on public.devis (logement_id);
create index if not exists idx_devis_statut      on public.devis (statut);

comment on table public.devis is 'DIAG-LTS — devis entreprise (Phase 2). Colonnes structurées + data jsonb (postes, contacts).';
