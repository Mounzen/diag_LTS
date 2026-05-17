import { preconisationsForDiagnostic, strategicPreconisations } from '../../config/preconisations.js';

// Service de rédaction des préconisations et synthèses.
// Phase 14 preparation: deterministic rédaction is used now. This service is
// the integration point for a later AI provider without coupling reports to it.

export function redigerPreconisationsDiagnostic(diagnostic) {
  return preconisationsForDiagnostic(diagnostic);
}

export function redigerPreconisationsStrategiques(summary) {
  return strategicPreconisations(summary);
}

// ============================================================================
// Synthèse exécutive : prose française institutionnelle pour le PDF logement.
// Retourne un tableau de paragraphes (chaînes), prêts à être rendus dans le PDF.
// ============================================================================

const ETAT_LABELS = {
  bon: 'bon état',
  moyen: 'état moyen',
  degrade: 'état dégradé',
  tres_degrade: 'état très dégradé',
  dangereux: 'situation dangereuse',
  non_controle: 'non contrôlé',
  non_concerne: 'sans objet'
};

const URGENCE_LABELS = {
  faible: 'faible',
  moyenne: 'moyenne',
  haute: 'haute',
  urgente: 'urgente'
};

const URGENCE_DELAIS = {
  faible: 'à horizon 24 mois',
  moyenne: 'à horizon 12 mois',
  haute: 'sous 6 mois',
  urgente: 'sous 3 mois, voire immédiatement pour les éléments critiques'
};

function pluriel(n, singulier, pluriel) {
  return Math.abs(n) <= 1 ? `${n} ${singulier}` : `${n} ${pluriel}`;
}

function formatMontant(n) {
  const value = Math.round(Number(n) || 0);
  return value.toLocaleString('fr-FR') + ' €';
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

function statsItems(items = []) {
  const stats = { bon: 0, moyen: 0, degrade: 0, tres_degrade: 0, dangereux: 0, non_controle: 0, non_concerne: 0, total: 0 };
  for (const item of items) {
    const e = item.etat || 'non_controle';
    if (stats[e] !== undefined) stats[e] += 1;
    stats.total += 1;
  }
  return stats;
}

function postesCritiques(items = [], limite = 5) {
  const priority = (item) => {
    const etatScore = { dangereux: 5, tres_degrade: 4, degrade: 3, moyen: 2 }[item.etat] || 0;
    const urgenceScore = { urgente: 4, haute: 3, moyenne: 2, faible: 1 }[item.urgence] || 0;
    return etatScore * 10 + urgenceScore;
  };
  return [...items]
    .filter((item) => ['dangereux', 'tres_degrade', 'degrade', 'moyen'].includes(item.etat))
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, limite);
}

function paragrapheIdentite(logement, diagnostic) {
  const adresse = logement.adresse || 'adresse non renseignée';
  const type = logement.type_logement || logement.type || 'type non renseigné';
  const secteur = logement.secteur || 'secteur non renseigné';
  const lts = logement.nom_lts || logement.code_lts || 'LTS non identifié';
  const statut = logement.statutPatrimonial || 'statut patrimonial non précisé';
  const parc = logement.dansParcActif ? 'dans le parc actif' : 'hors parc actif';
  const dateDiag = diagnostic ? formatDate(diagnostic.dateModification || diagnostic.date) : null;
  const agent = diagnostic?.agent?.prenom || diagnostic?.agent?.nom || null;

  if (!diagnostic) {
    return `Le logement situé au ${adresse}, rattaché au ${lts} dans le secteur ${secteur}, n'a pas encore fait l'objet d'un diagnostic terrain. Il est référencé comme ${type}, avec un statut patrimonial « ${statut} » et est classé ${parc}. Une visite de diagnostic est à programmer afin d'établir l'état réel du bâti et le budget d'entretien associé.`;
  }

  const dateLabel = dateDiag ? `le ${dateDiag}` : 'à une date non précisée';
  const agentLabel = agent ? `par l'agent ${agent}` : 'par un agent de terrain';
  return `Le logement situé au ${adresse}, rattaché au ${lts} dans le secteur ${secteur}, a fait l'objet d'un diagnostic terrain ${dateLabel} ${agentLabel}. Il est référencé comme ${type}, avec un statut patrimonial « ${statut} » et est classé ${parc}. Le présent rapport synthétise l'état constaté du bâti, les postes nécessitant une intervention et l'estimation budgétaire associée.`;
}

function paragrapheEtatGeneral(diagnostic) {
  if (!diagnostic) {
    return `En l'absence de diagnostic, aucune évaluation de l'état général n'est disponible. Toute décision patrimoniale doit être suspendue jusqu'à la réalisation d'une visite.`;
  }

  const items = diagnostic.items || [];
  const stats = statsItems(items);
  const controlled = stats.total - stats.non_controle - stats.non_concerne;
  const urgence = diagnostic.urgenceGlobale || diagnostic.priorite || 'faible';
  const urgenceLabel = URGENCE_LABELS[urgence] || urgence;

  const critiques = stats.dangereux + stats.tres_degrade;
  const degradesLegers = stats.degrade + stats.moyen;
  const sains = stats.bon;

  let etatPhrase;
  if (stats.dangereux > 0) {
    etatPhrase = `${pluriel(stats.dangereux, 'point présente', 'points présentent')} une situation potentiellement dangereuse nécessitant une mise en sécurité immédiate.`;
  } else if (stats.tres_degrade > 0) {
    etatPhrase = `${pluriel(stats.tres_degrade, 'élément est', 'éléments sont')} en état très dégradé et appellent une intervention rapide.`;
  } else if (degradesLegers > 0) {
    etatPhrase = `${pluriel(degradesLegers, 'élément présente', 'éléments présentent')} des signes d'usure ou de dégradation à traiter dans le cadre de l'entretien courant.`;
  } else {
    etatPhrase = `Aucun élément critique n'a été relevé : le logement est globalement dans un bon état d'entretien.`;
  }

  return `L'évaluation porte sur ${pluriel(controlled, 'élément contrôlé', 'éléments contrôlés')} sur les ${stats.total} prévus au référentiel de diagnostic. ${etatPhrase} Le niveau d'urgence global retenu est ${urgenceLabel}, ce qui implique une programmation des travaux ${URGENCE_DELAIS[urgence] || 'à définir'}. ${sains > 0 ? `À l'inverse, ${pluriel(sains, 'élément est', 'éléments sont')} en bon état et ne nécessitent pas d'intervention à ce stade.` : ''}`.trim();
}

function paragraphePostesCritiques(diagnostic) {
  if (!diagnostic) return null;
  const items = diagnostic.items || [];
  const critiques = postesCritiques(items, 5);
  if (critiques.length === 0) {
    return `Aucun poste critique n'est à signaler sur ce logement. L'entretien courant et la veille périodique suffisent à maintenir le bâti en l'état.`;
  }
  const enumeration = critiques.map((item) => {
    const zone = item.pieceNom || item.zone || 'zone non précisée';
    const element = item.element || item.item || 'élément';
    const etat = ETAT_LABELS[item.etat] || item.etat;
    return `${element.toLowerCase()} (${zone.toLowerCase()}, ${etat})`;
  }).join(' ; ');

  return `Les postes nécessitant l'attention prioritaire de la maîtrise d'ouvrage sont les suivants : ${enumeration}. Ces éléments doivent faire l'objet d'un chiffrage détaillé et d'une consultation d'entreprises dans les meilleurs délais afin d'éviter toute aggravation de l'état du bâti et tout risque pour les occupants.`;
}

function paragrapheBudget(diagnostic, logement) {
  if (!diagnostic) return null;
  const total = Number(diagnostic.coutTotal || 0);
  if (total === 0) {
    return `Aucun coût de travaux n'a été estimé sur ce diagnostic. Une revue manuelle du référentiel de prix peut être nécessaire pour fiabiliser l'estimation budgétaire.`;
  }

  const items = diagnostic.items || [];
  const totalUrgent = items
    .filter((item) => ['urgente', 'haute'].includes(item.urgence) || ['dangereux', 'tres_degrade'].includes(item.etat))
    .reduce((sum, item) => sum + Number(item.coutMoyen || item.coutEstimatif || 0), 0);

  const partUrgent = total > 0 ? Math.round((totalUrgent / total) * 100) : 0;
  const parcLabel = logement.dansParcActif
    ? `inscrit dans le parc actif, le budget est intégralement à programmer sur les exercices à venir`
    : `classé hors parc actif, le budget reste informatif et n'a pas vocation à être engagé sans décision de maintien ou de cession`;

  return `L'estimation budgétaire globale s'établit à ${formatMontant(total)} TTC, sur la base du référentiel de prix moyens en vigueur. Sur ce montant, environ ${formatMontant(totalUrgent)} (${partUrgent}%) correspondent à des interventions urgentes ou hautement prioritaires devant être engagées dans les six prochains mois. Le logement étant ${parcLabel}.`;
}

function paragrapheStrategique(diagnostic, logement) {
  const statut = logement.statutPatrimonial || '';
  const parcActif = logement.dansParcActif;
  const urgence = diagnostic?.urgenceGlobale || 'faible';

  if (!parcActif && diagnostic && ['urgente', 'haute'].includes(urgence)) {
    return `Sur le plan stratégique, l'état dégradé constaté combiné au classement hors parc actif (statut « ${statut} ») interroge la pertinence d'un investissement lourd. Une décision patrimoniale est à prendre rapidement : soit la réintégration au parc actif accompagnée d'un programme de travaux, soit l'engagement d'une procédure de sortie de patrimoine (cession, démolition, changement d'usage).`;
  }

  if (parcActif && ['urgente', 'haute'].includes(urgence)) {
    return `Sur le plan stratégique, le logement appartient au parc actif et présente un niveau d'urgence ${URGENCE_LABELS[urgence]}. Son maintien en location implique l'engagement rapide des travaux identifiés, afin de préserver tant la sécurité des occupants que la valeur du patrimoine. Un suivi rapproché du planning d'intervention est recommandé.`;
  }

  if (!diagnostic) {
    return `Sur le plan stratégique, l'absence de diagnostic récent est une zone d'incertitude pour la maîtrise d'ouvrage. Une visite est à planifier prioritairement, en particulier si le logement est occupé ou en projet de remise en location.`;
  }

  return `Sur le plan stratégique, l'état général du logement est compatible avec son maintien en exploitation. Les travaux identifiés relèvent d'un entretien courant et peuvent être intégrés à la programmation pluriannuelle sans urgence particulière.`;
}

function paragrapheEtapes(diagnostic) {
  if (!diagnostic) {
    return `Les prochaines étapes consistent à programmer une visite de diagnostic, à mobiliser un agent référent et à compléter la fiche logement dans l'outil DIAG-LTS. Le présent document sera mis à jour à l'issue de cette visite.`;
  }

  const statut = diagnostic.statut || 'brouillon_agent';
  if (statut === 'brouillon_agent') {
    return `Les prochaines étapes consistent en la finalisation du diagnostic par l'agent terrain, sa transmission au responsable pour validation, puis l'élaboration du programme de travaux associé. Un nouveau diagnostic est recommandé à 24 mois pour assurer le suivi du bâti.`;
  }
  if (statut === 'a_verifier_responsable') {
    return `Les prochaines étapes relèvent du responsable de service : validation des éléments saisis, ajustement éventuel des préconisations, puis transmission à la direction pour intégration au plan pluriannuel d'entretien.`;
  }
  return `Le diagnostic est validé. Les prochaines étapes relèvent du suivi opérationnel : consultation des entreprises, attribution des marchés, réalisation et réception des travaux. Un re-diagnostic est recommandé à l'issue des interventions majeures.`;
}

/**
 * Génère la synthèse exécutive d'un rapport logement.
 * @param {object} args
 * @param {object} args.logement - Données du logement
 * @param {object} [args.diagnostic] - Dernier diagnostic (peut être null)
 * @param {object} [args.consolidation] - Consolidation pré-calculée (optionnelle)
 * @returns {string[]} - Tableau de paragraphes prêts pour le PDF
 */
export function redigerSyntheseExecutive({ logement, diagnostic = null, consolidation = null } = {}) {
  if (!logement) return [];
  const paragraphs = [
    paragrapheIdentite(logement, diagnostic),
    paragrapheEtatGeneral(diagnostic),
    paragraphePostesCritiques(diagnostic),
    paragrapheBudget(diagnostic, logement),
    paragrapheStrategique(diagnostic, logement),
    paragrapheEtapes(diagnostic)
  ].filter(Boolean);
  return paragraphs;
}
