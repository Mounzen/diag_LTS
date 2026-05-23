// Couche d'accès « photos » — Phase 2 dual-write (migration 006).
export const PHOTOS_TABLE = 'photos';
// helpers de coercition
function txt(v) { return (typeof v === "string" && v.trim()) ? v : (v == null ? null : v); }
function nn(v) { return (v === "" || v == null) ? null : v; }            // chaine vide -> null (colonnes FK)
function ts(v) { return (typeof v === "string" && v.trim()) ? v : null; } // date -> null si vide
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

export function photoToRow(p) {
  return {
    id: p.id,
    logement_id: nn(p.logementId),
    diagnostic_id: nn(p.diagnosticId),
    url: p.url ?? null,
    zone: p.zone ?? null,
    created_at: ts(p.date ?? p.dateHeure),
    deleted_at: ts(p.deletedAt),
    data: p
  };
}
export async function upsertPhoto(supabase, photo) {
  if (!supabase || !photo?.id) return { ok: false };
  const { error } = await supabase.from(PHOTOS_TABLE).upsert(photoToRow(photo), { onConflict: 'id' });
  return { ok: !error, error: error?.message || null };
}
export async function backfillPhotos(supabase, list = []) {
  if (!supabase || !list.length) return { ok: false, count: 0 };
  const BATCH = 200; let count = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH).map(photoToRow);
    const { error } = await supabase.from(PHOTOS_TABLE).upsert(slice, { onConflict: 'id' });
    if (error) return { ok: false, count, error: error.message };
    count += slice.length;
  }
  return { ok: true, count };
}
export async function countPhotos(supabase) {
  if (!supabase) return null;
  const { count, error } = await supabase.from(PHOTOS_TABLE).select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}
