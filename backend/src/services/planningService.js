// Phase 12 preparation: entities are initialized in db.json by storeService.
// Full scheduling, companies and quotes workflows will be implemented later.
export function planningCollections(db) {
  return {
    interventions: db.interventions || [],
    entreprises: db.entreprises || [],
    devis: db.devis || []
  };
}
