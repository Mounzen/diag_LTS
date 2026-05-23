// Couche d'accès « interventions » — Phase 2 dual-write (migration 008).
export const INTERVENTIONS_TABLE = 'interventions';
// helpers de coercition
function txt(v) { return (typeof v === "string" && v.trim()) ? v : (v == null ? null : v); }
function nn(v) { return (v === "" || v == null) ? null : v; }            // chaine vide -> null (colonnes FK)
function ts(v) { return (typeof v === "string" && v.trim()) ? v : null; } // date -> null si vide
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

export function interventionToRow(i) {
  return {
    id: i.id,
    logement_id: nn(i.logementId),
    type: i.type ?? null,
    date: ts(i.dateDebut ?? i.date),
    statut: i.statut ?? null,
    data: i,
    updated_at: new Date().toISOString()
  };
}
export async function upsertIntervention(supabase, intervention) {
  if (!supabase || !intervention?.id) return { ok: false };
  const { error } = await supabase.from(INTERVENTIONS_TABLE).upsert(interventionToRow(intervention), { onConflict: 'id' });
  return { ok: !error, error: error?.message || null };
}
export async function deleteIntervention(supabase, id) {
  if (!supabase || !id) return { ok: false };
  const { error } = await supabase.from(INTERVENTIONS_TABLE).delete().eq('id', id);
  return { ok: !error, error: error?.message || null };
}
export async function backfillInterventions(supabase, list = []) {
  if (!supabase || !list.length) return { ok: false, count: 0 };
  const { error } = await supabase.from(INTERVENTIONS_TABLE).upsert(list.map(interventionToRow), { onConflict: 'id' });
  return error ? { ok: false, error: error.message } : { ok: true, count: list.length };
}
export async function countInterventions(supabase) {
  if (!supabase) return null;
  const { count, error } = await supabase.from(INTERVENTIONS_TABLE).select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}
