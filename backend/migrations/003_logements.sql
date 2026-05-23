-- Migration 003 — Phase 2 : table `logements` (collection chaude).
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Ordre : après 001 (app_state). C'est la table parent des autres (FK).
--
-- Stratégie hybride : colonnes structurées pour ce qu'on filtre/trie/joint
-- (listes, carto, secteur/LTS/parc), et `data` jsonb pour l'objet logement
-- complet tel que l'application le manipule aujourd'hui (champs souples).
-- `version` + `updated_at` servent au verrouillage optimiste (Phase 2).

create table if not exists public.logements (
  id                  text primary key,
  code_acces          text,
  code_lts            text,
  nom_lts             text,
  secteur             text,
  quartier            text,
  adresse             text,
  type_logement       text,
  statut              text,
  statut_patrimonial  text,
  dans_parc_actif     boolean,
  ordre               integer,
  latitude            double precision,
  longitude           double precision,
  data                jsonb       not null,
  version             integer     not null default 1,
  updated_at          timestamptz not null default now()
);

create index if not exists idx_logements_secteur            on public.logements (secteur);
create index if not exists idx_logements_code_lts           on public.logements (code_lts);
create index if not exists idx_logements_statut_patrimonial on public.logements (statut_patrimonial);

comment on table public.logements is 'DIAG-LTS — parc de logements (Phase 2). Colonnes structurées + data jsonb. version/updated_at = verrou optimiste.';
