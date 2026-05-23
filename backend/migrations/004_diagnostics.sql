-- Migration 004 — Phase 2 : table `diagnostics` (collection la plus chaude).
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Ordre : après 003 (logements) — FK logement_id → logements(id).
--
-- Le détail du diagnostic (items pièce par pièce, photos, signature,
-- préconisations, coûts par zone…) reste dans `data` jsonb. Les colonnes
-- structurées portent ce qu'on filtre/trie/joint. `content_hash` conserve
-- le hash d'intégrité de la signature électronique. `version` + `updated_at`
-- = verrouillage optimiste pour détecter les conflits d'édition terrain.

create table if not exists public.diagnostics (
  id                text primary key,
  logement_id       text not null references public.logements (id) on delete cascade,
  statut            text,
  agent_id          text,
  date_creation     timestamptz,
  date_modification timestamptz,
  cout_total        numeric,
  urgence_globale   text,
  content_hash      text,
  data              jsonb       not null,
  version           integer     not null default 1,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_diagnostics_logement_id on public.diagnostics (logement_id);
create index if not exists idx_diagnostics_statut      on public.diagnostics (statut);
create index if not exists idx_diagnostics_date_modif  on public.diagnostics (date_modification desc);

comment on table public.diagnostics is 'DIAG-LTS — diagnostics (Phase 2). data jsonb = items/photos/signature. version/updated_at = verrou optimiste.';
