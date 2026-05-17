import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, ClipboardCheck, Euro, FileText, Home, MapPinned, RefreshCw, Users } from 'lucide-react';
import { api } from '../services/api';
import { URGENCES } from '../config/options';
import { badgeClass, label, money } from '../utils/format';
import { Kpi, ListCard, Loading, Select } from '../components/ui';
import BrandLogo from '../components/BrandLogo';

function ChartCard({ title, rows = [], labelKey }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.map((row) => {
        const pct = row.total ? Math.round((row.diagnostiques / row.total) * 100) : 0;
        return <div className="barRow" key={row[labelKey] || row.secteur || row.code_lts}><span>{row[labelKey] || row.secteur}</span><strong>{row.diagnostiques}/{row.total}</strong><i><em style={{ width: `${pct}%` }} /></i></div>;
      })}
    </section>
  );
}

function PriorityTable({ rows = [] }) {
  return (
    <section className="panel wide">
      <h2>Top 10 logements prioritaires</h2>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Logement</th><th>LTS</th><th>Secteur</th><th>Urgence</th><th>Budget</th><th>Agent</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}><td>{row.code_acces}</td><td>{row.nom_lts}</td><td>{row.secteur}</td><td><span className={badgeClass(row.urgenceGlobale)}>{label(URGENCES, row.urgenceGlobale)}</span></td><td>{money(row.coutTotal)}</td><td>{row.agent?.prenom || row.agent?.nom}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function dashboardTitle(role) {
  return {
    agent: 'Tableau de bord agent',
    responsable: 'Tableau de bord responsable',
    admin: 'Tableau de bord direction',
    lecture_seule: 'Tableau de bord consultation'
  }[role] || 'Tableau de bord global';
}

export default function DashboardPage({ user }) {
  const [meta, setMeta] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState(() => ({
    secteur: user.role === 'responsable' ? (user.secteurAttribue || '') : '',
    code_lts: '',
    agent: user.role === 'agent' ? user.id : '',
    statut: '',
    urgence: '',
    parcActif: '',
    patrimoine: '',
    date: ''
  }));
  const [lts, setLts] = useState([]);

  useEffect(() => { api.meta().then(setMeta); }, []);
  useEffect(() => { api.lts(filters.secteur).then(setLts); }, [filters.secteur]);
  useEffect(() => { api.dashboard(filters).then(setDashboard); }, [filters]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'secteur' ? { code_lts: '' } : {}) }));
  }

  if (!dashboard || !meta) return <Loading text="Chargement du tableau de bord" />;

  return (
    <div className="dashboard">
      <div className="dashboardHeader">
        <div className="dashboardLogoSlot">
          <BrandLogo variant="light" className="dashboardLogo" />
        </div>
        <div className="dashboardTitleBlock">
          <h1>{dashboardTitle(user.role)}</h1>
          <p>Vue institutionnelle du parc, des diagnostics et des budgets.</p>
        </div>
        <div className="dashboardAgent">
          <span>Agent connecté</span>
          <strong>{user.prenom || user.nom}</strong>
          <span>{user.service || 'Service non renseigné'} · {user.role}</span>
        </div>
      </div>
      <div className="filterGrid compact">
        <Select label="Secteur" value={filters.secteur} onChange={(value) => setFilter('secteur', value)} options={(dashboard.parSecteur || []).map((s) => [s.secteur, `Secteur ${s.secteur}`])} />
        <Select label="LTS" value={filters.code_lts} onChange={(value) => setFilter('code_lts', value)} options={lts.map((item) => [item.code_lts, item.nom_lts])} />
        <Select label="Agent" value={filters.agent} onChange={(value) => setFilter('agent', value)} options={meta.users.map((item) => [item.id, item.prenom])} />
        <Select label="Statut" value={filters.statut} onChange={(value) => setFilter('statut', value)} options={meta.statutsDiagnostic?.map((s) => [s.value, s.label]) || []} />
        <Select label="Urgence" value={filters.urgence} onChange={(value) => setFilter('urgence', value)} options={URGENCES} />
        <Select label="Parc actif" value={filters.parcActif} onChange={(value) => setFilter('parcActif', value)} options={[['true', 'Parc actif'], ['false', 'Hors parc']]} />
        <Select label="Patrimoine" value={filters.patrimoine} onChange={(value) => setFilter('patrimoine', value)} options={meta.patrimoine?.statuts?.map((item) => [item.value, item.label]) || []} />
        <label>Date<input type="date" value={filters.date} onChange={(event) => setFilter('date', event.target.value)} /></label>
      </div>
      <div className="kpis">
        <Kpi icon={Home} label="Total fichier" value={dashboard.logementsTotalFichier} />
        <Kpi icon={Building2} label="Actifs parc" value={dashboard.logementsActifsParc} />
        <Kpi icon={AlertTriangle} label="Hors parc" value={dashboard.logementsHorsParc} />
        <Kpi icon={MapPinned} label="Location pure" value={dashboard.logementsLocationPure} />
        <Kpi icon={Users} label="En vente" value={dashboard.logementsEnVente} />
        <Kpi icon={AlertTriangle} label="Sortis du parc" value={dashboard.logementsSortisParc} />
        <Kpi icon={ClipboardCheck} label="Diagnostiqués" value={dashboard.logementsDiagnostiques} />
        <Kpi icon={AlertTriangle} label="Urgents" value={dashboard.logementsUrgents} />
        <Kpi icon={FileText} label="À réaliser" value={dashboard.diagnosticsARealiserParcActif} />
        <Kpi icon={RefreshCw} label="En cours" value={dashboard.diagnosticsEnCours} />
        <Kpi icon={RefreshCw} label="Progression" value={`${dashboard.avancement}%`} />
        <Kpi icon={Euro} label="Budget total" value={money(dashboard.budgetGlobalEstime)} />
        <Kpi icon={Euro} label="Budget parc actif" value={money(dashboard.budgetTotalEstime)} />
        <Kpi icon={Euro} label="Budget théorique" value={money(dashboard.budgetTheoriqueHorsParc)} />
      </div>
      <div className="dashGrid">
        <ChartCard title="Progression diagnostics par secteur" rows={dashboard.parSecteur} labelKey="secteur" />
        <ChartCard title="Progression diagnostics par LTS" rows={dashboard.parLts?.slice(0, 12)} labelKey="nom_lts" />
        <ListCard title="Budget par secteur" rows={dashboard.budgetParSecteur?.slice(0, 10)} left="secteur" right="montant" moneyRight formatMoney={money} />
        <ListCard title="Budget par LTS" rows={dashboard.budgetParLts?.slice(0, 10)} left="nom_lts" right="montant" moneyRight formatMoney={money} />
        <ListCard title="Budget par poste travaux" rows={dashboard.budgetParPoste?.slice(0, 10)} left="poste" right="montant" moneyRight formatMoney={money} />
        <ListCard title="Activité agents" rows={dashboard.diagnosticsDuJourParAgent} left="agent" right="total" formatMoney={money} />
        <PriorityTable rows={dashboard.topPrioritaires} />
      </div>
    </div>
  );
}
