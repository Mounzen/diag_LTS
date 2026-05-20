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
    'Sol chambre',
    'Murs chambre',
    'Plafond chambre',
    'Peinture chambre',
    'Luminaire / point lumineux',
    'Interrupteurs',
    'Prises électriques',
    'Fenêtre chambre',
    'Ventilation',
    'Humidité / moisissures'
  ],
  sejour: [
    'Porte séjour',
    'Sol séjour',
    'Murs séjour',
    'Plafond séjour',
    'Peinture séjour',
    'Luminaire / point lumineux',
    'Interrupteurs',
    'Prises électriques',
    'Fenêtres séjour',
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
    'Sol cuisine',
    'Murs cuisine',
    'Plafond cuisine',
    'Faïence cuisine',
    'Luminaire / point lumineux',
    'Interrupteurs',
    'Prises électriques',
    'Jalousie cuisine',
    'Évier',
    'Robinetterie cuisine',
    'Plan de travail',
    'Meubles cuisine',
    'Plomberie cuisine',
    'Évacuation cuisine',
    'Ventilation',
    'Humidité'
  ],
  salle_eau: [
    'Porte salle d\'eau',
    'Sol salle d\'eau',
    'Murs salle d\'eau',
    'Plafond salle d\'eau',
    'Faïence',
    'Luminaire / point lumineux',
    'Interrupteurs',
    'Prises électriques',
    'Jalousie salle d\'eau',
    'Douche',
    'Lavabo',
    'Robinetterie',
    'Plomberie',
    'Évacuation',
    'Ventilation',
    'Humidité / moisissures'
  ],
  salle_de_bain: [
    'Porte salle de bain',
    'Sol salle de bain',
    'Murs salle de bain',
    'Plafond salle de bain',
    'Faïence',
    'Luminaire / point lumineux',
    'Interrupteurs',
    'Prises électriques',
    'Jalousie salle de bain',
    'Douche',
    'Lavabo',
    'Robinetterie',
    'Plomberie',
    'Évacuation',
    'Ventilation',
    'Humidité / moisissures'
  ],
  wc: [
    'Porte WC',
    'Sol WC',
    'Murs WC',
    'Plafond WC',
    'Luminaire / point lumineux',
    'Interrupteurs',
    'Jalousie WC',
    'WC (cuvette)',
    'Chasse d\'eau',
    'Évacuation WC',
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

// Ordonné comme un parcours d'arrivée : on voit la façade, on passe le portillon,
// on entre par la porte, on parcourt les pièces (gérées séparément via ELEMENTS_PAR_TYPE_PIECE),
// puis sécurité/réseaux globaux.
export const DIAGNOSTIC_SOCLE_LOGEMENT = [
  { zone: '1. Façade et toiture (vue arrivée)', elements: ['Façade', 'Peinture extérieure'] },
  { zone: '2. Entrée / menuiserie', elements: ['Porte entrée', 'Menuiserie'] },
  { zone: '3. Toiture / étanchéité', elements: ['Toiture', 'Étanchéité', 'Eaux pluviales'] },
  { zone: '4. Réseaux globaux', elements: ['Électricité', 'Plomberie', 'Ventilation', 'Humidité'] },
  { zone: '5. Évacuation / assainissement', elements: ['Évacuation', 'Assainissement'] },
  { zone: '6. Sécurité / accessibilité', elements: ['Sécurité', 'Accessibilité', 'Risques occupants'] }
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

// Génère automatiquement les pièces par défaut selon le type T1/T2/T3/T4/T5/T6 du logement
// Les pièces sont retournées dans l'ordre du parcours visuel : Séjour → Cuisine → Chambres → SDB → WC
function generateDefaultPieces(logement) {
  const type = String(logement.type_logement || '').toUpperCase().trim();
  const nbChambres = ({ T1: 1, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 }[type]) || 1;
  const hasSejour = type !== 'T1';
  const now = new Date().toISOString();
  const pieces = [];
  let ordre = 0;

  // 1. Séjour (en premier dans le parcours, sauf T1)
  if (hasSejour) {
    pieces.push({
      id: `PIE-${logement.id}-SEJOUR`, logementId: logement.id, nom: 'Séjour',
      type: 'sejour', surfaceEstimee: 0, commentaire: '',
      elementsDiagnostic: [...ELEMENTS_PAR_TYPE_PIECE.sejour],
      archivedAt: null, dateCreation: now, dateModification: now,
      autoGenerated: true, ordre: ++ordre
    });
  }
  // 2. Cuisine
  pieces.push({
    id: `PIE-${logement.id}-CUISINE`, logementId: logement.id, nom: 'Cuisine',
    type: 'cuisine', surfaceEstimee: 0, commentaire: '',
    elementsDiagnostic: [...ELEMENTS_PAR_TYPE_PIECE.cuisine],
    archivedAt: null, dateCreation: now, dateModification: now,
    autoGenerated: true, ordre: ++ordre
  });
  // 3. Chambres
  for (let i = 1; i <= nbChambres; i++) {
    pieces.push({
      id: `PIE-${logement.id}-CHAMBRE-${i}`, logementId: logement.id,
      nom: nbChambres > 1 ? `Chambre ${i}` : 'Chambre',
      type: 'chambre', surfaceEstimee: 0, commentaire: '',
      elementsDiagnostic: [...ELEMENTS_PAR_TYPE_PIECE.chambre],
      archivedAt: null, dateCreation: now, dateModification: now,
      autoGenerated: true, ordre: ++ordre
    });
  }
  // 4. Salle de bain
  pieces.push({
    id: `PIE-${logement.id}-SDB`, logementId: logement.id, nom: 'Salle de bain',
    type: 'salle_de_bain', surfaceEstimee: 0, commentaire: '',
    elementsDiagnostic: [...ELEMENTS_PAR_TYPE_PIECE.salle_de_bain],
    archivedAt: null, dateCreation: now, dateModification: now,
    autoGenerated: true, ordre: ++ordre
  });
  // 5. WC (en dernier)
  pieces.push({
    id: `PIE-${logement.id}-WC`, logementId: logement.id, nom: 'WC',
    type: 'wc', surfaceEstimee: 0, commentaire: '',
    elementsDiagnostic: [...ELEMENTS_PAR_TYPE_PIECE.wc],
    archivedAt: null, dateCreation: now, dateModification: now,
    autoGenerated: true, ordre: ++ordre
  });
  return pieces;
}

export function ensureConfigurationCollections(db) {
  db.configurations_logement ||= [];
  db.pieces_logement ||= [];
  for (const logement of db.logements || []) {
    if (!db.configurations_logement.some((config) => config.logementId === logement.id)) {
      db.configurations_logement.push(createDefaultConfiguration(logement));
    }
    // Auto-générer les pièces par défaut si le logement n'en a aucune
    const existingPieces = db.pieces_logement.filter((p) => p.logementId === logement.id && !p.archivedAt);
    if (existingPieces.length === 0) {
      const defaults = generateDefaultPieces(logement);
      db.pieces_logement.push(...defaults);
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

  // Détection auto du matériau par défaut selon l'élément
  function defaultMateriauFor(element) {
    const e = String(element).toLowerCase();
    // Portes intérieures = isoplane par défaut
    if (e.includes('porte') && !e.includes('entrée') && !e.includes('garage') && !e.includes('portillon')) {
      return 'isoplane';
    }
    return '';
  }

  function defaultUniteFor(element) {
    const e = String(element).toLowerCase();
    if (e.includes('prise') || e.includes('interrupteur') || e.includes('luminaire')) return 'u';
    if (e.includes('sol') || e.includes('mur') || e.includes('plafond') || e.includes('peinture') || e.includes('faïence') || e.includes('carrelage')) return 'm2';
    if (e.includes('clôture') || e.includes('cloture') || e.includes('plinthe')) return 'ml';
    if (e.includes('porte') || e.includes('fenêtre') || e.includes('fenetre') || e.includes('jalousie') || e.includes('lavabo') || e.includes('douche') || e.includes('évier')) return 'u';
    return 'forfait';
  }

  // Trier les pièces par ordre du parcours (séjour, cuisine, chambres, SDB, WC)
  const orderedPieces = pieces
    .filter((p) => p.logementId === logement.id && !p.archivedAt)
    .sort((a, b) => (Number(a.ordre) || 99) - (Number(b.ordre) || 99) || String(a.nom).localeCompare(String(b.nom)));
  for (const piece of orderedPieces) {
    // Template en premier (ordre du parcours visuel) + éléments custom ajoutés ensuite
    const templateElements = ELEMENTS_PAR_TYPE_PIECE[piece.type] || [];
    const existingElements = piece.elementsDiagnostic || [];
    // L'ordre du template prime : on liste templateElements d'abord, puis les éléments custom
    const allElements = [...new Set([...templateElements, ...existingElements])];
    for (const element of allElements) {
      const id = itemId(['piece', piece.id, element]);
      const defaultMateriau = defaultMateriauFor(element);
      const defaultUnite = defaultUniteFor(element);
      generated.push({
        id,
        materiau: defaultMateriau,
        unite: defaultUnite,
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
