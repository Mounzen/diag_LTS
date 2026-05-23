-- Migration 006 — Phase 2 : table `photos`.
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Ordre : après 003 (logements) et 004 (diagnostics) — FK vers les deux.
--
-- Métadonnées des photos terrain. Le binaire reste dans Supabase Storage ;
-- ici on garde l'URL + le rattachement (logement / diagnostic / pièce / zone)
-- et le reste des champs souples dans `data` jsonb. `deleted_at` = soft delete.

create table if not exists public.photos (
  id            text primary key,
  logement_id   text references public.logements (id)   on delete cascade,
  diagnostic_id text references public.diagnostics (id)  on delete set null,
  url           text,
  zone          text,
  created_at    timestamptz,
  deleted_at    timestamptz,
  data          jsonb not null
);

create index if not exists idx_photos_logement_id   on public.photos (logement_id);
create index if not exists idx_photos_diagnostic_id on public.photos (diagnostic_id);

comment on table public.photos is 'DIAG-LTS — métadonnées photos (Phase 2). Binaire dans Storage, URL + rattachements ici.';
