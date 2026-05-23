// Couche d'accès « devis » — Phase 2 dual-write (migration 007).
export const DEVIS_TABLE = 'devis';
// helpers de coercition
function txt(v) { return (typeof v === "string" && v.trim()) ? v : (v == null ? null : v); }
function nn(v) { return (v === "" || v == null) ? null : v; }            // chaine vide -> null (colonnes FK)
function ts(v) { return (typeof v === "string" && v.trim()) ? v : null; } // date -> null si vide
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

export function devisToRow(d) {
  return {
    id: d.id,
    logement_id: nn(d.logementId ?? d.logement_id),
    entreprise: d.entrepriseNom ?? d.entreprise ?? null,
    montant_ht: num(d.montantHT),
    montant_ttc: num(d.montantTTC),
    statut: d.statut ?? null,
    date_demande: ts(d.dateDemande),
    data: d,
    updated_at: new Date().toISOString()
  };
}
export async function upsertDevis(supabase, devis) {
  if (!supabase || !devis?.id) return { ok: false };
  const { error } = await supabase.from(DEVIS_TABLE).upsert(devisToRow(devis), { onConflict: 'id' });
  return { ok: !error, error: error?.message || null };
}
export async function deleteDevis(supabase, id) {
  if (!supabase || !id) return { ok: false };
  const { error } = await supabase.from(DEVIS_TABLE).delete().eq('id', id);
  return { ok: !error, error: error?.message || null };
}
export async function backfillDevis(supabase, list = []) {
  if (!supabase || !list.length) return { ok: false, count: 0 };
  const { error } = await supabase.from(DEVIS_TABLE).upsert(list.map(devisToRow), { onConflict: 'id' });
  return error ? { ok: false, error: error.message } : { ok: true, count: list.length };
}
export async function countDevis(supabase) {
  if (!supabase) return null;
  const { count, error } = await supabase.from(DEVIS_TABLE).select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}
