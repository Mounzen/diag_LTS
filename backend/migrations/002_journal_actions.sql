-- Migration 002 — Phase 2 (Tranche 1) : journal d'audit dans une table dédiée.
-- À exécuter UNE fois dans Supabase : Dashboard → SQL Editor → coller → Run.
-- À lancer AVANT de déployer le code (sinon les nouvelles entrées de journal
-- ne sont pas enregistrées tant que la table n'existe pas).
--
-- Le journal d'audit ne s'accumule plus dans le bloc app_state gardé en mémoire :
-- chaque action est insérée ici (colonne `data` jsonb = l'entrée complète, plus
-- quelques colonnes indexées pour le filtrage et le tri).

create table if not exists public.journal_actions (
  id           text primary key,
  date         timestamptz,
  action       text,
  logement_id  text,
  agent_id     text,
  data         jsonb not null
);

create index if not exists idx_journal_actions_date on public.journal_actions (date desc);

comment on table public.journal_actions is 'DIAG-LTS — journal d''audit (Phase 2). Sorti du bloc app_state pour alléger la mémoire.';
