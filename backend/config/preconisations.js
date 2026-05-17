const RULES = [
  {
    match: ({ element, etat }) => element.includes('electric') && etat === 'dangereux',
    message: "Prévoir une intervention prioritaire d'un électricien qualifié afin de sécuriser l'installation électrique du logement."
  },
  {
    match: ({ element, zone, etat }) => (element.includes('toiture') || zone.includes('toiture')) && etat === 'tres_degrade',
    message: 'Programmer une reprise complète ou partielle de la toiture afin de limiter les infiltrations et préserver la structure.'
  },
  {
    match: ({ element, zone, etat, urgence }) => (element.includes('humid') || zone.includes('humid')) && ['degrade', 'tres_degrade', 'dangereux'].includes(etat) || (element.includes('humid') && ['haute', 'urgente'].includes(urgence)),
    message: "Contrôler la ventilation, identifier les sources d'infiltration et prévoir un traitement adapté des supports."
  },
  {
    match: ({ element, zone, etat }) => (element.includes('salle de bain') || zone.includes('salle de bain')) && ['degrade', 'tres_degrade', 'dangereux'].includes(etat),
    message: 'Prévoir une remise en état des équipements sanitaires, des évacuations et des revêtements associés.'
  },
  {
    match: ({ element, etat }) => (element.includes('sol') || element.includes('revetement')) && etat === 'tres_degrade',
    message: "Prévoir la reprise du revêtement de sol pour sécuriser l'usage du logement."
  },
  {
    match: ({ etat }) => etat === 'dangereux',
    message: 'Classer le logement en priorité urgente avant toute programmation classique.'
  }
];

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function preconisationsForDiagnostic(diagnostic = {}) {
  const recommendations = [];
  for (const item of diagnostic.items || []) {
    const context = {
      zone: normalize(item.zone),
      element: normalize(item.element || item.item),
      etat: item.etat,
      urgence: item.urgence,
      poste: normalize(item.posteTravaux || item.categorieTravaux)
    };
    for (const rule of RULES) {
      if (rule.match(context)) {
        recommendations.push({
          zone: item.zone,
          element: item.element || item.item,
          etat: item.etat,
          urgence: item.urgence,
          message: rule.message
        });
      }
    }
    if (['degrade', 'tres_degrade', 'dangereux'].includes(item.etat) && !recommendations.some((rec) => rec.element === (item.element || item.item))) {
      recommendations.push({
        zone: item.zone,
        element: item.element || item.item,
        etat: item.etat,
        urgence: item.urgence,
        message: `Programmer une intervention sur ${item.element || item.item} en cohérence avec l'état constaté et le niveau d'urgence.`
      });
    }
  }
  return recommendations.filter((rec, index, all) => all.findIndex((item) => item.message === rec.message && item.zone === rec.zone && item.element === rec.element) === index);
}

export function strategicPreconisations(summary = {}) {
  const out = [];
  if (summary.urgents > 0) out.push(`Traiter en priorité les ${summary.urgents} logement(s) classés en urgence haute ou urgente.`);
  if (summary.budgetParcActif > 0) out.push(`Réserver une enveloppe active estimée à ${summary.budgetParcActif} € pour le parc à maintenir.`);
  if (summary.budgetTheoriqueHorsParc > 0) out.push(`Isoler le budget théorique hors parc (${summary.budgetTheoriqueHorsParc} €) afin de ne pas le confondre avec la programmation active.`);
  if (summary.avancement !== undefined && summary.avancement < 100) out.push(`Poursuivre les diagnostics restants pour fiabiliser la programmation budgétaire (${summary.avancement}% d'avancement).`);
  if (!out.length) out.push('Maintenir le suivi périodique du parc et actualiser les estimations après validation des diagnostics.');
  return out;
}
