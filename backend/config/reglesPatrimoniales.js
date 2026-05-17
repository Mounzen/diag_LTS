export const STATUTS_PATRIMONIAUX = {
  location_pure: {
    label: 'Ville / location pure',
    badge: 'Ville / location pure',
    dansParcActif: true
  },
  en_vente: {
    label: 'En vente',
    badge: 'En vente',
    dansParcActif: true
  },
  vendu: {
    label: 'Vendu',
    badge: 'Vendu',
    dansParcActif: false
  },
  sorti_du_parc: {
    label: 'Sorti du parc',
    badge: 'Sorti du parc',
    dansParcActif: false
  },
  a_verifier: {
    label: 'À vérifier',
    badge: 'À vérifier',
    dansParcActif: true
  }
};

export const LTS_LOCATION_PURE = ['clotilda', 'grenadine', 'sapoti', 'alamanda'];

export function normalizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function detectStatutPatrimonial(logement = {}) {
  const haystack = normalizeName(`${logement.nom_lts || ''} ${logement.code_lts || ''}`);
  return LTS_LOCATION_PURE.some((name) => haystack.includes(name))
    ? 'location_pure'
    : 'en_vente';
}

export function isDansParcActif(statutPatrimonial) {
  return STATUTS_PATRIMONIAUX[statutPatrimonial]?.dansParcActif !== false;
}

export function isDiagnosticObligatoire(statutPatrimonial) {
  return isDansParcActif(statutPatrimonial);
}

export function budgetScope(statutPatrimonial) {
  if (isDansParcActif(statutPatrimonial)) return 'actif';
  if (['vendu', 'sorti_du_parc'].includes(statutPatrimonial)) return 'theorique_hors_parc';
  return 'theorique';
}

export function enrichLogementPatrimoine(logement = {}, previous = {}) {
  const statutDetecte = detectStatutPatrimonial(logement);
  const statutConserve = ['vendu', 'sorti_du_parc', 'a_verifier'].includes(previous.statutPatrimonial)
    ? previous.statutPatrimonial
    : null;
  const statutPatrimonial = statutConserve || statutDetecte || logement.statutPatrimonial || 'en_vente';
  const dansParcActif = isDansParcActif(statutPatrimonial);
  return {
    ...logement,
    statutPatrimonial,
    dansParcActif,
    diagnosticObligatoire: isDiagnosticObligatoire(statutPatrimonial),
    budgetScope: budgetScope(statutPatrimonial),
    dateSortieParc: previous.dateSortieParc || logement.dateSortieParc || '',
    commentairePatrimonial: previous.commentairePatrimonial || logement.commentairePatrimonial || ''
  };
}

export function patrimoineMeta() {
  return {
    statuts: Object.entries(STATUTS_PATRIMONIAUX).map(([value, config]) => ({ value, ...config })),
    locationPureMatchers: LTS_LOCATION_PURE
  };
}
