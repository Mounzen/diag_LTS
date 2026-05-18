import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import {
  budgetScope,
  isDiagnosticObligatoire,
  isDansParcActif,
  patrimoineMeta,
  STATUTS_PATRIMONIAUX
} from '../config/reglesPatrimoniales.js';
import { diagnosticMeta, STATUTS_DIAGNOSTIC, STATUTS_LEGACY } from '../config/diagnosticMetier.js';
import { preconisationsForDiagnostic, strategicPreconisations } from '../config/preconisations.js';
import {
  buildDiagnosticItemsFromConfiguration,
  configurationMeta,
  createDefaultConfiguration,
  createPiece
} from '../config/configurationLogement.js';
import { ensureDataDirectories, loadDb, loadReferentiel, saveDb, uploadDir } from './services/storeService.js';
import { redigerSyntheseExecutive } from './services/aiRedactionService.js';
import { authRoutes } from './routes/authRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const app = express();
const PORT = process.env.PORT || 3001;
ensureDataDirectories();

// === Supabase Storage (photos + PDFs devis) ===
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'diag-lts-photos';
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket }
    })
  : null;
if (supabase) {
  console.log(`[Storage] Supabase actif sur bucket "${SUPABASE_BUCKET}"`);
} else {
  console.warn('[Storage] Supabase non configuré, fallback disque local /uploads');
}

async function uploadFileToSupabase(filename, buffer, contentType) {
  if (!supabase) return null;
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filename, buffer, { contentType, upsert: false, cacheControl: '3600' });
  if (error) {
    console.error('[Storage] Upload Supabase échec:', error.message);
    throw new Error('Upload Supabase échoué: ' + error.message);
  }
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function deleteFileFromSupabase(filename) {
  if (!supabase) return;
  try {
    await supabase.storage.from(SUPABASE_BUCKET).remove([filename]);
  } catch (err) {
    console.error('[Storage] Delete Supabase échec:', err.message);
  }
}

function isSupabaseUrl(url) {
  return Boolean(url && url.startsWith('http'));
}


const DIAGNOSTIC_TEMPLATE = [
  { zone: 'Extérieur', items: ['Façade', 'Peinture extérieure', 'Clôture', 'Cour', 'Accès / cheminement'] },
  { zone: 'Toiture / étanchéité', items: ['Couverture', 'Gouttières', 'Étanchéité', 'Infiltration', 'Isolation'] },
  { zone: 'Entrée / menuiseries', items: ['Porte d’entrée', 'Menuiseries', 'Serrurerie', 'Vitrage'] },
  { zone: 'Intérieur', items: ['Distribution intérieure', 'Portes intérieures', 'Rangements', 'Escalier intérieur'] },
  { zone: 'Sols / revêtements', items: ['Sol', 'Revêtement de sol', 'Plinthes'] },
  { zone: 'Murs / peintures', items: ['Murs', 'Peinture intérieure', 'Faïence'] },
  { zone: 'Plafonds / faux plafonds', items: ['Plafond', 'Faux plafond', 'Traces d’infiltration'] },
  { zone: 'Électricité', items: ['Tableau électrique', 'Prises', 'Interrupteurs', 'Éclairage', 'Sécurité électrique', 'Mise aux normes'] },
  { zone: 'Plomberie / tuyauterie', items: ['Tuyauterie', 'Fuite', 'Pression eau', 'Production eau chaude'] },
  { zone: 'Salle de bain', items: ['Douche', 'Lavabo', 'Robinetterie', 'Carrelage salle de bain', 'Aération salle de bain'] },
  { zone: 'WC', items: ['WC', 'Chasse d’eau', 'Évacuation WC'] },
  { zone: 'Cuisine', items: ['Évier', 'Meuble cuisine', 'Plan de travail', 'Robinetterie cuisine', 'Carrelage cuisine'] },
  { zone: 'Évacuation / assainissement', items: ['Évacuation eaux usées', 'Assainissement', 'Réseau extérieur'] },
  { zone: 'Humidité / ventilation', items: ['Humidité / moisissures', 'Ventilation', 'Aération', 'Condensation'] },
  { zone: 'Sécurité / accessibilité', items: ['Garde-corps', 'Détecteur fumée', 'Accessibilité', 'Risques occupants'] }
];

const ETAT_COEFS = {
  non_controle: 0,
  bon: 0,
  moyen: 0.35,
  degrade: 0.7,
  tres_degrade: 1,
  dangereux: 1.25,
  non_concerne: 0
};

const URGENCE_COEFS = {
  faible: 1,
  moyenne: 1.1,
  haute: 1.25,
  urgente: 1.45
};

const TYPE_COEFS = {
  T1: 0.75,
  T2: 0.9,
  T3: 1,
  T4: 1.12,
  T5: 1.25,
  T6: 1.35
};

function normalizeEtat(value) {
  const v = String(value || 'non_controle').toLowerCase().trim();
  return {
    'dégradé': 'degrade',
    'degradé': 'degrade',
    'degrade': 'degrade',
    'très dégradé': 'tres_degrade',
    'tres degrade': 'tres_degrade',
    'tres_degrade': 'tres_degrade',
    'non concerné': 'non_concerne',
    'non concerne': 'non_concerne',
    'non_concerne': 'non_concerne',
    'non contrôlé': 'non_controle',
    'non controle': 'non_controle',
    'non_controle': 'non_controle'
  }[v] || v;
}

function normalizeUrgence(value) {
  const v = String(value || 'faible').toLowerCase().trim();
  return ['faible', 'moyenne', 'haute', 'urgente'].includes(v) ? v : 'faible';
}

function normalizeStatutDiagnostic(value) {
  const raw = String(value || 'brouillon_agent').toLowerCase().trim();
  const map = {
    brouillon: 'brouillon_agent',
    brouillon_agent: 'brouillon_agent',
    'brouillon agent': 'brouillon_agent',
    'en cours': 'brouillon_agent',
    en_cours: 'brouillon_agent',
    termine: 'diagnostic_termine',
    diagnostic_termine: 'diagnostic_termine',
    'diagnostic terminé': 'diagnostic_termine',
    'diagnostic termine': 'diagnostic_termine',
    'à vérifier': 'a_verifier_responsable',
    'a verifier': 'a_verifier_responsable',
    a_verifier: 'a_verifier_responsable',
    a_verifier_responsable: 'a_verifier_responsable',
    validé: 'diagnostic_termine',
    valide: 'diagnostic_termine',
    valide_terrain: 'diagnostic_termine',
    valide_responsable: 'valide_responsable',
    programme_travaux: 'programme_travaux',
    travaux_realises: 'travaux_realises',
    archive: 'archive'
  };
  const normalized = map[raw] || STATUTS_LEGACY[raw] || raw;
  return STATUTS_DIAGNOSTIC.some((statut) => statut.value === normalized) ? normalized : 'brouillon_agent';
}

function appendJournal(db, action, details = {}) {
  const now = new Date();
  const entry = {
    id: `ACT-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    date: now.toISOString(),
    heure: now.toISOString().slice(11, 19),
    action,
    ancienneValeur: details.ancienneValeur ?? null,
    nouvelleValeur: details.nouvelleValeur ?? null,
    commentaire: details.commentaire || '',
    ...details
  };
  db.journalActions ||= [];
  db.historique_actions ||= [];
  db.journalActions.push(entry);
  db.historique_actions.push(entry);
  return entry;
}

function itemRef(item, referentiel) {
  const ref = referentiel[item] || referentiel[String(item || '').toLowerCase()] || {};
  const prixMoyen = Number(ref.prixMoyen ?? ref.prixBase ?? ref.prix ?? 0);
  return {
    poste: ref.posteTravaux || ref.poste || ref.categorie || item,
    categorie: ref.categorie || ref.poste || item,
    priorite: ref.priorite || 'moyenne',
    unite: ref.unite || 'forfait',
    libelleTravaux: ref.libelleTravaux || `Remise en état - ${item}`,
    prixBas: Number(ref.prixBas ?? prixMoyen),
    prixMoyen,
    prixHaut: Number(ref.prixHaut ?? prixMoyen),
    prixBase: prixMoyen,
    coefficientUrgence: ref.coefficientUrgence || {},
    coefficientSurface: Number(ref.coefficientSurface || 1),
    coefficientTypeLogement: ref.coefficientTypeLogement || {},
    dateMiseAJour: ref.dateMiseAJour || '',
    sourcePrix: ref.sourcePrix || '',
    coefficient: Number(ref.coefficient || 1)
  };
}

function estimateItem(item, logement, referentiel) {
  const etat = normalizeEtat(item.etat);
  const urgence = normalizeUrgence(item.urgence);
  const ref = itemRef(item.element || item.item, referentiel);
  const type = String(logement?.type_logement || '').toUpperCase();
  const typeCoef = Number(ref.coefficientTypeLogement?.[type] || TYPE_COEFS[type] || 1);
  const urgenceCoef = Number(ref.coefficientUrgence?.[urgence] || URGENCE_COEFS[urgence] || 1);
  const cout = Math.round(ref.prixMoyen * (ETAT_COEFS[etat] ?? 0) * urgenceCoef * typeCoef * ref.coefficientSurface * ref.coefficient);
  const factor = (ETAT_COEFS[etat] ?? 0) * urgenceCoef * typeCoef * ref.coefficientSurface * ref.coefficient;
  return {
    ...ref,
    etat,
    urgence,
    cout,
    coutBas: Math.round(ref.prixBas * factor),
    coutMoyen: cout,
    coutHaut: Math.round(ref.prixHaut * factor)
  };
}

function urgencyRank(value) {
  return { faible: 1, moyenne: 2, haute: 3, urgente: 4 }[normalizeUrgence(value)] || 1;
}

function globalUrgence(items) {
  if (items.some((i) => i.etat === 'dangereux' || i.urgence === 'urgente')) return 'urgente';
  if (items.some((i) => i.etat === 'tres_degrade' || i.urgence === 'haute')) return 'haute';
  if (items.some((i) => i.etat === 'degrade' || i.urgence === 'moyenne')) return 'moyenne';
  return 'faible';
}

function hydrateDiagnostic(body, existing = {}, db, referentiel) {
  const logementId = body.logementId || body.logement_id || existing.logementId || existing.logement_id;
  const logement = db.logements.find((l) => l.id === logementId);
  if (!logement) {
    const err = new Error('Logement introuvable');
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  let rawItems = Array.isArray(body.items) ? body.items : existing.items || [];
  if (!rawItems.length) {
    rawItems = generatedDiagnosticPayload(db, logementId, existing.items || [])?.items || [];
  }
  const items = rawItems.map((raw) => {
    const zone = raw.zone || '';
    const element = raw.element || raw.item || '';
    const estimated = estimateItem({ ...raw, element }, logement, referentiel);
    return {
      id: raw.id || `${zone}-${element}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      zone,
      element,
      typeSource: raw.typeSource || 'socle_logement',
      pieceId: raw.pieceId || null,
      pieceNom: raw.pieceNom || '',
      pieceType: raw.pieceType || '',
      etat: estimated.etat,
      urgence: estimated.urgence,
      commentaire: raw.commentaire || '',
      photos: raw.photos || [],
      travauxProposes: raw.travauxProposes || estimated.libelleTravaux,
      posteTravaux: estimated.poste,
      categorieTravaux: estimated.categorie,
      prioriteTravaux: estimated.priorite,
      unite: estimated.unite,
      prixBas: estimated.prixBas,
      prixMoyen: estimated.prixMoyen,
      prixHaut: estimated.prixHaut,
      coutBas: estimated.coutBas,
      coutMoyen: estimated.coutMoyen,
      coutHaut: estimated.coutHaut,
      coutEstimatif: estimated.cout
    };
  });

  const coutTotal = items.reduce((sum, item) => sum + Number(item.coutEstimatif || 0), 0);
  const coutParZone = items.reduce((acc, item) => {
    acc[item.zone] = (acc[item.zone] || 0) + Number(item.coutEstimatif || 0);
    return acc;
  }, {});
  const coutParPiece = items.reduce((acc, item) => {
    if (!item.pieceId) return acc;
    const key = item.pieceId;
    acc[key] ||= { pieceId: item.pieceId, pieceNom: item.pieceNom, cout: 0 };
    acc[key].cout += Number(item.coutEstimatif || 0);
    return acc;
  }, {});
  const urgenceGlobale = globalUrgence(items);
  const preconisations = preconisationsForDiagnostic({ items, urgenceGlobale });
  const agent = body.agent || existing.agent || db.users.find((u) => u.id === (body.agentId || existing.agentId)) || null;
  const statut = normalizeStatutDiagnostic(body.statut || existing.statut || 'brouillon_agent');
  const previousHistory = existing.historiqueModifications || [];

  return {
    ...existing,
    id: existing.id || `DIA-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    logementId: logement.id,
    logement_id: logement.id,
    agentId: body.agentId || agent?.id || existing.agentId || null,
    agent: agent ? { id: agent.id, prenom: agent.prenom || agent.nom || '', nom: agent.prenom || agent.nom || '', role: agent.role } : null,
    dateDebut: existing.dateDebut || body.dateDebut || now,
    dateModification: now,
    dateValidation: existing.dateValidation || body.dateValidation || null,
    date: existing.date || now,
    statut,
    historiqueModifications: previousHistory,
    journalActions: existing.journalActions || [],
    items,
    photos: body.photos || existing.photos || [],
    preconisations,
    commentaireGeneral: body.commentaireGeneral ?? body.commentaire_general ?? existing.commentaireGeneral ?? '',
    commentaire_general: body.commentaireGeneral ?? body.commentaire_general ?? existing.commentaire_general ?? '',
    coutTotal,
    cout_total_estime: coutTotal,
    coutParZone,
    coutParPiece: Object.values(coutParPiece),
    budgetActif: logement.dansParcActif ? coutTotal : 0,
    budgetTheorique: coutTotal,
    urgenceGlobale,
    priorite: urgenceGlobale,
    code_acces: logement.code_acces,
    code_lts: logement.code_lts,
    nom_lts: logement.nom_lts,
    secteur: logement.secteur,
    quartier: logement.quartier,
    adresse: logement.adresse,
    type_logement: logement.type_logement
  };
}

function findDiagnosticBlockingItem(diagnostic) {
  return (diagnostic.items || []).find((item) => {
    const needsPhoto = ['degrade', 'tres_degrade', 'dangereux'].includes(item.etat) && !(item.photos || []).length;
    const needsComment = item.etat === 'dangereux' && !String(item.commentaire || '').trim();
    return needsPhoto || needsComment;
  });
}

function latestDiagnostics(db) {
  const byLogement = new Map();
  for (const d of db.diagnostics) {
    const key = d.logementId || d.logement_id;
    const date = d.dateModification || d.date || '';
    if (!byLogement.has(key) || date > (byLogement.get(key).dateModification || byLogement.get(key).date || '')) {
      byLogement.set(key, d);
    }
  }
  return [...byLogement.values()];
}

function applyDiagnosticFilters(diagnostics, query) {
  return diagnostics.filter((d) => {
    if (query.secteur && d.secteur !== query.secteur) return false;
    if (query.code_lts && d.code_lts !== query.code_lts) return false;
    if (query.quartier && d.quartier !== query.quartier) return false;
    if (query.agent && d.agentId !== query.agent) return false;
    if (query.statut && normalizeStatutDiagnostic(d.statut) !== normalizeStatutDiagnostic(query.statut)) return false;
    if (query.urgence && d.urgenceGlobale !== query.urgence && d.priorite !== query.urgence) return false;
    if (query.date && !String(d.dateModification || d.date || '').startsWith(query.date)) return false;
    return true;
  });
}

function applyLogementPatrimoineFilters(logements, query) {
  return logements.filter((logement) => {
    if (query.patrimoine && logement.statutPatrimonial !== query.patrimoine) return false;
    if (query.parcActif === 'true' && !logement.dansParcActif) return false;
    if (query.parcActif === 'false' && logement.dansParcActif) return false;
    return true;
  });
}

function latestDiagnosticForLogement(db, logementId) {
  return db.diagnostics
    .filter((d) => (d.logementId || d.logement_id) === logementId)
    .sort((a, b) => String(b.dateModification || b.date).localeCompare(String(a.dateModification || a.date)))[0] || null;
}

function activeBudgetFor(db, diagnostic) {
  if (!diagnostic) return 0;
  const logement = db.logements.find((item) => item.id === (diagnostic.logementId || diagnostic.logement_id));
  return logement?.dansParcActif ? Number(diagnostic.coutTotal || diagnostic.cout_total_estime || 0) : 0;
}

function degradationStats(diagnostics = []) {
  const stats = { bon: 0, moyen: 0, degrade: 0, tres_degrade: 0, dangereux: 0, non_controle: 0, non_concerne: 0 };
  for (const diagnostic of diagnostics) {
    for (const item of diagnostic.items || []) stats[item.etat] = (stats[item.etat] || 0) + 1;
  }
  return stats;
}

function topWorkPosts(diagnostics = [], limit = 8) {
  const posts = {};
  for (const diagnostic of diagnostics) {
    for (const item of diagnostic.items || []) {
      const key = item.posteTravaux || item.categorieTravaux || item.element || 'Non renseigné';
      posts[key] = (posts[key] || 0) + Number(item.coutEstimatif || 0);
    }
  }
  return Object.entries(posts)
    .map(([poste, budget]) => ({ poste, budget }))
    .sort((a, b) => b.budget - a.budget)
    .slice(0, limit);
}

function priorityRows(diagnostics = [], limit = 10) {
  return diagnostics
    .map((diagnostic) => ({ ...diagnostic, rangUrgence: urgencyRank(diagnostic.urgenceGlobale || diagnostic.priorite) }))
    .sort((a, b) => b.rangUrgence - a.rangUrgence || Number(b.coutTotal || 0) - Number(a.coutTotal || 0))
    .slice(0, limit);
}

function consolidateLogement(logementId, db = loadDb()) {
  const logement = db.logements.find((item) => item.id === logementId);
  if (!logement) return null;
  const diagnostic = latestDiagnosticForLogement(db, logementId);
  return {
    logementId,
    code_acces: logement.code_acces,
    secteur: logement.secteur,
    code_lts: logement.code_lts,
    statutPatrimonial: logement.statutPatrimonial,
    dansParcActif: logement.dansParcActif,
    diagnostique: Boolean(diagnostic),
    diagnosticId: diagnostic?.id || null,
    dateDiagnostic: diagnostic?.dateModification || diagnostic?.date || null,
    agent: diagnostic?.agent || null,
    urgence: diagnostic?.urgenceGlobale || diagnostic?.priorite || 'non diagnostiqué',
    budgetTotal: Number(diagnostic?.coutTotal || 0),
    budgetActif: activeBudgetFor(db, diagnostic),
    budgetTheoriqueHorsParc: diagnostic && !logement.dansParcActif ? Number(diagnostic.coutTotal || 0) : 0,
    preconisations: diagnostic?.preconisations || preconisationsForDiagnostic(diagnostic || {})
  };
}

function consolidateGroup(db, logements, diagnostics) {
  const logementIds = new Set(logements.map((item) => item.id));
  const activeIds = new Set(logements.filter((item) => item.dansParcActif).map((item) => item.id));
  const horsParcIds = new Set(logements.filter((item) => !item.dansParcActif).map((item) => item.id));
  const diagnosticsScope = diagnostics.filter((diagnostic) => logementIds.has(diagnostic.logementId || diagnostic.logement_id));
  const budgetTotal = diagnosticsScope.reduce((sum, diagnostic) => sum + Number(diagnostic.coutTotal || 0), 0);
  const budgetParcActif = diagnosticsScope.filter((diagnostic) => activeIds.has(diagnostic.logementId || diagnostic.logement_id)).reduce((sum, diagnostic) => sum + Number(diagnostic.coutTotal || 0), 0);
  const budgetTheoriqueHorsParc = diagnosticsScope.filter((diagnostic) => horsParcIds.has(diagnostic.logementId || diagnostic.logement_id)).reduce((sum, diagnostic) => sum + Number(diagnostic.coutTotal || 0), 0);
  const urgents = diagnosticsScope.filter((diagnostic) => ['haute', 'urgente'].includes(diagnostic.urgenceGlobale || diagnostic.priorite)).length;
  const avancement = logements.length ? Math.round((diagnosticsScope.length / logements.length) * 100) : 0;
  return {
    totalLogements: logements.length,
    parcActif: activeIds.size,
    horsParc: horsParcIds.size,
    diagnostiques: diagnosticsScope.length,
    urgents,
    avancement,
    budgetTotal,
    budgetParcActif,
    budgetTheoriqueHorsParc,
    degradations: degradationStats(diagnosticsScope),
    topPostesTravaux: topWorkPosts(diagnosticsScope),
    topLogementsPrioritaires: priorityRows(diagnosticsScope),
    preconisations: strategicPreconisations({ urgents, budgetParcActif, budgetTheoriqueHorsParc, avancement })
  };
}

function consolidateLts(ltsId, db = loadDb()) {
  const logements = db.logements.filter((item) => item.code_lts === ltsId);
  return { code_lts: ltsId, nom_lts: logements[0]?.nom_lts || '', secteur: logements[0]?.secteur || '', ...consolidateGroup(db, logements, latestDiagnostics(db)) };
}

function consolidateSecteur(secteurId, db = loadDb()) {
  const logements = db.logements.filter((item) => item.secteur === secteurId);
  const base = consolidateGroup(db, logements, latestDiagnostics(db));
  const byLts = [...new Set(logements.map((item) => item.code_lts).filter(Boolean))].map((code) => consolidateLts(code, db));
  return { secteur: secteurId, lts: byLts, ...base };
}

function consolidateParc(db = loadDb()) {
  const latest = latestDiagnostics(db);
  const base = consolidateGroup(db, db.logements, latest);
  return {
    ...base,
    totalFichier: db.logements.length,
    locationPure: db.logements.filter((item) => item.statutPatrimonial === 'location_pure').length,
    enVente: db.logements.filter((item) => item.statutPatrimonial === 'en_vente').length,
    vendus: db.logements.filter((item) => item.statutPatrimonial === 'vendu').length,
    sortisDuParc: db.logements.filter((item) => item.statutPatrimonial === 'sorti_du_parc').length,
    budgetParSecteur: [...new Set(db.logements.map((item) => item.secteur).filter(Boolean))].map((secteur) => {
      const consolidated = consolidateSecteur(secteur, db);
      return { secteur, budget: consolidated.budgetTotal, budgetParcActif: consolidated.budgetParcActif, urgents: consolidated.urgents };
    }),
    budgetParLts: [...new Set(db.logements.map((item) => item.code_lts).filter(Boolean))].map((code_lts) => {
      const consolidated = consolidateLts(code_lts, db);
      return { code_lts, nom_lts: consolidated.nom_lts, budget: consolidated.budgetTotal, budgetParcActif: consolidated.budgetParcActif, urgents: consolidated.urgents };
    })
  };
}

function recalculateConsolidations(db, diagnostic) {
  const logementId = diagnostic.logementId || diagnostic.logement_id;
  db.consolidations ||= { logements: {}, lts: {}, secteurs: {}, parc: null };
  const logement = db.logements.find((item) => item.id === logementId);
  if (!logement) return;
  db.consolidations.logements[logementId] = consolidateLogement(logementId, db);
  db.consolidations.lts[logement.code_lts] = consolidateLts(logement.code_lts, db);
  db.consolidations.secteurs[logement.secteur] = consolidateSecteur(logement.secteur, db);
  db.consolidations.parc = consolidateParc(db);
}

function getLogementConfiguration(db, logementId) {
  const logement = db.logements.find((l) => l.id === logementId);
  if (!logement) return null;
  let configuration = db.configurations_logement.find((config) => config.logementId === logementId);
  if (!configuration) {
    configuration = createDefaultConfiguration(logement);
    db.configurations_logement.push(configuration);
  }
  const pieces = db.pieces_logement.filter((piece) => piece.logementId === logementId && !piece.archivedAt);
  return { logement, configuration, pieces };
}

function generatedDiagnosticPayload(db, logementId, existingItems = []) {
  const data = getLogementConfiguration(db, logementId);
  if (!data) return null;
  return {
    configuration: data.configuration,
    pieces: data.pieces,
    items: buildDiagnosticItemsFromConfiguration(data.logement, data.configuration, data.pieces, existingItems)
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(res, filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
}

function sendWorkbook(res, filename, sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31));
  }
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function photosForDiagnostic(db, diagnostic) {
  if (!diagnostic) return [];
  const urls = new Set((diagnostic.items || []).flatMap((item) => item.photos || []));
  return (db.photos || [])
    .filter((photo) => !photo.deletedAt && (photo.diagnosticId === diagnostic.id || urls.has(photo.url)))
    .sort((a, b) => String(a.zone).localeCompare(String(b.zone)) || String(a.element).localeCompare(String(b.element)) || String(a.date).localeCompare(String(b.date)));
}

function diagnosticPhotosHtml(db, diagnostic, title = 'Photos du diagnostic') {
  const photos = photosForDiagnostic(db, diagnostic);
  if (!photos.length) return '';
  const figures = photos.map((photo) => `
    <figure class="photoFigure">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.element || 'Photo diagnostic')}">
      <figcaption>
        <b>${escapeHtml(photo.zone || 'Zone non renseignée')} - ${escapeHtml(photo.element || 'Élément non renseigné')}</b><br>
        ${escapeHtml(new Date(photo.date || photo.dateHeure).toLocaleString('fr-FR'))} - ${escapeHtml(photo.agentNom || photo.agentId || 'Agent non renseigné')}
      </figcaption>
    </figure>
  `).join('');
  return `<h2>${escapeHtml(title)}</h2><div class="photoReportGrid">${figures}</div>`;
}

const REPORT_LOGO = `
<svg class="reportLogo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 104" role="img" aria-label="DIAG-LTS Saint-Denis">
  <rect x="8" y="8" width="88" height="88" rx="16" fill="#1457a8"/>
  <path d="M28 72V32h30c10 0 18 8 18 18v22h-10V50c0-5-3-8-8-8H38v30H28Z" fill="#fff"/>
  <path d="M44 72V50h10v13h28v9H44Z" fill="#2fb36d"/>
  <circle cx="78" cy="30" r="7" fill="#f59e0b"/>
  <text x="114" y="48" fill="#142033" font-family="Arial, sans-serif" font-size="30" font-weight="900">DIAG-LTS</text>
  <text x="116" y="76" fill="#1457a8" font-family="Arial, sans-serif" font-size="18" font-weight="800">SAINT-DENIS</text>
</svg>`;

function officialHeader(title, author = 'DIAG-LTS') {
  return `<div class="officialHeader">${REPORT_LOGO}<div><h1>${escapeHtml(title)}</h1><p class="muted">Rapport institutionnel généré le ${new Date().toLocaleString('fr-FR')} - Auteur : ${escapeHtml(author)}</p></div></div>`;
}

function listHtml(items = []) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : item.message)}</li>`).join('')}</ul>`;
}

function diagnosticRowsHtml(diagnostic) {
  return (diagnostic?.items || []).map((item) => `<tr><td>${escapeHtml(item.pieceNom || item.zone)}</td><td>${escapeHtml(item.zone)}</td><td>${escapeHtml(item.element || item.item)}</td><td><span class="badge ${escapeHtml(item.etat)}">${escapeHtml(item.etat)}</span></td><td>${escapeHtml(item.urgence)}</td><td>${escapeHtml(item.travauxProposes || '')}</td><td>${escapeHtml(item.coutBas || 0)} €</td><td>${escapeHtml(item.coutMoyen || item.coutEstimatif || 0)} €</td><td>${escapeHtml(item.coutHaut || 0)} €</td></tr>`).join('');
}

function workRows(logements = [], diagnostics = []) {
  const latestByLogement = new Map(diagnostics.map((diagnostic) => [diagnostic.logementId || diagnostic.logement_id, diagnostic]));
  return logements.map((logement) => {
    const diagnostic = latestByLogement.get(logement.id);
    return `<tr><td>${escapeHtml(logement.code_acces)}</td><td>${escapeHtml(logement.nom_lts)}</td><td>${escapeHtml(logement.adresse)}</td><td>${escapeHtml(logement.statutPatrimonial)}</td><td>${logement.dansParcActif ? 'Actif' : 'Hors parc'}</td><td>${diagnostic ? escapeHtml(diagnostic.urgenceGlobale || diagnostic.priorite) : 'Non diagnostiqué'}</td><td>${diagnostic ? `${escapeHtml(diagnostic.coutTotal || 0)} €` : '-'}</td></tr>`;
  }).join('');
}

function summaryText(scope, consolidation) {
  return `${scope} compte ${consolidation.totalLogements} logement(s), dont ${consolidation.parcActif} dans le parc actif. ${consolidation.diagnostiques} diagnostic(s) sont disponibles, soit ${consolidation.avancement}% d'avancement. Le budget estimatif total est de ${consolidation.budgetTotal} €, dont ${consolidation.budgetParcActif} € à programmer sur parc actif.`;
}

function reportHtml(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>
body{font-family:Arial,sans-serif;color:#172033;margin:32px}h1{margin:0 0 8px}h2{margin-top:28px}.muted{color:#667085}.officialHeader{display:flex;align-items:center;gap:18px;border-bottom:3px solid #1457a8;padding-bottom:14px;margin-bottom:22px}.reportLogo{width:210px;height:auto;flex:0 0 auto}.synthese{margin:22px 0 28px;padding:18px 22px;background:#f7f9fc;border-left:4px solid #1457a8;border-radius:6px}.synthese h2{margin-top:0;margin-bottom:12px;color:#1457a8;font-size:18px}.synthese p{text-align:justify;line-height:1.55;margin:0 0 10px;font-size:13px}.synthese p:last-child{margin-bottom:0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi{border:1px solid #ddd;border-radius:8px;padding:12px;background:#fafafa}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;text-align:left;padding:8px;font-size:12px;vertical-align:top}th{background:#f1f5f9}.badge{font-weight:700;border-radius:999px;padding:3px 7px;background:#eef2f6}.badge.dangereux,.badge.tres_degrade,.badge.urgente{background:#b42318;color:#fff}.badge.degrade,.badge.haute{background:#ffebe7;color:#b42318}.photoReportGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:12px}.photoFigure{break-inside:avoid;margin:0;border:1px solid #ddd;border-radius:8px;padding:8px}.photoFigure img{width:100%;height:180px;object-fit:cover;border-radius:6px}.photoFigure figcaption{font-size:12px;color:#667085;margin-top:6px}.signatureGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.signatureBox{border:1px solid #bbb;border-radius:8px;min-height:92px;padding:10px}.print{position:fixed;right:24px;top:24px}@media print{.print{display:none}body{margin:12mm}.photoReportGrid{grid-template-columns:repeat(2,1fr)}} </style></head><body><button class="print" onclick="window.print()">Imprimer / PDF</button>${body}</body></html>`;
}

// Multer en mémoire : on traite le buffer puis on l'envoie sur Supabase (ou disque en fallback)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function saveUploadedFile(file) {
  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  if (supabase) {
    const url = await uploadFileToSupabase(filename, file.buffer, file.mimetype);
    return { filename, url, storage: 'supabase' };
  }
  // Fallback disque local
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, file.buffer);
  return { filename, url: `/uploads/${filename}`, storage: 'local' };
}

async function removeUploadedFile(filename) {
  if (!filename) return;
  if (supabase) {
    await deleteFileFromSupabase(filename);
    return;
  }
  try {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('[Storage] Local delete échec:', err.message);
  }
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(uploadDir));

app.use('/api', healthRoutes());
app.use('/api', authRoutes({ loadDb, saveDb }));

app.get('/api/meta', (req, res) => {
  const db = loadDb();
  res.json({
    template: db.diagnosticTemplate,
    referentielTravaux: loadReferentiel(),
    users: db.users.map((user) => ({
      id: user.id,
      prenom: user.prenom || '',
      service: user.service || '',
      role: user.role === 'chef' ? 'responsable' : user.role,
      actif: user.actif !== false
    })),
    etats: diagnosticMeta().etats,
    urgences: diagnosticMeta().urgences,
    statutsDiagnostic: diagnosticMeta().statuts,
    patrimoine: patrimoineMeta(),
    configurationLogement: configurationMeta()
  });
});

app.get('/api/secteurs', (req, res) => {
  const db = loadDb();
  res.json([...new Set(db.logements.map((l) => l.secteur).filter(Boolean))].sort());
});

app.get('/api/lts', (req, res) => {
  const db = loadDb();
  const { secteur } = req.query;
  res.json(db.lts.filter((l) => !secteur || l.secteur === secteur));
});

app.get('/api/logements', (req, res) => {
  const db = loadDb();
  const { secteur, code_lts, quartier, etat, occupation, patrimoine, parcActif, q } = req.query;
  const latestById = new Map(latestDiagnostics(db).map((d) => [d.logementId || d.logement_id, d]));
  let out = db.logements.map((l) => {
    const diagnostic = latestById.get(l.id);
    return {
      ...l,
      dernierDiagnostic: diagnostic || null,
      niveauUrgence: diagnostic?.urgenceGlobale || diagnostic?.priorite || 'faible',
      coutEstimeTotal: diagnostic?.coutTotal || diagnostic?.cout_total_estime || 0
    };
  });
  if (secteur) out = out.filter((l) => l.secteur === secteur);
  if (code_lts) out = out.filter((l) => l.code_lts === code_lts);
  if (quartier) out = out.filter((l) => l.quartier === quartier);
  if (etat) out = out.filter((l) => l.etat_general === etat);
  if (occupation) out = out.filter((l) => String(l.statut || '').toLowerCase().includes(String(occupation).toLowerCase()));
  if (patrimoine) out = out.filter((l) => l.statutPatrimonial === patrimoine);
  if (parcActif === 'true') out = out.filter((l) => l.dansParcActif);
  if (parcActif === 'false') out = out.filter((l) => !l.dansParcActif);
  if (q) {
    const needle = String(q).toLowerCase();
    out = out.filter((l) => `${l.code_acces} ${l.adresse} ${l.nom_lts} ${l.quartier} ${l.occupant?.nom || ''}`.toLowerCase().includes(needle));
  }
  res.json(out.slice(0, 1500));
});

app.get('/api/logements/:id', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const diagnostics = db.diagnostics
    .filter((d) => (d.logementId || d.logement_id) === logement.id)
    .sort((a, b) => String(b.dateModification || b.date).localeCompare(String(a.dateModification || a.date)));
  const photos = db.photos.filter((p) => p.logementId === logement.id && !p.deletedAt);
  const latest = diagnostics[0] || null;
  const configurationData = getLogementConfiguration(db, logement.id);
  res.json({
    logement: {
      ...logement,
      niveauUrgence: latest?.urgenceGlobale || latest?.priorite || 'faible',
      coutEstimeTotal: latest?.coutTotal || latest?.cout_total_estime || 0
    },
    configuration: configurationData?.configuration || null,
    pieces: configurationData?.pieces || [],
    diagnostics,
    photos
  });
});

app.get('/api/logements/:id/configuration', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const data = getLogementConfiguration(db, req.params.id);
  if (!data) return res.status(404).json({ message: 'Logement introuvable' });
  saveDb(db);
  res.json({ configuration: data.configuration, pieces: data.pieces });
});

app.put('/api/logements/:id/configuration', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const data = getLogementConfiguration(db, req.params.id);
  if (!data) return res.status(404).json({ message: 'Logement introuvable' });
  const index = db.configurations_logement.findIndex((config) => config.logementId === req.params.id);
  db.configurations_logement[index] = createDefaultConfiguration(data.logement, {
    ...data.configuration,
    ...req.body,
    dateModification: new Date().toISOString()
  });
  appendJournal(db, 'configuration_logement_modification', {
    logementId: req.params.id,
    agentId: req.body.agentId || '',
    agentNom: req.body.agentNom || '',
    nouvelleValeur: db.configurations_logement[index]
  });
  saveDb(db);
  res.json({ configuration: db.configurations_logement[index], pieces: data.pieces });
});

app.post('/api/logements/:id/pieces', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const data = getLogementConfiguration(db, req.params.id);
  if (!data) return res.status(404).json({ message: 'Logement introuvable' });
  const piece = createPiece(req.params.id, req.body);
  db.pieces_logement.push(piece);
  appendJournal(db, 'piece_logement_creation', {
    logementId: req.params.id,
    pieceId: piece.id,
    agentId: req.body.agentId || '',
    agentNom: req.body.agentNom || '',
    nouvelleValeur: piece
  });
  saveDb(db);
  res.status(201).json(piece);
});

app.put('/api/logements/:id/pieces/:pieceId', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const index = db.pieces_logement.findIndex((piece) => piece.logementId === req.params.id && piece.id === req.params.pieceId);
  if (index < 0) return res.status(404).json({ message: 'Pièce introuvable' });
  const previous = db.pieces_logement[index];
  db.pieces_logement[index] = createPiece(req.params.id, { ...previous, ...req.body, id: previous.id, dateCreation: previous.dateCreation });
  appendJournal(db, 'piece_logement_modification', {
    logementId: req.params.id,
    pieceId: previous.id,
    ancienneValeur: previous,
    nouvelleValeur: db.pieces_logement[index],
    agentId: req.body.agentId || '',
    agentNom: req.body.agentNom || ''
  });
  saveDb(db);
  res.json(db.pieces_logement[index]);
});

app.get('/api/logements/:id/diagnostic-template', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const latest = latestDiagnostics(db).find((diagnostic) => (diagnostic.logementId || diagnostic.logement_id) === req.params.id);
  const generated = generatedDiagnosticPayload(db, req.params.id, latest?.items || []);
  if (!generated) return res.status(404).json({ message: 'Logement introuvable' });
  res.json(generated);
});

app.put('/api/logements/:id/patrimoine', (req, res) => {
  const db = loadDb();
  const index = db.logements.findIndex((l) => l.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: 'Logement introuvable' });
  const statutPatrimonial = req.body.statutPatrimonial || db.logements[index].statutPatrimonial;
  if (!STATUTS_PATRIMONIAUX[statutPatrimonial]) {
    return res.status(400).json({ message: 'Statut patrimonial invalide' });
  }
  const sortie = ['sorti_du_parc', 'vendu'].includes(statutPatrimonial);
  db.logements[index] = {
    ...db.logements[index],
    statutPatrimonial,
    dansParcActif: isDansParcActif(statutPatrimonial),
    diagnosticObligatoire: isDiagnosticObligatoire(statutPatrimonial),
    budgetScope: budgetScope(statutPatrimonial),
    dateSortieParc: sortie ? (req.body.dateSortieParc || db.logements[index].dateSortieParc || new Date().toISOString().slice(0, 10)) : (req.body.dateSortieParc || ''),
    commentairePatrimonial: req.body.commentairePatrimonial ?? db.logements[index].commentairePatrimonial ?? ''
  };
  appendJournal(db, 'patrimoine_modification', {
    logementId: db.logements[index].id,
    agentId: req.body.agentId || '',
    agentNom: req.body.agentNom || '',
    statutPatrimonial
  });
  saveDb(db);
  res.json(db.logements[index]);
});

app.get('/api/diagnostics', (req, res) => {
  const db = loadDb();
  const out = applyDiagnosticFilters(db.diagnostics, req.query)
    .sort((a, b) => String(b.dateModification || b.date).localeCompare(String(a.dateModification || a.date)));
  res.json(out);
});

app.get('/api/diagnostics/:id', (req, res) => {
  const db = loadDb();
  const diagnostic = db.diagnostics.find((d) => d.id === req.params.id);
  if (!diagnostic) return res.status(404).json({ message: 'Diagnostic introuvable' });
  res.json(diagnostic);
});

app.post('/api/diagnostics', (req, res, next) => {
  try {
    const db = loadDb();
    const diagnostic = hydrateDiagnostic(req.body, {}, db, loadReferentiel());
    if (!['brouillon_agent', 'a_verifier_responsable'].includes(diagnostic.statut)) {
      const blockingItem = findDiagnosticBlockingItem(diagnostic);
      if (blockingItem) {
        return res.status(400).json({ message: `À compléter : photo obligatoire si dégradé et commentaire obligatoire si dangereux (${blockingItem.zone} - ${blockingItem.element}).` });
      }
    }
    const action = appendJournal(db, 'diagnostic_creation', {
      diagnosticId: diagnostic.id,
      logementId: diagnostic.logementId,
      agentId: diagnostic.agentId,
      agentNom: diagnostic.agent?.prenom || diagnostic.agent?.nom || ''
    });
    diagnostic.historiqueModifications.push(action);
    diagnostic.journalActions.push(action);
    db.diagnostics.push(diagnostic);
    if (!['brouillon_agent', 'a_verifier_responsable'].includes(diagnostic.statut)) recalculateConsolidations(db, diagnostic);
    saveDb(db);
    res.status(201).json(diagnostic);
  } catch (error) {
    next(error);
  }
});

app.put('/api/diagnostics/:id', (req, res, next) => {
  try {
    const db = loadDb();
    const index = db.diagnostics.findIndex((d) => d.id === req.params.id);
    if (index < 0) return res.status(404).json({ message: 'Diagnostic introuvable' });
    const diagnostic = hydrateDiagnostic(req.body, db.diagnostics[index], db, loadReferentiel());
    if (!['brouillon_agent', 'a_verifier_responsable'].includes(diagnostic.statut)) {
      const blockingItem = findDiagnosticBlockingItem(diagnostic);
      if (blockingItem) {
        return res.status(400).json({ message: `À compléter : photo obligatoire si dégradé et commentaire obligatoire si dangereux (${blockingItem.zone} - ${blockingItem.element}).` });
      }
    }
    const action = appendJournal(db, 'diagnostic_modification', {
      diagnosticId: diagnostic.id,
      logementId: diagnostic.logementId,
      agentId: req.body.agentId || diagnostic.agentId,
      agentNom: req.body.agent?.prenom || req.body.agent?.nom || diagnostic.agent?.prenom || diagnostic.agent?.nom || '',
      statut: diagnostic.statut
    });
    diagnostic.historiqueModifications.push(action);
    diagnostic.journalActions.push(action);
    db.diagnostics[index] = diagnostic;
    recalculateConsolidations(db, diagnostic);
    saveDb(db);
    res.json(diagnostic);
  } catch (error) {
    next(error);
  }
});

app.post('/api/diagnostics/:id/validate', (req, res, next) => {
  try {
    const db = loadDb();
    const index = db.diagnostics.findIndex((d) => d.id === req.params.id);
    if (index < 0) return res.status(404).json({ message: 'Diagnostic introuvable' });
    const diagnostic = hydrateDiagnostic({ ...db.diagnostics[index], statut: req.body?.statut || 'diagnostic_termine' }, db.diagnostics[index], db, loadReferentiel());
    const blockingItem = findDiagnosticBlockingItem(diagnostic);
    if (blockingItem) {
      return res.status(400).json({ message: `À compléter : photo obligatoire si dégradé et commentaire obligatoire si dangereux (${blockingItem.zone} - ${blockingItem.element}).` });
    }
    diagnostic.dateValidation = new Date().toISOString();
    db.validations ||= [];
    db.validations.push({
      id: `VAL-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      diagnosticId: diagnostic.id,
      logementId: diagnostic.logementId,
      utilisateurId: req.body?.agentId || diagnostic.agentId || '',
      statut: diagnostic.statut,
      commentaire: req.body?.commentaire || '',
      date: diagnostic.dateValidation
    });
    const action = appendJournal(db, 'diagnostic_validation', {
      diagnosticId: diagnostic.id,
      logementId: diagnostic.logementId,
      agentId: req.body?.agentId || diagnostic.agentId,
      agentNom: req.body?.agent?.prenom || req.body?.agent?.nom || diagnostic.agent?.prenom || diagnostic.agent?.nom || '',
      statut: diagnostic.statut
    });
    diagnostic.historiqueModifications.push(action);
    diagnostic.journalActions.push(action);
    db.diagnostics[index] = diagnostic;
    recalculateConsolidations(db, diagnostic);
    saveDb(db);
    res.json(diagnostic);
  } catch (error) {
    next(error);
  }
});

app.post('/api/uploads', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Photo manquante' });
    const stored = await saveUploadedFile(req.file);
    const db = loadDb();
    const agent = db.users.find((user) => user.id === req.body.agentId);
    const now = new Date().toISOString();
    const photo = {
      id: `PHO-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      url: stored.url,
      filename: stored.filename,
    originalName: req.file.originalname,
    logementId: req.body.logementId || '',
    diagnosticId: req.body.diagnosticId || '',
    zone: req.body.zone || '',
    element: req.body.element || '',
    pieceId: req.body.pieceId || '',
    elementId: req.body.elementId || '',
    agentId: req.body.agentId || '',
    agentNom: req.body.agentNom || agent?.prenom || agent?.nom || '',
    source: req.body.source || 'terrain',
    date: now,
    dateHeure: now
  };
  db.photos.push(photo);
  if (photo.diagnosticId) {
    const diagnostic = db.diagnostics.find((d) => d.id === photo.diagnosticId);
    if (diagnostic) {
      diagnostic.photos = [...(diagnostic.photos || []), photo];
      const item = (diagnostic.items || []).find((currentItem) => (
        currentItem.id === photo.elementId
        || (currentItem.zone === photo.zone && (currentItem.element || currentItem.item) === photo.element)
      ));
      if (item) item.photos = [...new Set([...(item.photos || []), photo.url])];
      diagnostic.dateModification = now;
    }
  }
  saveDb(db);
  res.status(201).json(photo);
  } catch (err) { next(err); }
});

app.delete('/api/uploads/:id', async (req, res, next) => {
  try {
    const db = loadDb();
    const photo = db.photos.find((p) => p.id === req.params.id || p.url === req.params.id);
    if (!photo) return res.status(404).json({ message: 'Photo introuvable' });
    photo.deletedAt = new Date().toISOString();
    appendJournal(db, 'photo_suppression', {
      photoId: photo.id,
      logementId: photo.logementId,
      diagnosticId: photo.diagnosticId,
      agentId: req.body?.agentId || photo.agentId || ''
    });
    for (const diagnostic of db.diagnostics) {
      diagnostic.photos = (diagnostic.photos || []).filter((diagnosticPhoto) => (
        typeof diagnosticPhoto === 'string'
          ? diagnosticPhoto !== photo.url
          : diagnosticPhoto?.url !== photo.url && diagnosticPhoto?.id !== photo.id
      ));
      for (const item of diagnostic.items || []) {
        item.photos = (item.photos || []).filter((url) => url !== photo.url);
      }
    }
    if (photo.filename) await removeUploadedFile(photo.filename);
    saveDb(db);
    res.json({ ok: true, photo });
  } catch (err) { next(err); }
});

app.post('/api/photos', upload.single('photo'), async (req, res, next) => {
  try {
  if (!req.file) return res.status(400).json({ message: 'Photo manquante' });
  const stored = await saveUploadedFile(req.file);
    res.json({ url: stored.url, filename: stored.filename });
  } catch (err) { next(err); }
});

app.get('/api/dashboard', (req, res) => {
  const db = loadDb();
  const diagnostics = applyDiagnosticFilters(db.diagnostics, req.query);
  const logementsFiltres = applyLogementPatrimoineFilters(db.logements, req.query);
  const logementsFiltresIds = new Set(logementsFiltres.map((logement) => logement.id));
  const logementsActifs = logementsFiltres.filter((logement) => logement.dansParcActif);
  const logementsDiagnosticObligatoire = logementsFiltres.filter((logement) => logement.diagnosticObligatoire);
  const logementsActifsIds = new Set(logementsActifs.map((logement) => logement.id));
  const logementsDiagnosticObligatoireIds = new Set(logementsDiagnosticObligatoire.map((logement) => logement.id));
  const latestAll = latestDiagnostics({ ...db, diagnostics }).filter((d) => logementsFiltresIds.has(d.logementId || d.logement_id));
  const latest = latestAll.filter((d) => logementsDiagnosticObligatoireIds.has(d.logementId || d.logement_id));
  const latestByLogement = new Map(latestAll.map((d) => [d.logementId || d.logement_id, d]));
  const totalFichier = db.logements.length;
  const total = logementsDiagnosticObligatoire.length;
  const diagnosed = latest.length;
  const inProgress = diagnostics.filter((d) => logementsDiagnosticObligatoireIds.has(d.logementId || d.logement_id) && ['brouillon_agent', 'a_verifier_responsable'].includes(normalizeStatutDiagnostic(d.statut))).length;
  const budget = latest.reduce((sum, d) => sum + Number(d.coutTotal || d.cout_total_estime || 0), 0);
  const budgetGlobal = latestAll.reduce((sum, d) => sum + Number(d.coutTotal || d.cout_total_estime || 0), 0);
  const budgetTheoriqueHorsParc = latestAll
    .filter((d) => !logementsActifsIds.has(d.logementId || d.logement_id))
    .reduce((sum, d) => sum + Number(d.coutTotal || d.cout_total_estime || 0), 0);
  const enVenteIds = new Set(logementsFiltres.filter((l) => l.statutPatrimonial === 'en_vente').map((l) => l.id));
  const budgetTheoriqueVente = latestAll
    .filter((d) => enVenteIds.has(d.logementId || d.logement_id))
    .reduce((sum, d) => sum + Number(d.coutTotal || d.cout_total_estime || 0), 0);
  const urgents = latest.filter((d) => ['haute', 'urgente', 'Urgente'].includes(d.urgenceGlobale || d.priorite)).length;
  const statsPatrimoine = Object.fromEntries(Object.keys(STATUTS_PATRIMONIAUX).map((statut) => [statut, logementsFiltres.filter((l) => l.statutPatrimonial === statut).length]));
  const logementsHorsParc = logementsFiltres.filter((l) => !l.dansParcActif);

  const bySecteur = {};
  const byLts = {};
  const byEtat = {};
  const byPoste = {};
  const todayByAgent = {};

  for (const logement of logementsDiagnosticObligatoire) {
    bySecteur[logement.secteur] ||= { secteur: logement.secteur, total: 0, diagnostiques: 0, budget: 0 };
    byLts[logement.code_lts] ||= { code_lts: logement.code_lts, nom_lts: logement.nom_lts, total: 0, diagnostiques: 0, budget: 0 };
    byEtat[logement.etat_general || 'non renseigné'] = (byEtat[logement.etat_general || 'non renseigné'] || 0) + 1;
    bySecteur[logement.secteur].total += 1;
    byLts[logement.code_lts].total += 1;
  }

  for (const d of latest) {
    if (bySecteur[d.secteur]) {
      bySecteur[d.secteur].diagnostiques += 1;
      bySecteur[d.secteur].budget += Number(d.coutTotal || d.cout_total_estime || 0);
    }
    if (byLts[d.code_lts]) {
      byLts[d.code_lts].diagnostiques += 1;
      byLts[d.code_lts].budget += Number(d.coutTotal || d.cout_total_estime || 0);
    }
    for (const item of d.items || []) {
      byPoste[item.posteTravaux || item.element || item.item] = (byPoste[item.posteTravaux || item.element || item.item] || 0) + Number(item.coutEstimatif || item.cout_estime || 0);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const d of diagnostics) {
    if (logementsActifsIds.has(d.logementId || d.logement_id) && String(d.dateModification || d.date || '').startsWith(today)) {
      const name = d.agent?.prenom || d.agent?.nom || d.agentId || 'Non attribué';
      todayByAgent[name] = (todayByAgent[name] || 0) + 1;
    }
  }

  const topPrioritaires = latest
    .map((d) => ({ ...d, rangUrgence: urgencyRank(d.urgenceGlobale || d.priorite) }))
    .sort((a, b) => b.rangUrgence - a.rangUrgence || Number(b.coutTotal || b.cout_total_estime || 0) - Number(a.coutTotal || a.cout_total_estime || 0))
    .slice(0, 10);

  res.json({
    total_logements: totalFichier,
    logementsTotalFichier: totalFichier,
    logementsActifsParc: total,
    logementsHorsParc: logementsHorsParc.length,
    logementsSortisParc: statsPatrimoine.sorti_du_parc,
    logementsEnVente: statsPatrimoine.en_vente,
    logementsLocationPure: statsPatrimoine.location_pure,
    logementsVendus: statsPatrimoine.vendu,
    logementsAVerifier: statsPatrimoine.a_verifier,
    diagnosticsARealiserParcActif: Math.max(total - diagnosed, 0),
    budgetTheoriqueVente,
    horsParcVente: {
      sortis: statsPatrimoine.sorti_du_parc,
      vendus: statsPatrimoine.vendu,
      enVente: statsPatrimoine.en_vente,
      budgetTheoriqueVente,
      logements: logementsHorsParc.slice(0, 20)
    },
    logementsDiagnostiques: diagnosed,
    diagnostiques: diagnosed,
    diagnosticsEnCours: inProgress,
    logementsUrgents: urgents,
    urgents,
    budgetTotalEstime: budget,
    budget_total_estime: budget,
    budgetGlobalEstime: budgetGlobal,
    budgetTheoriqueHorsParc,
    avancement: total ? Math.round((diagnosed / total) * 100) : 0,
    parSecteur: Object.values(bySecteur).sort((a, b) => String(a.secteur).localeCompare(String(b.secteur))),
    par_secteur: Object.values(bySecteur),
    parLts: Object.values(byLts).sort((a, b) => String(a.code_lts).localeCompare(String(b.code_lts))),
    budgetParSecteur: Object.values(bySecteur).map((row) => ({ secteur: row.secteur, montant: row.budget })).sort((a, b) => b.montant - a.montant),
    budgetParLts: Object.values(byLts).map((row) => ({ code_lts: row.code_lts, nom_lts: row.nom_lts, montant: row.budget })).sort((a, b) => b.montant - a.montant),
    repartitionEtat: Object.entries(byEtat).map(([etat, totalEtat]) => ({ etat, total: totalEtat })),
    budgetParPoste: Object.entries(byPoste).map(([poste, montant]) => ({ poste, montant })).sort((a, b) => b.montant - a.montant),
    budget_par_poste: Object.entries(byPoste).map(([poste, montant]) => ({ poste, montant })).sort((a, b) => b.montant - a.montant).slice(0, 12),
    diagnosticsDuJourParAgent: Object.entries(todayByAgent).map(([agent, totalAgent]) => ({ agent, total: totalAgent })),
    topPrioritaires,
    diagnostics_recents: diagnostics.slice(-10).reverse(),
    dernierDiagnosticParLogement: [...latestByLogement.values()]
  });
});

app.get('/api/consolidations/parc', (req, res) => {
  res.json(consolidateParc(loadDb()));
});

app.get('/api/consolidations/secteur/:secteur', (req, res) => {
  res.json(consolidateSecteur(req.params.secteur, loadDb()));
});

app.get('/api/consolidations/lts/:code', (req, res) => {
  res.json(consolidateLts(req.params.code, loadDb()));
});

app.get('/api/consolidations/logement/:id', (req, res) => {
  const consolidated = consolidateLogement(req.params.id, loadDb());
  if (!consolidated) return res.status(404).json({ message: 'Logement introuvable' });
  res.json(consolidated);
});

app.get('/api/exports/global-diagnostics.xlsx', (req, res) => {
  const db = loadDb();
  const rows = [['ID', 'Logement', 'LTS', 'Secteur', 'Quartier', 'Agent', 'Statut', 'Urgence', 'Coût total', 'Modification']];
  for (const d of applyDiagnosticFilters(db.diagnostics, req.query)) {
    rows.push([d.id, d.code_acces, d.nom_lts, d.secteur, d.quartier, d.agent?.prenom || d.agent?.nom || '', d.statut, d.urgenceGlobale || d.priorite, d.coutTotal || d.cout_total_estime || 0, d.dateModification || d.date]);
  }
  sendWorkbook(res, 'diagnostics-global.xlsx', { Diagnostics: rows });
});

app.get('/api/exports/travaux-estimes.xlsx', (req, res) => {
  const db = loadDb();
  const rows = [['Diagnostic', 'Logement', 'Zone', 'Élément', 'État', 'Urgence', 'Travaux proposés', 'Poste', 'Coût']];
  for (const d of applyDiagnosticFilters(db.diagnostics, req.query)) {
    for (const item of d.items || []) {
      rows.push([d.id, d.code_acces, item.zone, item.element || item.item, item.etat, item.urgence, item.travauxProposes || '', item.posteTravaux || '', item.coutEstimatif || item.cout_estime || 0]);
    }
  }
  sendWorkbook(res, 'travaux-estimes.xlsx', { Travaux: rows });
});

function travauxRowsForDiagnostics(diagnostics = []) {
  const rows = [['Diagnostic', 'Logement', 'LTS', 'Secteur', 'Zone', 'Élément', 'État', 'Urgence', 'Poste', 'Travaux', 'Prix bas', 'Prix moyen', 'Prix haut', 'Coût estimé']];
  for (const diagnostic of diagnostics) {
    for (const item of diagnostic.items || []) {
      rows.push([
        diagnostic.id,
        diagnostic.code_acces,
        diagnostic.nom_lts,
        diagnostic.secteur,
        item.zone,
        item.element || item.item,
        item.etat,
        item.urgence,
        item.posteTravaux || '',
        item.travauxProposes || '',
        item.coutBas || 0,
        item.coutMoyen || item.coutEstimatif || 0,
        item.coutHaut || 0,
        item.coutEstimatif || 0
      ]);
    }
  }
  return rows;
}

app.get('/api/exports/logement/:id-travaux.xlsx', (req, res) => {
  const db = loadDb();
  const diagnostic = latestDiagnosticForLogement(db, req.params.id);
  sendWorkbook(res, `travaux-logement-${req.params.id}.xlsx`, { Travaux: travauxRowsForDiagnostics(diagnostic ? [diagnostic] : []) });
});

app.get('/api/exports/lts/:code.xlsx', (req, res) => {
  const db = loadDb();
  const diagnostics = latestDiagnostics(db).filter((diagnostic) => diagnostic.code_lts === req.params.code);
  const consolidated = consolidateLts(req.params.code, db);
  const synthese = [
    ['Indicateur', 'Valeur'],
    ['Total logements', consolidated.totalLogements],
    ['Parc actif', consolidated.parcActif],
    ['Hors parc', consolidated.horsParc],
    ['Diagnostiqués', consolidated.diagnostiques],
    ['Urgents', consolidated.urgents],
    ['Budget total', consolidated.budgetTotal],
    ['Budget parc actif', consolidated.budgetParcActif],
    ['Budget théorique hors parc', consolidated.budgetTheoriqueHorsParc]
  ];
  sendWorkbook(res, `rapport-lts-${req.params.code}.xlsx`, { Synthese: synthese, Travaux: travauxRowsForDiagnostics(diagnostics) });
});

app.get('/api/exports/secteur/:secteur.xlsx', (req, res) => {
  const db = loadDb();
  const diagnostics = latestDiagnostics(db).filter((diagnostic) => diagnostic.secteur === req.params.secteur);
  const consolidated = consolidateSecteur(req.params.secteur, db);
  const ltsRows = [['LTS', 'Nom', 'Avancement', 'Urgents', 'Budget total', 'Budget actif'], ...consolidated.lts.map((row) => [row.code_lts, row.nom_lts, row.avancement, row.urgents, row.budgetTotal, row.budgetParcActif])];
  sendWorkbook(res, `rapport-secteur-${req.params.secteur}.xlsx`, { LTS: ltsRows, Travaux: travauxRowsForDiagnostics(diagnostics) });
});

app.get('/api/exports/global-parc.xlsx', (req, res) => {
  const db = loadDb();
  const consolidated = consolidateParc(db);
  const synthese = [
    ['Indicateur', 'Valeur'],
    ['Total fichier', consolidated.totalFichier],
    ['Parc actif', consolidated.parcActif],
    ['Hors parc', consolidated.horsParc],
    ['Location pure', consolidated.locationPure],
    ['En vente', consolidated.enVente],
    ['Diagnostiqués', consolidated.diagnostiques],
    ['Avancement', `${consolidated.avancement}%`],
    ['Budget total', consolidated.budgetTotal],
    ['Budget parc actif', consolidated.budgetParcActif]
  ];
  const secteurs = [['Secteur', 'Budget total', 'Budget actif', 'Urgents'], ...consolidated.budgetParSecteur.map((row) => [row.secteur, row.budget, row.budgetParcActif, row.urgents])];
  const lts = [['LTS', 'Nom', 'Budget total', 'Budget actif', 'Urgents'], ...consolidated.budgetParLts.map((row) => [row.code_lts, row.nom_lts, row.budget, row.budgetParcActif, row.urgents])];
  sendWorkbook(res, 'rapport-global-parc.xlsx', { Synthese: synthese, Secteurs: secteurs, LTS: lts, Travaux: travauxRowsForDiagnostics(latestDiagnostics(db)) });
});

app.get('/api/exports/global-diagnostics.csv', (req, res) => {
  const db = loadDb();
  const rows = [['ID', 'Logement', 'LTS', 'Secteur', 'Agent', 'Statut', 'Urgence', 'Coût total']];
  for (const d of applyDiagnosticFilters(db.diagnostics, req.query)) rows.push([d.id, d.code_acces, d.nom_lts, d.secteur, d.agent?.prenom || d.agent?.nom || '', d.statut, d.urgenceGlobale || d.priorite, d.coutTotal || d.cout_total_estime || 0]);
  sendCsv(res, 'diagnostics-global.csv', rows);
});

app.get('/api/exports/global-parc.pdf', (req, res) => {
  const db = loadDb();
  const consolidated = consolidateParc(db);
  const sectorRows = consolidated.budgetParSecteur.map((row) => `<tr><td>${escapeHtml(row.secteur)}</td><td>${row.budget} €</td><td>${row.budgetParcActif} €</td><td>${row.urgents}</td></tr>`).join('');
  const ltsRows = consolidated.budgetParLts.sort((a, b) => b.budget - a.budget).slice(0, 30).map((row) => `<tr><td>${escapeHtml(row.code_lts)}</td><td>${escapeHtml(row.nom_lts)}</td><td>${row.budget} €</td><td>${row.budgetParcActif} €</td><td>${row.urgents}</td></tr>`).join('');
  const topPostesRows = consolidated.topPostesTravaux.map((row) => `<tr><td>${escapeHtml(row.poste)}</td><td>${row.budget} €</td></tr>`).join('');
  const urgentRows = consolidated.topLogementsPrioritaires.map((diagnostic) => `<tr><td>${escapeHtml(diagnostic.code_acces)}</td><td>${escapeHtml(diagnostic.nom_lts)}</td><td>${escapeHtml(diagnostic.secteur)}</td><td>${escapeHtml(diagnostic.urgenceGlobale || diagnostic.priorite)}</td><td>${diagnostic.coutTotal || 0} €</td></tr>`).join('');
  const body = `${officialHeader('Rapport global parc', 'DIAG-LTS')}
    <p>${escapeHtml(summaryText('Le parc global', consolidated))}</p>
    <div class="grid"><div class="kpi">Total fichier<br><b>${consolidated.totalFichier}</b></div><div class="kpi">Parc actif<br><b>${consolidated.parcActif}</b></div><div class="kpi">Hors parc<br><b>${consolidated.horsParc}</b></div><div class="kpi">Avancement<br><b>${consolidated.avancement}%</b></div></div>
    <div class="grid"><div class="kpi">Location pure<br><b>${consolidated.locationPure}</b></div><div class="kpi">En vente<br><b>${consolidated.enVente}</b></div><div class="kpi">Budget total<br><b>${consolidated.budgetTotal} €</b></div><div class="kpi">Budget actif<br><b>${consolidated.budgetParcActif} €</b></div></div>
    <h2>Budget par secteur</h2><table><thead><tr><th>Secteur</th><th>Budget total</th><th>Budget actif</th><th>Urgents</th></tr></thead><tbody>${sectorRows}</tbody></table>
    <h2>Budget par LTS</h2><table><thead><tr><th>LTS</th><th>Nom</th><th>Budget total</th><th>Budget actif</th><th>Urgents</th></tr></thead><tbody>${ltsRows}</tbody></table>
    <h2>Principaux postes travaux</h2><table><thead><tr><th>Poste</th><th>Budget</th></tr></thead><tbody>${topPostesRows}</tbody></table>
    <h2>Logements les plus urgents</h2><table><thead><tr><th>Logement</th><th>LTS</th><th>Secteur</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${urgentRows}</tbody></table>
    <h2>Préconisations stratégiques</h2>${listHtml(consolidated.preconisations)}
    <h2>Plan d'intervention priorisé</h2><p>Prioriser les logements dangereux ou en urgence, puis programmer les postes les plus coûteux sur parc actif. Les logements vendus ou sortis du parc restent en annexe historique et sont exclus des budgets actifs.</p>`;
  res.type('html').send(reportHtml('Rapport global parc', body));
});

app.get('/api/exports/global-direction.pdf', (req, res) => {
  const db = loadDb();
  const diagnostics = latestDiagnostics(db);
  const actifs = db.logements.filter((l) => l.dansParcActif);
  const actifsIds = new Set(actifs.map((l) => l.id));
  const budgetActif = diagnostics
    .filter((d) => actifsIds.has(d.logementId || d.logement_id))
    .reduce((sum, d) => sum + Number(d.coutTotal || d.cout_total_estime || 0), 0);
  const rows = diagnostics.slice(0, 40).map((d) => `<tr><td>${d.code_acces}</td><td>${d.nom_lts}</td><td>${d.secteur}</td><td>${d.statut}</td><td>${d.urgenceGlobale || d.priorite}</td><td>${d.coutTotal || d.cout_total_estime || 0} €</td></tr>`).join('');
  res.type('html').send(reportHtml('Rapport global direction', `${officialHeader('Rapport global direction', 'DIAG-LTS')}<div class="grid"><div class="kpi">Logements fichier<br><b>${db.logements.length}</b></div><div class="kpi">Parc actif<br><b>${actifs.length}</b></div><div class="kpi">Diagnostics<br><b>${diagnostics.length}</b></div><div class="kpi">Budget actif<br><b>${budgetActif} €</b></div></div><h2>Diagnostics récents</h2><table><thead><tr><th>Logement</th><th>LTS</th><th>Secteur</th><th>Statut</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${rows}</tbody></table><h2>Signatures</h2><div class="grid"><div class="kpi">Agent terrain<br><br></div><div class="kpi">Responsable<br><br></div><div class="kpi">Direction<br><br></div><div class="kpi">Date<br><br></div></div>`));
});

app.get('/api/exports/logement/:id.pdf', (req, res, next) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const configData = getLogementConfiguration(db, logement.id);
  const latest = latestDiagnosticForLogement(db, logement.id);
  const consolidation = consolidateLogement(logement.id, db);
  const rows = diagnosticRowsHtml(latest);
  const piecesRows = (configData?.pieces || []).map((piece) => `<tr><td>${escapeHtml(piece.nom)}</td><td>${escapeHtml(piece.type)}</td><td>${escapeHtml(piece.surfaceEstimee || 0)} m²</td><td>${escapeHtml((piece.elementsDiagnostic || []).join(', '))}</td></tr>`).join('');
  const photosSection = diagnosticPhotosHtml(db, latest);
  const syntheseParagraphs = redigerSyntheseExecutive({ logement, diagnostic: latest, consolidation });
  const syntheseHtml = syntheseParagraphs.length
    ? `<section class="synthese"><h2>Synthèse exécutive</h2>${syntheseParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</section>`
    : '';
  const body = `${officialHeader(`Rapport détaillé logement ${logement.code_acces}`, latest?.agent?.prenom || latest?.agent?.nom || 'DIAG-LTS')}
    ${syntheseHtml}
    <div class="grid"><div class="kpi">Secteur<br><b>${escapeHtml(logement.secteur)}</b></div><div class="kpi">LTS<br><b>${escapeHtml(logement.nom_lts)}</b></div><div class="kpi">Urgence<br><b>${escapeHtml(latest?.urgenceGlobale || 'Non diagnostiqué')}</b></div><div class="kpi">Budget estimatif<br><b>${escapeHtml(latest?.coutTotal || 0)} €</b></div></div>
    <h2>Identité du logement</h2><table><tbody><tr><th>Adresse</th><td>${escapeHtml(logement.adresse)}</td><th>Type</th><td>${escapeHtml(logement.type_logement || '')}</td></tr><tr><th>Statut patrimonial</th><td>${escapeHtml(logement.statutPatrimonial || '')}</td><th>Parc actif</th><td>${logement.dansParcActif ? 'Oui' : 'Non'}</td></tr><tr><th>Date diagnostic</th><td>${latest ? escapeHtml(new Date(latest.dateModification || latest.date).toLocaleString('fr-FR')) : 'Non diagnostiqué'}</td><th>Agent</th><td>${escapeHtml(latest?.agent?.prenom || latest?.agent?.nom || 'Non renseigné')}</td></tr><tr><th>État général</th><td>${escapeHtml(logement.etat_general || '')}</td><th>Priorité</th><td>${escapeHtml(consolidation?.urgence || 'Non diagnostiqué')}</td></tr></tbody></table>
    <h2>Configuration réelle du logement</h2><p>Type théorique : <b>${escapeHtml(configData?.configuration?.typeLogementTheorique || '')}</b> · Configuration constatée : <b>${escapeHtml(configData?.configuration?.configurationReelleConstatee || 'Non renseignée')}</b></p><table><thead><tr><th>Pièce</th><th>Type</th><th>Surface</th><th>Éléments générés</th></tr></thead><tbody>${piecesRows}</tbody></table>
    <h2>Diagnostic détaillé par pièce / zone</h2>${latest ? `<table><thead><tr><th>Pièce</th><th>Zone</th><th>Élément</th><th>État</th><th>Urgence</th><th>Travaux / préconisation technique</th><th>Prix bas</th><th>Prix moyen</th><th>Prix haut</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Logement non diagnostiqué.</p>'}
    <h2>Préconisations automatiques</h2>${listHtml(latest?.preconisations || preconisationsForDiagnostic(latest || {}))}
    ${photosSection}
    <h2>Validation responsable</h2><p>Statut : <b>${escapeHtml(latest?.statut || 'Non diagnostiqué')}</b> · Date validation : <b>${latest?.dateValidation ? escapeHtml(new Date(latest.dateValidation).toLocaleString('fr-FR')) : 'Non validé'}</b></p>
    <h2>Signature / visa</h2><div class="signatureGrid"><div class="signatureBox">Agent terrain</div><div class="signatureBox">Responsable</div><div class="signatureBox">Direction</div></div>`;
  res.type('html').send(reportHtml(`Rapport logement ${escapeHtml(logement.code_acces)}`, body));
});

app.get('/api/exports/logement/:id.pdf.legacy', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const configData = getLogementConfiguration(db, logement.id);
  const diagnostics = db.diagnostics.filter((d) => (d.logementId || d.logement_id) === logement.id);
  const latest = diagnostics.sort((a, b) => String(b.dateModification || b.date).localeCompare(String(a.dateModification || a.date)))[0];
  const rows = (latest?.items || []).map((i) => `<tr><td>${i.zone}</td><td>${i.element || i.item}</td><td>${i.etat}</td><td>${i.urgence}</td><td>${i.travauxProposes || ''}</td><td>${i.coutEstimatif || 0} €</td></tr>`).join('');
  const piecesRows = (configData?.pieces || []).map((piece) => `<tr><td>${piece.nom}</td><td>${piece.type}</td><td>${piece.surfaceEstimee || 0} m²</td><td>${(piece.elementsDiagnostic || []).join(', ')}</td></tr>`).join('');
  res.type('html').send(reportHtml(`Fiche ${logement.code_acces}`, `<h1>Fiche logement ${logement.code_acces}</h1><p class="muted">${logement.nom_lts} - ${logement.adresse}</p><div class="grid"><div class="kpi">Secteur<br><b>${logement.secteur}</b></div><div class="kpi">Quartier<br><b>${logement.quartier}</b></div><div class="kpi">Urgence<br><b>${latest?.urgenceGlobale || 'faible'}</b></div><div class="kpi">Budget<br><b>${latest?.coutTotal || 0} €</b></div></div><h2>Configuration réelle</h2><p>Type théorique : <b>${configData?.configuration?.typeLogementTheorique || ''}</b> · Configuration constatée : <b>${configData?.configuration?.configurationReelleConstatee || 'Non renseignée'}</b></p><table><thead><tr><th>Pièce</th><th>Type</th><th>Surface</th><th>Éléments générés</th></tr></thead><tbody>${piecesRows}</tbody></table><h2>Diagnostic</h2><table><thead><tr><th>Zone</th><th>Élément</th><th>État</th><th>Urgence</th><th>Travaux</th><th>Coût</th></tr></thead><tbody>${rows}</tbody></table><h2>Signatures</h2><div class="grid"><div class="kpi">Agent terrain<br><br></div><div class="kpi">Responsable<br><br></div><div class="kpi">Direction<br><br></div><div class="kpi">Date<br><br></div></div>`));
});

app.get('/api/exports/lts/:code.pdf', (req, res) => {
  const db = loadDb();
  const logements = db.logements.filter((l) => l.code_lts === req.params.code);
  const latest = latestDiagnostics(db).filter((d) => d.code_lts === req.params.code);
  const consolidated = consolidateLts(req.params.code, db);
  const degradationRows = Object.entries(consolidated.degradations).map(([etat, total]) => `<tr><td>${escapeHtml(etat)}</td><td>${total}</td></tr>`).join('');
  const topPostesRows = consolidated.topPostesTravaux.map((row) => `<tr><td>${escapeHtml(row.poste)}</td><td>${escapeHtml(row.budget)} €</td></tr>`).join('');
  const priorityRowsHtml = consolidated.topLogementsPrioritaires.map((diagnostic) => `<tr><td>${escapeHtml(diagnostic.code_acces)}</td><td>${escapeHtml(diagnostic.adresse)}</td><td>${escapeHtml(diagnostic.urgenceGlobale || diagnostic.priorite)}</td><td>${escapeHtml(diagnostic.coutTotal || 0)} €</td></tr>`).join('');
  const photosSections = latest.slice(0, 8).map((diagnostic) => diagnosticPhotosHtml(db, diagnostic, `Photos - ${diagnostic.code_acces}`)).join('');
  const body = `${officialHeader(`Rapport consolidé LTS ${req.params.code}`, 'DIAG-LTS')}
    <p>${escapeHtml(summaryText(`La LTS ${req.params.code}`, consolidated))}</p>
    <div class="grid"><div class="kpi">Total logements<br><b>${consolidated.totalLogements}</b></div><div class="kpi">Parc actif<br><b>${consolidated.parcActif}</b></div><div class="kpi">Hors parc<br><b>${consolidated.horsParc}</b></div><div class="kpi">Diagnostiqués<br><b>${consolidated.diagnostiques}</b></div></div>
    <h2>Budgets</h2><div class="grid"><div class="kpi">Urgents<br><b>${consolidated.urgents}</b></div><div class="kpi">Budget total<br><b>${consolidated.budgetTotal} €</b></div><div class="kpi">Budget parc actif<br><b>${consolidated.budgetParcActif} €</b></div><div class="kpi">Budget théorique hors parc<br><b>${consolidated.budgetTheoriqueHorsParc} €</b></div></div>
    <h2>Répartition des dégradations</h2><table><thead><tr><th>État</th><th>Nombre d'éléments</th></tr></thead><tbody>${degradationRows}</tbody></table>
    <h2>Top postes travaux</h2><table><thead><tr><th>Poste</th><th>Budget</th></tr></thead><tbody>${topPostesRows}</tbody></table>
    <h2>Top logements prioritaires</h2><table><thead><tr><th>Logement</th><th>Adresse</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${priorityRowsHtml}</tbody></table>
    <h2>Préconisations globales LTS</h2>${listHtml(consolidated.preconisations)}
    <h2>Annexe logements</h2><table><thead><tr><th>Logement</th><th>LTS</th><th>Adresse</th><th>Statut patrimonial</th><th>Parc</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${workRows(logements, latest)}</tbody></table>${photosSections}`;
  res.type('html').send(reportHtml(`Rapport LTS ${escapeHtml(req.params.code)}`, body));
});

app.get('/api/exports/lts/:code.pdf.legacy', (req, res) => {
  const db = loadDb();
  const logements = db.logements.filter((l) => l.code_lts === req.params.code);
  const latest = latestDiagnostics(db).filter((d) => d.code_lts === req.params.code);
  const rows = logements.map((l) => {
    const d = latest.find((x) => (x.logementId || x.logement_id) === l.id);
    return `<tr><td>${l.code_acces}</td><td>${l.adresse}</td><td>${d?.statut || 'non diagnostiqué'}</td><td>${d?.urgenceGlobale || ''}</td><td>${d?.coutTotal || 0} €</td></tr>`;
  }).join('');
  res.type('html').send(reportHtml(`Rapport LTS ${req.params.code}`, `<h1>Rapport LTS ${req.params.code}</h1><p class="muted">${logements[0]?.nom_lts || ''}</p><table><thead><tr><th>Logement</th><th>Adresse</th><th>Statut</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${rows}</tbody></table>`));
});

app.get('/api/exports/secteur/:secteur.pdf', (req, res) => {
  const db = loadDb();
  const logements = db.logements.filter((l) => l.secteur === req.params.secteur);
  const latest = latestDiagnostics(db).filter((d) => d.secteur === req.params.secteur);
  const consolidated = consolidateSecteur(req.params.secteur, db);
  const ltsRows = consolidated.lts.map((row) => `<tr><td>${escapeHtml(row.code_lts)}</td><td>${escapeHtml(row.nom_lts)}</td><td>${row.avancement}%</td><td>${row.urgents}</td><td>${row.budgetTotal} €</td><td>${row.budgetParcActif} €</td></tr>`).join('');
  const patrimoineRows = Object.entries(STATUTS_PATRIMONIAUX).map(([statut]) => `<tr><td>${escapeHtml(statut)}</td><td>${logements.filter((logement) => logement.statutPatrimonial === statut).length}</td></tr>`).join('');
  const body = `${officialHeader(`Rapport consolidé secteur ${req.params.secteur}`, 'DIAG-LTS')}
    <p>${escapeHtml(summaryText(`Le secteur ${req.params.secteur}`, consolidated))}</p>
    <div class="grid"><div class="kpi">LTS<br><b>${consolidated.lts.length}</b></div><div class="kpi">Avancement<br><b>${consolidated.avancement}%</b></div><div class="kpi">Urgents<br><b>${consolidated.urgents}</b></div><div class="kpi">Budget actif<br><b>${consolidated.budgetParcActif} €</b></div></div>
    <h2>Budget et urgences par LTS</h2><table><thead><tr><th>Code LTS</th><th>Nom</th><th>Avancement</th><th>Urgents</th><th>Budget total</th><th>Budget actif</th></tr></thead><tbody>${ltsRows}</tbody></table>
    <h2>Répartition patrimoniale</h2><table><thead><tr><th>Statut</th><th>Logements</th></tr></thead><tbody>${patrimoineRows}</tbody></table>
    <h2>Préconisations budgétaires</h2>${listHtml(consolidated.preconisations)}
    <h2>Priorités d'intervention</h2><table><thead><tr><th>Logement</th><th>LTS</th><th>Adresse</th><th>Statut patrimonial</th><th>Parc</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${workRows(logements, latest)}</tbody></table>`;
  res.type('html').send(reportHtml(`Rapport secteur ${escapeHtml(req.params.secteur)}`, body));
});

app.get('/api/exports/secteur/:secteur.pdf.legacy', (req, res) => {
  const db = loadDb();
  const logements = db.logements.filter((l) => l.secteur === req.params.secteur);
  const latest = latestDiagnostics(db).filter((d) => d.secteur === req.params.secteur);
  const rows = logements.map((l) => {
    const d = latest.find((x) => (x.logementId || x.logement_id) === l.id);
    return `<tr><td>${l.code_acces}</td><td>${l.nom_lts}</td><td>${l.adresse}</td><td>${d?.statut || 'non diagnostiqué'}</td><td>${d?.urgenceGlobale || ''}</td><td>${d?.coutTotal || 0} €</td></tr>`;
  }).join('');
  res.type('html').send(reportHtml(`Rapport secteur ${req.params.secteur}`, `<h1>Rapport secteur ${req.params.secteur}</h1><table><thead><tr><th>Logement</th><th>LTS</th><th>Adresse</th><th>Statut</th><th>Urgence</th><th>Budget</th></tr></thead><tbody>${rows}</tbody></table>`));
});


// ============================================================================
// Devis (consultations entreprises)
// ============================================================================

const DEVIS_STATUTS = ['en_attente', 'recu', 'valide', 'refuse', 'realise'];

function findDevis(db, id) {
  return (db.devis || []).find((d) => d.id === id);
}

app.get('/api/devis', (req, res) => {
  const db = loadDb();
  let list = db.devis || [];
  const { logementId, statut, entreprise } = req.query;
  if (logementId) list = list.filter((d) => d.logementId === logementId);
  if (statut) list = list.filter((d) => d.statut === statut);
  if (entreprise) {
    const needle = String(entreprise).toLowerCase();
    list = list.filter((d) => String(d.entrepriseNom || '').toLowerCase().includes(needle));
  }
  list = [...list].sort((a, b) => String(b.dateDemande || b.createdAt || '').localeCompare(String(a.dateDemande || a.createdAt || '')));
  res.json(list);
});

app.get('/api/devis/:id', (req, res) => {
  const db = loadDb();
  const devis = findDevis(db, req.params.id);
  if (!devis) return res.status(404).json({ message: 'Devis introuvable' });
  res.json(devis);
});

app.post('/api/devis', (req, res) => {
  const db = loadDb();
  const body = req.body || {};
  if (!body.logementId) return res.status(400).json({ message: 'logementId requis' });
  const logement = db.logements.find((l) => l.id === body.logementId);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  if (!body.entrepriseNom) return res.status(400).json({ message: 'entrepriseNom requis' });
  const statut = DEVIS_STATUTS.includes(body.statut) ? body.statut : 'en_attente';
  const now = new Date().toISOString();
  const devis = {
    id: `DEV-${logement.id}-${Date.now()}`,
    logementId: logement.id,
    logementCode: logement.code_acces,
    entrepriseNom: String(body.entrepriseNom).trim(),
    entrepriseContact: String(body.entrepriseContact || '').trim(),
    entrepriseTelephone: String(body.entrepriseTelephone || '').trim(),
    entrepriseEmail: String(body.entrepriseEmail || '').trim(),
    postes: Array.isArray(body.postes) ? body.postes : [],
    montantHT: Number(body.montantHT || 0),
    montantTTC: Number(body.montantTTC || 0),
    dateDemande: body.dateDemande || now,
    dateReception: body.dateReception || null,
    dateValidation: body.dateValidation || null,
    statut,
    commentaire: String(body.commentaire || ''),
    createdAt: now,
    updatedAt: now,
    createdBy: body.createdBy || null
  };
  db.devis = db.devis || [];
  db.devis.push(devis);
  appendJournal(db, 'devis_cree', { devisId: devis.id, logementId: logement.id, entreprise: devis.entrepriseNom });
  saveDb(db);
  res.status(201).json(devis);
});

app.put('/api/devis/:id', (req, res) => {
  const db = loadDb();
  const devis = findDevis(db, req.params.id);
  if (!devis) return res.status(404).json({ message: 'Devis introuvable' });
  const body = req.body || {};
  const updatable = ['entrepriseNom', 'entrepriseContact', 'entrepriseTelephone', 'entrepriseEmail', 'postes', 'montantHT', 'montantTTC', 'dateDemande', 'dateReception', 'dateValidation', 'commentaire'];
  for (const key of updatable) {
    if (body[key] !== undefined) devis[key] = body[key];
  }
  if (body.statut && DEVIS_STATUTS.includes(body.statut)) {
    const ancien = devis.statut;
    devis.statut = body.statut;
    if (body.statut === 'recu' && !devis.dateReception) devis.dateReception = new Date().toISOString();
    if (body.statut === 'valide' && !devis.dateValidation) devis.dateValidation = new Date().toISOString();
    appendJournal(db, 'devis_statut_change', { devisId: devis.id, ancien, nouveau: body.statut });
  }
  devis.updatedAt = new Date().toISOString();
  saveDb(db);
  res.json(devis);
});

app.delete('/api/devis/:id', async (req, res, next) => {
  try {
    const db = loadDb();
    const idx = (db.devis || []).findIndex((d) => d.id === req.params.id);
    if (idx < 0) return res.status(404).json({ message: 'Devis introuvable' });
    const [removed] = db.devis.splice(idx, 1);
    if (removed.pdfFilename) await removeUploadedFile(removed.pdfFilename);
    appendJournal(db, 'devis_supprime', { devisId: removed.id });
    saveDb(db);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Upload du PDF du devis (PDF reçu de l'entreprise)
app.post('/api/devis/:id/upload', upload.single('devisPdf'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier manquant' });
    const db = loadDb();
    const devis = findDevis(db, req.params.id);
    if (!devis) return res.status(404).json({ message: 'Devis introuvable' });
    // Supprimer l'ancien fichier si existant
    if (devis.pdfFilename) {
      await removeUploadedFile(devis.pdfFilename);
    }
    const stored = await saveUploadedFile(req.file);
    devis.pdfFilename = stored.filename;
    devis.pdfUrl = stored.url;
    devis.pdfOriginalName = req.file.originalname;
    devis.updatedAt = new Date().toISOString();
    appendJournal(db, 'devis_pdf_upload', { devisId: devis.id, filename: stored.filename });
    saveDb(db);
    res.json(devis);
  } catch (err) { next(err); }
});

app.delete('/api/devis/:id/upload', async (req, res, next) => {
  try {
    const db = loadDb();
    const devis = findDevis(db, req.params.id);
    if (!devis) return res.status(404).json({ message: 'Devis introuvable' });
    if (devis.pdfFilename) await removeUploadedFile(devis.pdfFilename);
    delete devis.pdfFilename;
    delete devis.pdfUrl;
    delete devis.pdfOriginalName;
    devis.updatedAt = new Date().toISOString();
    appendJournal(db, 'devis_pdf_supprime', { devisId: devis.id });
    saveDb(db);
    res.json(devis);
  } catch (err) { next(err); }
});


// ============================================================================
// Archive diagnostics par année
// ============================================================================

app.get('/api/archive/diagnostics', (req, res) => {
  const db = loadDb();
  const annee = req.query.annee ? Number(req.query.annee) : null;
  const secteur = req.query.secteur || null;
  const logementsById = new Map(db.logements.map((l) => [l.id, l]));
  const grouped = {};
  for (const diag of db.diagnostics || []) {
    const date = diag.dateModification || diag.dateValidation || diag.date;
    if (!date) continue;
    const year = new Date(date).getFullYear();
    if (annee && year !== annee) continue;
    const logement = logementsById.get(diag.logementId || diag.logement_id);
    if (!logement) continue;
    if (secteur && logement.secteur !== secteur) continue;
    grouped[year] = grouped[year] || [];
    grouped[year].push({
      id: diag.id,
      logementId: logement.id,
      code_acces: logement.code_acces,
      adresse: logement.adresse,
      secteur: logement.secteur,
      code_lts: logement.code_lts,
      statutPatrimonial: logement.statutPatrimonial,
      dateDiagnostic: date,
      statut: diag.statut,
      urgenceGlobale: diag.urgenceGlobale || diag.priorite,
      coutTotal: Number(diag.coutTotal || 0),
      agent: diag.agent?.prenom || diag.agent?.nom || null
    });
  }
  // Trier chaque année par date décroissante
  for (const year in grouped) {
    grouped[year].sort((a, b) => String(b.dateDiagnostic).localeCompare(String(a.dateDiagnostic)));
  }
  // Retourner trié par année décroissante
  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);
  const payload = years.map((y) => ({
    annee: y,
    count: grouped[y].length,
    budgetTotal: grouped[y].reduce((s, d) => s + d.coutTotal, 0),
    diagnostics: grouped[y]
  }));
  res.json(payload);
});

app.get('/api/archive/logement/:id/historique', (req, res) => {
  const db = loadDb();
  const logement = db.logements.find((l) => l.id === req.params.id);
  if (!logement) return res.status(404).json({ message: 'Logement introuvable' });
  const diags = (db.diagnostics || [])
    .filter((d) => (d.logementId || d.logement_id) === logement.id)
    .map((d) => ({
      id: d.id,
      date: d.dateModification || d.dateValidation || d.date,
      annee: new Date(d.dateModification || d.dateValidation || d.date).getFullYear(),
      statut: d.statut,
      urgenceGlobale: d.urgenceGlobale || d.priorite,
      coutTotal: Number(d.coutTotal || 0),
      itemsCount: (d.items || []).length,
      itemsDegrades: (d.items || []).filter((i) => ['degrade', 'tres_degrade', 'dangereux'].includes(i.etat)).length,
      agent: d.agent?.prenom || d.agent?.nom || null
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json({ logement: { id: logement.id, code_acces: logement.code_acces, adresse: logement.adresse }, historique: diags });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Erreur serveur' });
});

app.listen(PORT, () => console.log(`DIAG-LTS API sur http://localhost:${PORT}`));
