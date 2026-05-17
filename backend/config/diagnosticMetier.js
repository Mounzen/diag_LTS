export const STATUTS_DIAGNOSTIC = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'a_verifier', label: 'À vérifier' },
  { value: 'brouillon_agent', label: 'Brouillon agent' },
  { value: 'diagnostic_termine', label: 'Diagnostic terminé' },
  { value: 'a_verifier_responsable', label: 'À vérifier responsable' },
  { value: 'valide_responsable', label: 'Validé responsable' },
  { value: 'programme_travaux', label: 'Programmé travaux' },
  { value: 'travaux_realises', label: 'Travaux réalisés' },
  { value: 'archive', label: 'Archivé' }
];

export const STATUTS_LEGACY = {
  brouillon: 'brouillon_agent',
  en_cours: 'brouillon_agent',
  termine: 'diagnostic_termine',
  a_verifier: 'a_verifier_responsable',
  valide_terrain: 'diagnostic_termine'
};

export const ETATS_DIAGNOSTIC = [
  { value: 'non_controle', label: 'Non contrôlé', coefficient: 0 },
  { value: 'bon', label: 'Bon', coefficient: 0 },
  { value: 'moyen', label: 'Moyen', coefficient: 0.35 },
  { value: 'degrade', label: 'Dégradé', coefficient: 0.7 },
  { value: 'tres_degrade', label: 'Très dégradé', coefficient: 1 },
  { value: 'dangereux', label: 'Dangereux', coefficient: 1.25 },
  { value: 'non_concerne', label: 'Non concerné', coefficient: 0 }
];

export const URGENCES_DIAGNOSTIC = [
  { value: 'faible', label: 'Faible', coefficient: 1 },
  { value: 'moyenne', label: 'Moyenne', coefficient: 1.1 },
  { value: 'haute', label: 'Haute', coefficient: 1.25 },
  { value: 'urgente', label: 'Urgente', coefficient: 1.45 }
];

export const DIAGNOSTIC_TEMPLATE = [
  { zone: 'Extérieur', items: ['Extérieur', 'Cour', 'Portail', 'Clôture', 'Façade'] },
  { zone: 'Toiture / étanchéité', items: ['Toiture', 'Étanchéité', 'Eaux pluviales'] },
  { zone: 'Évacuation / assainissement', items: ['Évacuation', 'Assainissement'] },
  { zone: 'Entrée / menuiserie', items: ['Porte entrée', 'Menuiserie'] },
  { zone: 'Structure intérieure', items: ['Sols', 'Murs', 'Peinture', 'Plafonds', 'Faux plafonds'] },
  { zone: 'Électricité', items: ['Électricité'] },
  { zone: 'Plomberie', items: ['Plomberie'] },
  { zone: 'Salle de bain', items: ['Salle de bain'] },
  { zone: 'WC', items: ['WC'] },
  { zone: 'Cuisine', items: ['Cuisine'] },
  { zone: 'Ventilation / humidité', items: ['Ventilation', 'Humidité'] },
  { zone: 'Sécurité / accessibilité', items: ['Sécurité', 'Accessibilité', 'Risques occupants'] }
];

export function diagnosticMeta() {
  return {
    statuts: STATUTS_DIAGNOSTIC,
    statutsLegacy: STATUTS_LEGACY,
    etats: ETATS_DIAGNOSTIC,
    urgences: URGENCES_DIAGNOSTIC,
    template: DIAGNOSTIC_TEMPLATE
  };
}
