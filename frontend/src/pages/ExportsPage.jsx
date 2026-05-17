import React from 'react';
import { Download, FileText } from 'lucide-react';
import { exportUrl } from '../services/api';
import BrandLogo from '../components/BrandLogo';

export default function ExportsPage({ filters = {} }) {
  return (
    <div className="panel">
      <div className="exportsHeader">
        <div className="exportsLogoSlot">
          <BrandLogo variant="markLight" className="sectionLogo" />
        </div>
        <div className="exportsTitleBlock">
          <h1>Exports</h1>
          <p>Bases PDF et Excel générées depuis les données réelles.</p>
        </div>
      </div>
      <div className="exportGrid">
        <a className="exportCard" href={exportUrl('/api/exports/global-parc.pdf', filters)} target="_blank" rel="noreferrer"><FileText size={22} /><strong>Export PDF global</strong><span>Rapport global parc institutionnel</span></a>
        <a className="exportCard" href={exportUrl('/api/exports/global-parc.xlsx', filters)}><Download size={22} /><strong>Export Excel global</strong><span>Synthèse parc, secteurs, LTS et travaux</span></a>
        <a className="exportCard" href={exportUrl('/api/exports/global-diagnostics.xlsx', filters)}><Download size={22} /><strong>Excel diagnostics</strong><span>Diagnostics filtrables</span></a>
        <a className="exportCard" href={exportUrl('/api/exports/travaux-estimes.xlsx', filters)}><Download size={22} /><strong>Excel budgets travaux</strong><span>Détail par élément et poste</span></a>
        <a className="exportCard" href={exportUrl('/api/exports/global-direction.pdf', filters)} target="_blank" rel="noreferrer"><FileText size={22} /><strong>PDF global direction</strong><span>Synthèse institutionnelle</span></a>
        <a className="exportCard" href={exportUrl('/api/exports/global-diagnostics.csv', filters)}><Download size={22} /><strong>CSV diagnostics</strong><span>Compatibilité tableur</span></a>
        <div className="exportCard mutedCard"><FileText size={22} /><strong>PDF logement / LTS / secteur</strong><span>Disponibles depuis les fiches et les rapports.</span></div>
      </div>
    </div>
  );
}
