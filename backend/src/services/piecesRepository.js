// Couche d'accès « pieces_logement » — Phase 2 dual-write (migration 005).
export const PIECES_TABLE = 'pieces_logement';
// helpers de coercition
function txt(v) { return (typeof v === "string" && v.trim()) ? v : (v == null ? null : v); }
function nn(v) { return (v === "" || v == null) ? null : v; }            // chaine vide -> null (colonnes FK)
function ts(v) { return (typeof v === "string" && v.trim()) ? v : null; } // date -> null si vide
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

export function pieceToRow(p) {
  return {
    id: p.id,
    logement_id: nn(p.logementId),
    nom: p.nom ?? null,
    type: p.type ?? null,
    ordre: num(p.ordre),
    archived_at: ts(p.archivedAt),
    data: p,
    updated_at: new Date().toISOString()
  };
}
export async function upsertPiece(supabase, piece) {
  if (!supabase || !piece?.id) return { ok: false };
  const { error } = await supabase.from(PIECES_TABLE).upsert(pieceToRow(piece), { onConflict: 'id' });
  return { ok: !error, error: error?.message || null };
}
export async function backfillPieces(supabase, list = []) {
  if (!supabase || !list.length) return { ok: false, count: 0 };
  const BATCH = 200; let count = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH).map(pieceToRow);
    const { error } = await supabase.from(PIECES_TABLE).upsert(slice, { onConflict: 'id' });
    if (error) return { ok: false, count, error: error.message };
    count += slice.length;
  }
  return { ok: true, count };
}
export async function countPieces(supabase) {
  if (!supabase) return null;
  const { count, error } = await supabase.from(PIECES_TABLE).select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}
