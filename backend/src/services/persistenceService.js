import { loadDb, saveDb } from './storeService.js';

// Phase 9 preparation: keep persistence behind a small adapter so db.json can
// later be replaced by Prisma/PostgreSQL without changing route contracts.
export function createPersistence() {
  return {
    loadDb,
    saveDb,
    provider: process.env.DATA_PROVIDER || 'json'
  };
}
