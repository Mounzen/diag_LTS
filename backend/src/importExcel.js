import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { enrichLogementPatrimoine } from '../config/reglesPatrimoniales.js';
import { DIAGNOSTIC_TEMPLATE } from '../config/diagnosticMetier.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDir, '..');
const source = path.join(root, 'data', 'source_LTS.xlsx');
const output = path.join(root, 'data', 'db.json');
const referentielPath = path.join(root, 'data', 'referentielTravaux.json');

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function rows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function normRole(role = '') {
  const value = clean(role).toLowerCase();
  if (value.includes('admin') || value.includes('dgs') || value.includes('directeur')) return 'admin';
  if (value.includes('responsable') || value.includes('chef')) return 'responsable';
  return 'agent';
}

if (!fs.existsSync(source)) {
  console.error('Fichier Excel introuvable :', source);
  process.exit(1);
}

const referentielTravaux = fs.existsSync(referentielPath)
  ? JSON.parse(fs.readFileSync(referentielPath, 'utf8'))
  : {};
const priceGrid = Object.fromEntries(Object.entries(referentielTravaux).map(([item, ref]) => [item, Number(ref.prixBase || 0)]));

const previousDb = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {};
const wb = XLSX.readFile(source);
const logementsRaw = rows(wb.Sheets.Logements || wb.Sheets['Logements']);
const ltsRaw = rows(wb.Sheets.LTS_Parc || wb.Sheets['LTS_Parc']);
const occupantsRaw = rows(wb.Sheets.Occupants || wb.Sheets['Occupants']);
const usersRaw = rows(wb.Sheets.Utilisateurs || wb.Sheets['Utilisateurs']);
void usersRaw;

const ltsByCode = new Map();
for (const row of ltsRaw) {
  const code = clean(row.code_lts);
  if (!code) continue;
  if (!ltsByCode.has(code)) {
    ltsByCode.set(code, {
      code_lts: code,
      nom_lts: clean(row.nom_lts),
      secteur: clean(row.secteur),
      quartier: clean(row.quartier),
      nombre_logements: Number(row.nombre_logements || 0),
      adresses: []
    });
  }
  const lts = ltsByCode.get(code);
  const adresse = clean(row.adresse);
  if (adresse && !lts.adresses.includes(adresse)) lts.adresses.push(adresse);
}

const occupantsByLogement = new Map();
for (const row of occupantsRaw) {
  const code = clean(row.code_acces);
  if (!code) continue;
  occupantsByLogement.set(code, {
    id_occupant: clean(row.id_occupant),
    nom: clean(row.nom),
    prenom: clean(row.prenom),
    telephone: clean(row.telephone_principal),
    email: clean(row.email),
    statut: clean(row.staut || row.statut)
  });
}

const previousLogements = new Map((previousDb.logements || []).map((logement) => [logement.id, logement]));
const logements = logementsRaw.filter((row) => clean(row.code_acces)).map((row, index) => {
  const codeLts = clean(row.code_lts);
  const meta = ltsByCode.get(codeLts) || {};
  const logement = {
    id: clean(row.code_acces),
    code_acces: clean(row.code_acces),
    code_lts: codeLts,
    nom_lts: meta.nom_lts || '',
    secteur: clean(row.secteur || meta.secteur),
    quartier: clean(row.quartier || meta.quartier),
    adresse: clean(row.adresse),
    type_logement: clean(row['type de logement'] || row.type_logement),
    statut: clean(row.statut),
    etat_general: clean(row.etat_general),
    date_creation: clean(row.date_creation),
    occupant: occupantsByLogement.get(clean(row.code_acces)) || null,
    ordre: index + 1
  };
  return enrichLogementPatrimoine(logement, previousLogements.get(logement.id));
});

const users = [
  { prenom: 'Aimé', codeConnexion: '1111', role: 'agent', service: 'Terrain', actif: true },
  { prenom: 'Frasila', codeConnexion: '2222', role: 'responsable', service: 'Terrain', actif: true },
  { prenom: 'Manu', codeConnexion: '3333', role: 'agent', service: 'Terrain', actif: true },
  { prenom: 'Dom', codeConnexion: '4444', role: 'admin', service: 'Direction', actif: true }
];

const db = {
  generated_at: new Date().toISOString(),
  users,
  lts: Array.from(ltsByCode.values()),
  logements,
  diagnostics: previousDb.diagnostics || [],
  photos: previousDb.photos || [],
  journalActions: previousDb.journalActions || [],
  diagnosticTemplate: DIAGNOSTIC_TEMPLATE,
  priceGrid,
  referentielTravaux
};

fs.writeFileSync(output, JSON.stringify(db, null, 2), 'utf8');
console.log(`Import terminé : ${logements.length} logements, ${db.lts.length} LTS, ${users.length} utilisateurs.`);
console.log(output);
