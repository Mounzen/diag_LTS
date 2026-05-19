export const TYPES_PIECES = [
  { value: 'chambre', label: 'Chambre' },
  { value: 'sejour', label: 'Séjour' },
  { value: 'piece_supplementaire', label: 'Pièce supplémentaire' },
  { value: 'bureau', label: 'Bureau' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'salle_eau', label: "Salle d'eau" },
  { value: 'salle_de_bain', label: 'Salle de bain' },
  { value: 'wc', label: 'WC' },
  { value: 'varangue', label: 'Varangue' },
  { value: 'terrasse', label: 'Terrasse' },
  { value: 'dependance', label: 'Dépendance' },
  { value: 'garage', label: 'Garage' },
  { value: 'cour', label: 'Cour' },
  { value: 'autre', label: 'Autre' }
];

export const ELEMENTS_PAR_TYPE_PIECE = {
  chambre: [
    'Porte chambre',
    'Fenêtre chambre',
    'Sol chambre',
    'Murs chambre',
    'Plafond chambre',
    'Peinture chambre',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité / moisissures'
  ],
  sejour: [
    'Porte séjour',
    'Fenêtres séjour',
    'Sol séjour',
    'Murs séjour',
    'Plafond séjour',
    'Peinture séjour',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité / moisissures'
  ],
  piece_supplementaire: [
    'Porte',
    'Fenêtre',
    'Sol',
    'Murs',
    'Plafond',
    'Peinture',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité',
    'Usage constaté'
  ],
  bureau: [
    'Porte bureau',
    'Fenêtre bureau',
    'Sol bureau',
    'Murs bureau',
    'Plafond bureau',
    'Peinture',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité'
  ],
  cuisine: [
    'Porte cuisine',
    'Jalousie cuisine',
    'Sol cuisine',
    'Murs cuisine',
    'Plafond cuisine',
    'Faïence cuisine',
    'Évier',
    'Robinetterie cuisine',
    'Plan de travail',
    'Meubles cuisine',
    'Plomberie cuisine',
    'Évacuation cuisine',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité'
  ],
  salle_eau: [
    'Porte salle d\'eau',
    'Jalousie salle d\'eau',
    'Sol salle d\'eau',
    'Murs salle d\'eau',
    'Plafond salle d\'eau',
    'Faïence',
    'Douche',
    'Lavabo',
    'Robinetterie',
    'Plomberie',
    'Évacuation',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité / moisissures'
  ],
  salle_de_bain: [
    'Porte salle de bain',
    'Jalousie salle de bain',
    'Sol salle de bain',
    'Murs salle de bain',
    'Plafond salle de bain',
    'Faïence',
    'Douche',
    'Lavabo',
    'Robinetterie',
    'Plomberie',
    'Évacuation',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation',
    'Humidité / moisissures'
  ],
  wc: [
    'Porte WC',
    'Jalousie WC',
    'Sol WC',
    'Murs WC',
    'Plafond WC',
    'WC (cuvette)',
    'Chasse d\'eau',
    'Évacuation WC',
    'Interrupteurs',
    'Luminaire / point lumineux',
    'Ventilation'
  ],
  varangue: [
    'Sol varangue',
    'Murs varangue',
    'Plafond varangue',
    'Garde-corps',
    'Prises électriques',
    'Luminaire / point lumineux',
    'Évacuation',
    'Sécurité'
  ],
  terrasse: [
    'Sol terrasse',
    'Garde-corps',
    'Évacuation',
    'Étanchéité terrasse',
    'Sécurité',
    'Accessibilité'
  ],
  dependance: [
    'Porte',
    'Fenêtre',
    'Sol',
    'Murs',
    'Plafond',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire',
    'Ventilation',
    'Sécurité'
  ],
  garage: [
    'Porte garage',
    'Sol garage',
    'Murs',
    'Plafond',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire',
    'Ventilation',
    'Sécurité'
  ],
  cour: [
    'Sol cour',
    'Évacuation cour',
    'Clôture',
    'Portail',
    'Sécurité',
    'Accessibilité'
  ],
  autre: [
    'Porte',
    'Fenêtre',
    'Sol',
    'Murs',
    'Plafond',
    'Prises électriques',
    'Interrupteurs',
    'Luminaire',
    'Ventilation',
    'Usage constaté'
  ]
};

export const DIAGNOSTIC_SOCLE_LOGEMENT = [
  { zone: 'Extérieur', elements: ['Façade', 'Peinture extérieure'] },
  { zone: 'Toiture / étanchéité', elements: ['Toiture', 'Étanchéité', 'Eaux pluviales'] },
  { zone: 'Évacuation / assainissement', elements: ['Évacuation', 'Assainissement'] },
  { zone: 'Entrée / menuiserie', elements: ['Porte entrée', 'Menuiserie'] },
  { zone: 'Structure intérieure', elements: ['Sols', 'Murs', 'Peinture intérieure', 'Plafonds', 'Faux plafonds'] },
  { zone: 'Réseaux', elements: ['Électricité', 'Plomberie', 'Ventilation', 'Humidité'] },
  { zone: 'Pièces techniques', elements: ['Cuisine', 'Salle de bain', 'WC'] },
  { zone: 'Sécurité / accessibilité', elements: ['Sécurité', 'Accessibilité', 'Risques occupants'] }
];

// Éléments spécifiques selon le contexte du logement
export const ELEMENTS_TOITURE_TOLE = ['Tôles couverture', 'Faîtage tôle', 'Fixations / boulons', 'Corrosion tôle', 'Solins / arêtiers'];
export const ELEMENTS_COUR_AVANT_RDC = ['Courette avant', 'Portillon avant', 'Clôture avant', 'Accès / cheminement avant'];
export const ELEMENTS_COUR_ARRIERE_RDC = ['Cour arrière', 'Clôture arrière', 'Portillon arrière'];
export const ELEMENTS_ACCES_ETAGE = ['Escalier d\'accès', 'Palier', 'Balcon / loggia', 'Garde-corps balcon'];

export function buildContextualSections(logement = {}) {
  const sections = [];
  // Toiture tôle (universel par défaut)
  const couverture = logement.couverture || 'tole';
  if (couverture === 'tole') {
    sections.push({ zone: 'Toiture tôle', elements: ELEMENTS_TOITURE_TOLE });
  }
  // Étage : cours pour RDC, balcon pour étages
  const etage = logement.etage || 'RDC';
  const hasCours = logement.hasCours !== false;
  if (etage === 'RDC' && hasCours) {
    sections.push({ zone: 'Cour avant (RDC)', elements: ELEMENTS_COUR_AVANT_RDC });
    sections.push({ zone: 'Cour arrière (RDC)', elements: ELEMENTS_COUR_ARRIERE_RDC });
  } else if (etage && etage !== 'RDC') {
    sections.push({ zone: 'Accès étage', elements: ELEMENTS_ACCES_ETAGE });
  }
  return sections;
}

export function createDefaultConfiguration(logement = {}, existing = {}) {
  return {
    id: existing.id || `CFG-${logement.id}`,
    logementId: logement.id,
    typeLogementTheorique: existing.typeLogementTheorique || logement.type_logement || '',
    configurationReelleConstatee: existing.configurationReelleConstatee || '',
    nombreChambres: Number(existing.nombreChambres ?? 0),
    nombrePiecesSupplementaires: Number(existing.nombrePiecesSupplementaires ?? 0),
    sejour: Boolean(existing.sejour ?? true),
    cuisine: Boolean(existing.cuisine ?? true),
    salleDeBain: Boolean(existing.salleDeBain ?? true),
    wc: Boolean(existing.wc ?? true),
    varangueTerrasse: Boolean(existing.varangueTerrasse ?? false),
    dependance: Boolean(existing.dependance ?? false),
    cour: Boolean(existing.cour ?? false),
    garageAbri: Boolean(existing.garageAbri ?? false),
    autrePiece: existing.autrePiece || '',
    commentaire: existing.commentaire || '',
    dateModification: existing.dateModification || new Date().toISOString()
  };
}

export function createPiece(logementId, payload = {}) {
  const type = ELEMENTS_PAR_TYPE_PIECE[payload.type] ? payload.type : 'autre';
  const now = new Date().toISOString();
  return {
    id: payload.id || `PIE-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    logementId,
    nom: payload.nom || TYPES_PIECES.find((piece) => piece.value === type)?.label || 'Pièce',
    type,
    surfaceEstimee: Number(payload.surfaceEstimee || 0),
    commentaire: payload.commentaire || '',
    elementsDiagnostic: [...ELEMENTS_PAR_TYPE_PIECE[type]],
    archivedAt: payload.archivedAt || null,
    dateCreation: payload.dateCreation || now,
    dateModification: now
  };
}

export function ensureConfigurationCollections(db) {
  db.configurations_logement ||= [];
  db.pieces_logement ||= [];
  for (const logement of db.logements || []) {
    if (!db.configurations_logement.some((config) => config.logementId === logement.id)) {
      db.configurations_logement.push(createDefaultConfiguration(logement));
    }
  }
  return db;
}

function itemId(parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function buildDiagnosticItemsFromConfiguration(logement, configuration, pieces = [], existingItems = []) {
  const byId = new Map(existingItems.map((item) => [item.id, item]));
  const generated = [];

  // Socle commun + sections contextuelles (toiture tôle, cours RDC ou accès étage)
  const allSections = [...DIAGNOSTIC_SOCLE_LOGEMENT, ...buildContextualSections(logement)];
  for (const group of allSections) {
    for (const element of group.elements) {
      const id = itemId(['socle', group.zone, element]);
      generated.push({
        id,
        zone: group.zone,
        element,
        typeSource: 'socle_logement',
        pieceId: null,
        pieceNom: '',
        etat: 'non_controle',
        urgence: 'faible',
        commentaire: '',
        photos: [],
        ...byId.get(id)
      });
    }
  }

  for (const piece of pieces.filter((p) => p.logementId === logement.id && !p.archivedAt)) {
    // Fusion intelligente : éléments existants + nouveaux du template (sans doublons)
    const templateElements = ELEMENTS_PAR_TYPE_PIECE[piece.type] || [];
    const existingElements = piece.elementsDiagnostic || [];
    const allElements = [...new Set([...existingElements, ...templateElements])];
    for (const element of allElements) {
      const id = itemId(['piece', piece.id, element]);
      generated.push({
        id,
        zone: `Pièce - ${piece.nom}`,
        element,
        typeSource: 'piece_logement',
        pieceId: piece.id,
        pieceNom: piece.nom,
        pieceType: piece.type,
        etat: 'non_controle',
        urgence: 'faible',
        commentaire: '',
        photos: [],
        ...byId.get(id)
      });
    }
  }

  return generated;
}

export function configurationMeta() {
  return {
    typesPieces: TYPES_PIECES,
    elementsParTypePiece: ELEMENTS_PAR_TYPE_PIECE,
    socleDiagnostic: DIAGNOSTIC_SOCLE_LOGEMENT
  };
}
