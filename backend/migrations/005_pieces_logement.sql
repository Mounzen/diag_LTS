-- Migration 005 — Phase 2 : table `pieces_logement`.
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Ordre : après 003 (logements) — FK logement_id → logements(id).
--
-- Pièces d'un logement (configuration par défaut selon le type T1–T7, puis
-- ajustée en terrain). Le détail (surface estimée, éléments de diagnostic
-- rattachés, etc.) reste dans `data` jsonb.

create table if not exists public.pieces_logement (
  id           text primary key,
  logement_id  text not null references public.logements (id) on delete cascade,
  nom          text,
  type         text,
  ordre        integer,
  archived_at  timestamptz,
  data         jsonb       not null,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_pieces_logement_id on public.pieces_logement (logement_id);

comment on table public.pieces_logement is 'DIAG-LTS — pièces des logements (Phase 2). Colonnes structurées + data jsonb.';
