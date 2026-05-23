// Couche d'accès « diagnostics » — Phase 2 (écriture par ligne, dual-write).
// Calquée sur logementsRepository : colonnes structurées (filtres/jointures)
// + colonne `data` jsonb (objet diagnostic complet : items, photos, signatures…).
// version/updated_at = verrouillage optimiste (prêt à brancher).

export const DIAGNOSTICS_TABLE = 'diagnostics';

// Coerce une date (ISO string) -> valeur acceptée par timestamptz, sinon null.
function ts(value) {
  return value && typeof value === 'string' && value.trim() ? value : null;
}
function num(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

// Objet diagnostic (app) -> ligne table (colonnes structurées + data jsonb).
export function diagnosticToRow(d) {
  const sigs = Array.isArray(d.signatures) ? d.signatures : [];
  const lastHash = sigs.length ? sigs[sigs.length - 1].contentHash : null;
  return {
    id: d.id,
    logement_id: d.logementId ?? d.logement_id ?? null,
    statut: d.statut ?? null,
    agent_id: d.agentId ?? (d.agent && d.agent.id) ?? null,
    date_creation: ts(d.dateDebut ?? d.date),
    date_modification: ts(d.dateModification),
    cout_total: num(d.coutTotal ?? d.cout_total_estime),
    urgence_globale: d.urgenceGlobale ?? d.priorite ?? null,
    content_hash: d.contentHash ?? lastHash ?? null,
    data: d,
    updated_at: new Date().toISOString()
  };
}

export function rowToDiagnostic(row) {
  if (!row) return null;
  const diagnostic = (row.data && typeof row.data === 'object') ? row.data : {};
  return { ...diagnostic, __version: row.version };
}

// Upsert best-effort d'un diagnostic (par ligne). Renvoie { ok, error }.
export async function upsertDiagnostic(supabase, diagnostic) {
  if (!supabase || !diagnostic?.id) return { ok: false, error: 'supabase/diagnostic absent' };
  const { error } = await supabase
    .from(DIAGNOSTICS_TABLE)
    .upsert(diagnosticToRow(diagnostic), { onConflict: 'id' });
  return { ok: !error, error: error?.message || null };
}

// Backfill depuis le blob (idempotent via upsert), par lots.
export async function backfillDiagnostics(supabase, diagnostics = []) {
  if (!supabase || !diagnostics.length) return { ok: false, count: 0 };
  const rows = diagnostics.map(diagnosticToRow);
  const BATCH = 200;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(DIAGNOSTICS_TABLE).upsert(slice, { onConflict: 'id' });
    if (error) return { ok: false, count, error: error.message };
    count += slice.length;
  }
  return { ok: true, count };
}

export async function countDiagnostics(supabase) {
  if (!supabase) return null;
  const { count, error } = await supabase
    .from(DIAGNOSTICS_TABLE)
    .select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}

export async function getDiagnostic(supabase, id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from(DIAGNOSTICS_TABLE).select('*').eq('id', id).limit(1);
  if (error) return null;
  return rowToDiagnostic(Array.isArray(data) ? data[0] : null);
}

// Mise à jour avec verrouillage optimiste (prête à l'emploi pour la bascule lectures).
export async function updateDiagnosticOptimistic(supabase, id, expectedVersion, diagnostic) {
  if (!supabase || !id) return { ok: false, error: 'supabase/id absent' };
  const row = diagnosticToRow(diagnostic);
  row.version = (Number(expectedVersion) || 0) + 1;
  const { data, error } = await supabase
    .from(DIAGNOSTICS_TABLE)
    .update(row)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('version');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, conflict: true };
  return { ok: true, version: data[0].version };
}
