import { describe, it, expect } from 'vitest';
import { redigerSyntheseExecutive } from '../src/services/aiRedactionService.js';
import { ELEMENTS_PAR_TYPE_PIECE, buildDiagnosticItemsFromConfiguration } from '../config/configurationLogement.js';

describe('Synthèse exécutive (aiRedactionService)', () => {
  it('génère des paragraphes pour un logement diagnostiqué', () => {
    const logement = { id: 'L1', code_acces: 'LTS-001', adresse: '1 rue Test', secteur: '1', nom_lts: 'TEST', type_logement: 'T3', statutPatrimonial: 'location_pure', dansParcActif: true };
    const diagnostic = {
      id: 'D1', dateModification: new Date().toISOString(),
      statut: 'brouillon_agent', urgenceGlobale: 'haute', coutTotal: 5000,
      items: [
        { etat: 'degrade', urgence: 'haute', element: 'Sol', zone: 'Séjour', coutMoyen: 3000 },
        { etat: 'bon', urgence: 'faible', element: 'Murs', zone: 'Séjour' }
      ]
    };
    const paragraphs = redigerSyntheseExecutive({ logement, diagnostic });
    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(paragraphs[0]).toContain('1 rue Test');
  });

  it('gère un logement non diagnostiqué', () => {
    const logement = { id: 'L2', code_acces: 'LTS-002', adresse: '2 rue Test', secteur: '1', nom_lts: 'TEST', type_logement: 'T1' };
    const paragraphs = redigerSyntheseExecutive({ logement, diagnostic: null });
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs[0]).toContain("n'a pas encore fait l'objet");
  });
});

describe('Template par pièce (ordre du parcours visuel)', () => {
  it('la chambre commence par Porte et finit par Humidité', () => {
    const chambre = ELEMENTS_PAR_TYPE_PIECE.chambre;
    expect(chambre[0]).toContain('Porte');
    expect(chambre[1]).toContain('Sol');
    expect(chambre[chambre.length - 1]).toContain('Humidité');
  });

  it('la cuisine contient une jalousie et un évier', () => {
    const cuisine = ELEMENTS_PAR_TYPE_PIECE.cuisine;
    expect(cuisine.some((e) => e.toLowerCase().includes('jalousie'))).toBe(true);
    expect(cuisine.some((e) => e.toLowerCase().includes('évier'))).toBe(true);
  });

  it('le WC contient Porte, WC cuvette et Chasse', () => {
    const wc = ELEMENTS_PAR_TYPE_PIECE.wc;
    expect(wc[0]).toContain('Porte');
    expect(wc.some((e) => e.includes('cuvette'))).toBe(true);
    expect(wc.some((e) => e.includes('Chasse'))).toBe(true);
  });

  it('chaque pièce de vie a prises + interrupteurs + luminaire', () => {
    for (const type of ['chambre', 'sejour', 'cuisine', 'salle_de_bain']) {
      const els = ELEMENTS_PAR_TYPE_PIECE[type].join(' ').toLowerCase();
      expect(els).toContain('prise');
      expect(els).toContain('interrupteur');
      expect(els).toContain('luminaire');
    }
  });
});

describe('Génération des items de diagnostic', () => {
  it('génère les items socle + pièces dans le bon ordre', () => {
    const logement = { id: 'L3', type_logement: 'T2', etage: 'RDC', couverture: 'tole', hasCours: true };
    const pieces = [
      { id: 'P1', logementId: 'L3', type: 'wc', nom: 'WC', ordre: 5, elementsDiagnostic: ELEMENTS_PAR_TYPE_PIECE.wc },
      { id: 'P2', logementId: 'L3', type: 'sejour', nom: 'Séjour', ordre: 1, elementsDiagnostic: ELEMENTS_PAR_TYPE_PIECE.sejour }
    ];
    const items = buildDiagnosticItemsFromConfiguration(logement, {}, pieces, []);
    expect(items.length).toBeGreaterThan(0);
    // Le séjour (ordre 1) doit apparaître avant le WC (ordre 5)
    const sejourIdx = items.findIndex((i) => i.pieceId === 'P2');
    const wcIdx = items.findIndex((i) => i.pieceId === 'P1');
    expect(sejourIdx).toBeLessThan(wcIdx);
  });

  it('ajoute les items tôle quand couverture = tole', () => {
    const logement = { id: 'L4', type_logement: 'T1', etage: 'RDC', couverture: 'tole', hasCours: true };
    const items = buildDiagnosticItemsFromConfiguration(logement, {}, [], []);
    expect(items.some((i) => i.element.toLowerCase().includes('tôle') || i.zone.toLowerCase().includes('tôle'))).toBe(true);
  });

  it('ajoute les cours en RDC mais pas en étage', () => {
    const rdc = buildDiagnosticItemsFromConfiguration({ id: 'L5', type_logement: 'T1', etage: 'RDC', hasCours: true }, {}, [], []);
    const etage = buildDiagnosticItemsFromConfiguration({ id: 'L6', type_logement: 'T1', etage: 'N+1', hasCours: false }, {}, [], []);
    const rdcHasCour = rdc.some((i) => i.zone.toLowerCase().includes('cour'));
    const etageHasCour = etage.some((i) => i.zone.toLowerCase().includes('cour'));
    expect(rdcHasCour).toBe(true);
    expect(etageHasCour).toBe(false);
  });
});
