// Phase 11 preparation: coordinates may be imported later from source files
// or geocoded externally. For now, keep the shape explicit and non-blocking.
export function coordinatesForLogement(db, logementId) {
  return (db.coordonnees_logements || []).find((item) => item.logementId === logementId) || null;
}
