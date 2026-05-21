import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enrichLogementPatrimoine } from '../../config/reglesPatrimoniales.js';
import { DIAGNOSTIC_TEMPLATE } from '../../config/diagnosticMetier.js';
import { ensureConfigurationCollections } from '../../config/configurationLogement.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(moduleDir, '..', '..');
export const dataDir = path.join(root, 'data');
export const dbPath = process.env.DIAG_DB_PATH ? path.resolve(process.env.DIAG_DB_PATH) : path.join(dataDir, 'db.json');
export const referentielPath = path.join(dataDir, 'referentielTravaux.json');
export const uploadDir = path.join(root, 'uploads');

const SIMPLE_USERS = [
  { prenom: 'Aimé', codeConnexion: '1111', role: 'agent', service: 'Terrain', actif: true },
  { prenom: 'Frasila', codeConnexion: '2222', role: 'responsable', service: 'Terrain', actif: true },
  { prenom: 'Manu', codeConnexion: '3333', role: 'agent', service: 'Terrain', actif: true },
  { prenom: 'Dom', codeConnexion: '4444', role: 'admin', service: 'Direction', actif: true }
];

export function ensureDataDirectories() {
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
}

export function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function foldText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function userRuntimeId(user = {}) {
  return foldText(user.prenom).replace(/[^a-z0-9]+/g, '-') || 'agent';
}

function attachRuntimeUserId(user) {
  Object.defineProperty(user, 'id', {
    value: userRuntimeId(user),
    enumerable: false,
    configurable: true
  });
  return user;
}

function normalizeUser(user = {}) {
  const role = user.role === 'chef' ? 'responsable' : (user.role || 'agent');
  const prenom = String(user.prenom || String(user.nom || '').trim().split(/\s+/)[0] || '').trim();
  const codeConnexion = String(user.codeConnexion || user.code || '').replace(/\D/g, '');
  return attachRuntimeUserId({
    prenom,
    codeConnexion,
    role,
    service: user.service || user.role_label || 'Terrain',
    actif: user.actif !== false
  });
}

function ensureSimpleUsers(db) {
  const previous = new Map((db.users || []).map((user) => [foldText(user.prenom || user.nom), user]));
  const nextUsers = SIMPLE_USERS.map((initial) => {
    const existing = previous.get(foldText(initial.prenom)) || {};
    return normalizeUser({ ...initial, actif: existing.actif ?? initial.actif });
  });
  const changed = JSON.stringify(db.users || []) !== JSON.stringify(nextUsers);
  db.users = nextUsers;
  return changed;
}

// Cache mémoire : db.json (~4 MB) n'est lu / parsé / enrichi qu'UNE seule fois.
// Les requêtes suivantes réutilisent le même objet en RAM au lieu de reparser
// 4 MB (~30 MB de RAM) à chaque appel → c'est ce qui faisait dépasser les 512 MB
// du plan gratuit Render (OOM). saveDb() garde le cache synchronisé avec le disque,
// et reloadDb() l'invalide après une restauration externe (Supabase / backup).
let cachedDb = null;

export function loadDb() {
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(dbPath)) {
    throw new Error('Base db.json absente. Lancez : npm run import --prefix backend');
  }
  const db = loadJson(dbPath, {});
  const sectors = [...new Set((db.logements || []).map((logement) => String(logement.secteur || '').trim()).filter(Boolean))].sort();
  db.users = (db.users || []).map(normalizeUser);
  const usersChanged = ensureSimpleUsers(db);
  db.lts = db.lts || [];
  db.logements = (db.logements || []).map((logement) => {
    const enriched = enrichLogementPatrimoine(logement, logement);
    // Valeurs par défaut universelles : tôle, RDC, cours
    if (enriched.couverture === undefined) enriched.couverture = 'tole';
    if (enriched.etage === undefined) enriched.etage = 'RDC';
    if (enriched.hasCours === undefined) enriched.hasCours = true;
    return enriched;
  });
  db.secteurs = Array.isArray(db.secteurs) && db.secteurs.length ? db.secteurs : sectors;
  db.diagnostics = db.diagnostics || [];
  db.photos = db.photos || [];
  db.travaux_estimes = db.travaux_estimes || [];
  db.prix_reference = db.prix_reference || [];
  db.historique_actions = db.historique_actions || [];
  db.validations = db.validations || [];
  db.exports = db.exports || [];
  db.journalActions = db.journalActions || [];
  db.consolidations = db.consolidations || { logements: {}, lts: {}, secteurs: {}, parc: null };
  db.coordonnees_logements = db.coordonnees_logements || [];
  db.interventions = db.interventions || [];
  db.entreprises = db.entreprises || [];
  db.devis = db.devis || [];
  db.offline_sync_queue = db.offline_sync_queue || [];
  db.ai_redaction_logs = db.ai_redaction_logs || [];
  db.diagnosticTemplate = db.diagnosticTemplate?.length ? db.diagnosticTemplate : DIAGNOSTIC_TEMPLATE;
  ensureConfigurationCollections(db);
  cachedDb = db;
  if (usersChanged || !Array.isArray(db.secteurs) || !db.secteurs.length) saveDb(db);
  return cachedDb;
}

// Invalide le cache puis relit le fichier depuis le disque.
// À appeler après une restauration externe (Supabase / backup) qui écrit db.json
// directement sans passer par saveDb(), sinon le cache resterait obsolète.
export function reloadDb() {
  cachedDb = null;
  return loadDb();
}

let saveCallback = null;

export function setSaveCallback(cb) {
  saveCallback = cb;
}

export function saveDb(db) {
  cachedDb = db;
  writeJson(dbPath, db);
  if (saveCallback) {
    Promise.resolve().then(() => saveCallback(db)).catch((err) => {
      console.error('[SaveCallback] échec sync Supabase:', err.message);
    });
  }
}

export function loadReferentiel() {
  return loadJson(referentielPath, {});
}
