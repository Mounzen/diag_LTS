import fs from 'fs';
import path from 'path';
import { afterAll } from 'vitest';

const dataDir = path.join(process.cwd(), 'data');
const realDb = path.join(dataDir, 'db.json');
const testDb = path.join(dataDir, 'db.test.json');

// Avant tous les tests : on duplique la vraie base en base de test
// Les tests travaillent sur db.test.json, la vraie db.json n'est jamais touchée
if (fs.existsSync(realDb)) {
  fs.copyFileSync(realDb, testDb);
} else {
  // Base minimale si db.json absente
  fs.writeFileSync(testDb, JSON.stringify({
    generated_at: new Date().toISOString(),
    users: [], lts: [], logements: [], diagnostics: [], photos: [],
    journalActions: [], historique_actions: [], devis: [], interventions: [],
    configurations_logement: [], pieces_logement: []
  }, null, 2));
}

afterAll(() => {
  // Nettoyage : on supprime la base de test
  try { if (fs.existsSync(testDb)) fs.unlinkSync(testDb); } catch {}
});
