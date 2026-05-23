// Couche d'accès « logements » — Phase 2 (écritures par ligne).
//
// Stratégie hybride : colonnes structurées (filtres / tris / jointures / carto)
// + colonne `data` jsonb qui conserve l'objet logement complet tel que
// l'application le manipule (camelCase). `version` / `updated_at` servent au
// verrouillage optimiste.
//
// On passe le client supabase en argument (un seul client, créé dans server.js)
// pour garder ce module pur et testable.

export const LOGEMENTS_TABLE = 'logements';

// Objet logement (app, camelCase) -> ligne table (colonnes structurées + data jsonb).
export function logementToRow(logement) {
  return {
    id: logement.id,
    code_acces: logement.code_acces ?? null,
    code_lts: logement.code_lts ?? null,
    nom_lts: logement.nom_lts ?? null,
    secteur: logement.secteur ?? null,
    quartier: logement.quartier ?? null,
    adresse: logement.adresse ?? null,
    type_logement: logement.type_logement ?? null,
    statut: logement.statut ?? null,
    statut_patrimonial: logement.statutPatrimonial ?? null,
    dans_parc_actif: typeof logement.dansParcActif === 'boolean' ? logement.dansParcActif : null,
    ordre: Number.isFinite(Number(logement.ordre)) ? Number(logement.ordre) : null,
    latitude: Number.isFinite(Number(logement.latitude)) ? Number(logement.latitude) : null,
    longitude: Number.isFinite(Number(logement.longitude)) ? Number(logement.longitude) : null,
    data: logement,
    updated_at: new Date().toISOString()
  };
}

// Ligne table -> objet logement (app). On renvoie l'objet complet stocké en
// `data`, en y reportant la version (utile au verrou optimiste côté app).
export function rowToLogement(row) {
  if (!row) return null;
  const logement = (row.data && typeof row.data === 'object') ? row.data : {};
  return { ...logement, __version: row.version };
}

// Upsert best-effort d'un logement (par ligne). N'incrémente pas la version
// (réservé à updateLogementOptimistic). Renvoie { ok, error }.
export async function upsertLogement(supabase, logement) {
  if (!supabase || !logement?.id) return { ok: false, error: 'supabase/logement absent' };
  const { error } = await supabase
    .from(LOGEMENTS_TABLE)
    .upsert(logementToRow(logement), { onConflict: 'id' });
  return { ok: !error, error: error?.message || null };
}

// Backfill : remplit/maj la table depuis le blob (idempotent via upsert), par lots.
export async function backfillLogements(supabase, logements = []) {
  if (!supabase || !logements.length) return { ok: false, count: 0 };
  const rows = logements.map(logementToRow);
  const BATCH = 200;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(LOGEMENTS_TABLE).upsert(slice, { onConflict: 'id' });
    if (error) return { ok: false, count, error: error.message };
    count += slice.length;
  }
  return { ok: true, count };
}

// Nombre de lignes (null si table absente / erreur).
export async function countLogements(supabase) {
  if (!supabase) return null;
  const { count, error } = await supabase
    .from(LOGEMENTS_TABLE)
    .select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}

export async function listLogements(supabase) {
  if (!supabase) return null;
  const { data, error } = await supabase.from(LOGEMENTS_TABLE).select('*');
  if (error) return null;
  return data.map(rowToLogement);
}

export async function getLogement(supabase, id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from(LOGEMENTS_TABLE).select('*').eq('id', id).limit(1);
  if (error) return null;
  return rowToLogement(Array.isArray(data) ? data[0] : null);
}

// Mise à jour avec verrouillage optimiste : n'écrit que si version == expected ;
// incrémente la version. Renvoie { ok, conflict?, version?, error? }.
// (Prête à l'emploi pour la bascule des lectures ; non câblée tant que le blob
// reste la source de lecture.)
export async function updateLogementOptimistic(supabase, id, expectedVersion, logement) {
  if (!supabase || !id) return { ok: false, error: 'supabase/id absent' };
  const row = logementToRow(logement);
  row.version = (Number(expectedVersion) || 0) + 1;
  const { data, error } = await supabase
    .from(LOGEMENTS_TABLE)
    .update(row)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('version');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, conflict: true };
  return { ok: true, version: data[0].version };
}
