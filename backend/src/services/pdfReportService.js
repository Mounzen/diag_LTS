import PDFDocument from 'pdfkit';
import { redigerSyntheseExecutive } from './aiRedactionService.js';

const COLORS = {
  primary: '#1457a8',
  primaryDark: '#0e3d72',
  text: '#172033',
  muted: '#64748b',
  border: '#e2e8f0',
  bgLight: '#f7f9fc',
  danger: '#b42318',
  warning: '#eab308',
  success: '#16a34a',
  white: '#ffffff'
};

const ETAT_COLORS = {
  dangereux: COLORS.danger,
  tres_degrade: '#dc2626',
  degrade: '#f59e0b',
  moyen: '#eab308',
  bon: COLORS.success,
  non_controle: COLORS.muted,
  non_concerne: COLORS.muted
};

function formatMontant(n) {
  return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €';
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '-'; }
}

function drawHeader(doc, logement) {
  // Bandeau bleu en haut
  doc.save();
  doc.rect(0, 0, doc.page.width, 42).fill(COLORS.primary);
  doc.fillColor(COLORS.white).fontSize(10).font('Helvetica-Bold')
    .text('DIAG-LTS · ' + (logement.adresse || logement.code_acces), 40, 14, { continued: true })
    .font('Helvetica').text(' · LTS ' + (logement.nom_lts || '') + ' · ' + (logement.quartier || ''), { width: doc.page.width - 80 });
  doc.restore();
}

function drawFooter(doc, pageNum, totalPages) {
  doc.save();
  const y = doc.page.height - 40;
  doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
    .text('Rapport généré le ' + new Date().toLocaleDateString('fr-FR') + ' par DIAG-LTS Saint-Denis', 40, y + 8, { width: 200 })
    .text(`Page ${pageNum}${totalPages ? ' / ' + totalPages : ''}`, doc.page.width - 80, y + 8, { width: 40, align: 'right' });
  doc.restore();
}

function sectionTitle(doc, text) {
  doc.moveDown(0.5);
  doc.fillColor(COLORS.primary).fontSize(14).font('Helvetica-Bold').text(text);
  doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor(COLORS.primary).lineWidth(1.5).stroke();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.text);
}

function kpiBox(doc, x, y, w, h, label, value, color = COLORS.primary) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fillAndStroke(COLORS.bgLight, COLORS.border);
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica').text(label, x + 8, y + 8, { width: w - 16 });
  doc.fillColor(color).fontSize(13).font('Helvetica-Bold').text(value, x + 8, y + 22, { width: w - 16 });
  doc.restore();
}

export function generateLogementPdf(db, logement, latest, configData, consolidation, photos = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: {
        Title: `Rapport diagnostic ${logement.code_acces}`,
        Author: 'DIAG-LTS Saint-Denis',
        Subject: 'Diagnostic patrimonial municipal',
        Creator: 'DIAG-LTS'
      }});
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ====== PAGE DE GARDE ======
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fff');
      // Bandeau bleu haut
      doc.rect(0, 0, doc.page.width, 220).fill(COLORS.primary);
      doc.fillColor(COLORS.white).fontSize(11).font('Helvetica')
        .text('VILLE DE SAINT-DENIS · LA RÉUNION', 50, 50);
      doc.fontSize(28).font('Helvetica-Bold')
        .text('Rapport de diagnostic', 50, 80);
      doc.fontSize(20).font('Helvetica')
        .text('Patrimoine municipal', 50, 115);

      // Bloc identification du logement
      const yBox = 260;
      doc.rect(50, yBox, doc.page.width - 100, 200).strokeColor(COLORS.primary).lineWidth(2).stroke();
      doc.fillColor(COLORS.primary).fontSize(18).font('Helvetica-Bold').text(logement.adresse || logement.code_acces, 70, yBox + 18, { width: doc.page.width - 140 });
      doc.fillColor(COLORS.text).fontSize(13).font('Helvetica-Bold').text(`LTS ${logement.nom_lts || ''}${logement.quartier ? ' · ' + logement.quartier : ''}`, 70, yBox + 50);
      doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica').text('Réf. ' + logement.code_acces, 70, yBox + 75);
      doc.moveDown(0.5);
      let y = yBox + 110;
      const rows = [
        ['Type', logement.type_logement || '—'],
        ['Secteur / Quartier', `${logement.secteur || '?'} · ${logement.quartier || '?'}`],
        ['Statut patrimonial', logement.statutPatrimonial || '—'],
        ['Étage / Toiture', `${logement.etage || 'RDC'} · ${logement.couverture || 'tôle'}`],
        ['Date diagnostic', latest ? formatDate(latest.dateModification || latest.date) : 'Non diagnostiqué']
      ];
      for (const [label, val] of rows) {
        doc.fontSize(9).fillColor(COLORS.muted).text(label + ' :', 70, y, { continued: true, width: 200 });
        doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold').text(' ' + val);
        doc.font('Helvetica');
        y += 16;
      }

      // Pied de page de garde
      doc.fillColor(COLORS.muted).fontSize(9)
        .text('Document généré automatiquement le ' + new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), 50, doc.page.height - 100, { align: 'center', width: doc.page.width - 100 });
      doc.fontSize(9).text('Service Patrimoine · Mairie de Saint-Denis (974)', { align: 'center', width: doc.page.width - 100 });

      // ====== SOMMAIRE ======
      doc.addPage();
      sectionTitle(doc, 'Sommaire');
      const toc = [
        '1. Synthèse exécutive',
        '2. Identité et caractéristiques',
        '3. Conformité réglementaire',
        '4. État détaillé par zone',
        '5. Préconisations et estimation budgétaire',
        '6. Photos du diagnostic',
        '7. Signatures et visas'
      ];
      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica');
      for (const item of toc) {
        doc.text(item).moveDown(0.4);
      }

      // ====== 1. SYNTHÈSE EXÉCUTIVE ======
      doc.addPage();
      sectionTitle(doc, '1. Synthèse exécutive');
      const paragraphs = redigerSyntheseExecutive({ logement, diagnostic: latest, consolidation });
      doc.fontSize(10).fillColor(COLORS.text).font('Helvetica');
      for (const p of paragraphs) {
        doc.text(p, { align: 'justify', lineGap: 2 });
        doc.moveDown(0.6);
      }

      // ====== 2. IDENTITÉ + CARACTÉRISTIQUES ======
      doc.addPage();
      sectionTitle(doc, '2. Identité et caractéristiques');
      const wKpi = (doc.page.width - 120) / 4;
      const yKpi = doc.y;
      kpiBox(doc, 50, yKpi, wKpi, 50, 'URGENCE', (latest?.urgenceGlobale || '—').toUpperCase(), latest?.urgenceGlobale === 'urgente' ? COLORS.danger : COLORS.primary);
      kpiBox(doc, 50 + (wKpi + 10), yKpi, wKpi, 50, 'BUDGET ESTIMÉ', formatMontant(latest?.coutTotal || 0));
      kpiBox(doc, 50 + (wKpi + 10) * 2, yKpi, wKpi, 50, 'ITEMS', String((latest?.items || []).length));
      kpiBox(doc, 50 + (wKpi + 10) * 3, yKpi, wKpi, 50, 'AGENT', latest?.agent?.prenom || latest?.agent?.nom || '—');
      doc.y = yKpi + 65;

      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Caractéristiques structurelles');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10);
      const carac = [
        ['Étage / niveau', logement.etage || 'RDC'],
        ['Type de toiture', logement.couverture || 'tôle'],
        ['Cour avant/arrière', logement.hasCours === false ? 'Non' : 'Oui'],
        ['Dans parc actif', logement.dansParcActif ? 'Oui' : 'Non']
      ];
      for (const [k, v] of carac) {
        doc.fillColor(COLORS.muted).text(k + ' : ', { continued: true });
        doc.fillColor(COLORS.text).font('Helvetica-Bold').text(v);
        doc.font('Helvetica');
      }

      // ====== 3. CONFORMITÉ ======
      doc.moveDown(1.5);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('3. Conformité réglementaire');
      doc.moveDown(0.3);
      const conf = logement.conformite || {};
      const confItems = [
        ['Détecteur de fumée', conf.detecteurFumee, 'Obligatoire depuis 2015'],
        ['Décret décence (loi SRU)', conf.decretDecence, ''],
        ['Classement DPE', conf.dpe, ''],
        ['Amiante', conf.amiante, 'DAPP si < 1997'],
        ['Électricité aux normes', conf.electriciteAuxNormes, '']
      ];
      doc.fontSize(10);
      for (const [label, value, note] of confItems) {
        doc.fillColor(COLORS.text).text(label + ' : ', { continued: true });
        doc.fillColor(value ? COLORS.success : COLORS.muted).font('Helvetica-Bold').text(value || 'Non renseigné');
        if (note) {
          doc.font('Helvetica').fillColor(COLORS.muted).fontSize(8).text('  ' + note);
          doc.fontSize(10);
        }
      }

      // ====== 4. ÉTAT DÉTAILLÉ PAR ZONE ======
      doc.addPage();
      sectionTitle(doc, '4. État détaillé par zone');
      if (!latest || !latest.items?.length) {
        doc.fontSize(10).fillColor(COLORS.muted).text('Aucun diagnostic disponible.');
      } else {
        const items = latest.items;
        // Grouper par zone
        const byZone = new Map();
        for (const item of items) {
          if (!byZone.has(item.zone)) byZone.set(item.zone, []);
          byZone.get(item.zone).push(item);
        }
        const totals = { bas: 0, moyen: 0, haut: 0 };
        for (const [zone, zoneItems] of byZone) {
          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text(zone);
          doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted);
          for (const item of zoneItems) {
            // Vérifier place restante (sinon nouvelle page)
            if (doc.y > doc.page.height - 100) doc.addPage();
            const etat = (item.etat || 'non_controle').replace(/_/g, ' ');
            const elementLabel = item.element || item.item || '';
            doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold').text(`  • ${elementLabel}`, { continued: true });
            doc.font('Helvetica').fillColor(ETAT_COLORS[item.etat] || COLORS.muted).text(` — ${etat}`, { continued: true });
            doc.fillColor(COLORS.muted).fontSize(8).text(` (${item.urgence || '—'})`);
            // Détails dimensions si renseignés
            const details = [];
            if (item.quantite) details.push(`Qté: ${item.quantite}${item.unite ? ' ' + item.unite : ''}`);
            if (item.hauteur && item.largeur) details.push(`${item.hauteur}×${item.largeur} cm`);
            if (item.materiau) details.push(item.materiau.replace(/_/g, ' '));
            if (details.length > 0) {
              doc.fillColor(COLORS.muted).fontSize(8).text('    ' + details.join(' · '));
            }
            // Coûts
            const cMoyen = Number(item.coutMoyen || item.coutEstimatif || 0);
            const cBas = Number(item.coutBas || cMoyen);
            const cHaut = Number(item.coutHaut || cMoyen);
            totals.bas += cBas;
            totals.moyen += cMoyen;
            totals.haut += cHaut;
            if (cMoyen > 0) {
              doc.fillColor(COLORS.muted).fontSize(8).text(`    Coût estimatif : ${formatMontant(cBas)} (bas) · ${formatMontant(cMoyen)} (moyen) · ${formatMontant(cHaut)} (haut)`);
            }
            if (item.commentaire) {
              doc.fillColor(COLORS.text).fontSize(8).font('Helvetica-Oblique').text(`    « ${item.commentaire} »`);
              doc.font('Helvetica');
            }
            doc.moveDown(0.2);
          }
        }
        // Totaux
        doc.moveDown(0.5);
        if (doc.y > doc.page.height - 80) doc.addPage();
        doc.rect(40, doc.y, doc.page.width - 80, 30).fill(COLORS.primary);
        doc.fillColor(COLORS.white).fontSize(11).font('Helvetica-Bold')
          .text(`TOTAL ESTIMATIF`, 50, doc.y - 22, { continued: true })
          .text(`   Bas : ${formatMontant(totals.bas)}   ·   Moyen : ${formatMontant(totals.moyen)}   ·   Haut : ${formatMontant(totals.haut)}`, { align: 'left' });
        doc.fillColor(COLORS.text);
        doc.moveDown(0.5);
      }

      // ====== 5. PRÉCONISATIONS ======
      doc.addPage();
      sectionTitle(doc, '5. Préconisations et estimation budgétaire');
      doc.fontSize(10).fillColor(COLORS.text);
      const precos = latest?.preconisations || [];
      if (precos.length === 0) {
        doc.fillColor(COLORS.muted).text('Aucune préconisation générée. Effectuez le diagnostic pour obtenir des préconisations automatiques.');
      } else {
        for (const p of precos) {
          const text = typeof p === 'string' ? p : (p.message || p.libelle || JSON.stringify(p));
          doc.fontSize(10).fillColor(COLORS.text).text('• ' + text, { indent: 10 });
          doc.moveDown(0.2);
        }
      }

      // ====== 6. PHOTOS ======
      if (photos.length > 0) {
        doc.addPage();
        sectionTitle(doc, '6. Photos du diagnostic');
        doc.fontSize(9).fillColor(COLORS.muted)
          .text(`${photos.length} photo(s) jointe(s) au diagnostic. Les photos haute résolution sont disponibles dans le système DIAG-LTS.`);
        doc.moveDown(0.5);
        // Liste des photos avec leur métadonnée (pas d'embed des images pour rester léger)
        for (const ph of photos.slice(0, 30)) {
          doc.fontSize(9).fillColor(COLORS.text).text(`• ${ph.zone || '?'} / ${ph.element || ''} — ${formatDate(ph.date)}`, { indent: 10 });
        }
      }

      // ====== 7. SIGNATURES ======
      doc.addPage();
      sectionTitle(doc, '7. Signatures et visas');
      const sigs = latest?.signatures || [];
      if (sigs.length === 0) {
        doc.fontSize(10).fillColor(COLORS.muted).text('Aucune signature électronique apposée. Le rapport peut être signé manuellement ci-dessous.');
        doc.moveDown(2);
        const boxW = (doc.page.width - 120) / 3;
        const roles = ['Agent terrain', 'Responsable', 'Direction'];
        const yS = doc.y;
        for (let i = 0; i < roles.length; i++) {
          const x = 50 + i * (boxW + 10);
          doc.rect(x, yS, boxW, 80).strokeColor(COLORS.border).lineWidth(1).stroke();
          doc.fontSize(10).fillColor(COLORS.text).font('Helvetica-Bold').text(roles[i], x + 8, yS + 8);
          doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica').text('Date - Nom - Signature', x + 8, yS + 22);
        }
      } else {
        doc.fontSize(9).fillColor(COLORS.muted).text(`${sigs.length} signature(s) électronique(s) apposée(s) avec horodatage et hash d'intégrité SHA-256.`);
        doc.moveDown(1);
        const roleLabels = { agent_terrain: 'Agent terrain', responsable: 'Responsable', direction: 'Direction' };
        for (const sig of sigs) {
          if (doc.y > doc.page.height - 150) doc.addPage();
          doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text(roleLabels[sig.role] || sig.role);
          doc.fontSize(9).font('Helvetica').fillColor(COLORS.text)
            .text(`Par : ${sig.agentNom || 'non renseigné'}`, { indent: 10 })
            .text(`Date : ${new Date(sig.dateSignature).toLocaleString('fr-FR')}`, { indent: 10 });
          if (sig.commentaire) doc.text(`Commentaire : ${sig.commentaire}`, { indent: 10 });
          doc.fillColor(COLORS.muted).fontSize(7).text(`Hash d'intégrité : ${(sig.contentHash || '').slice(0, 32)}...`, { indent: 10 });
          doc.moveDown(0.5);
        }
      }

      // ====== HEADER + FOOTER sur toutes les pages (sauf page de garde) ======
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = range.start + 1; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        drawHeader(doc, logement);
        drawFooter(doc, i + 1, totalPages);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
