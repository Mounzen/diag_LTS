import React, { useEffect, useState } from 'react';
import { ArrowLeft, Home, Search } from 'lucide-react';
import { api } from '../services/api';
import { badgeClass, patrimoineLabel, roleLabel, todayIso } from '../utils/format';
import { EmptyState, Loading, Select } from '../components/ui';
import LogementDetail from '../components/LogementDetail';
import DiagnosticEditor from '../components/DiagnosticEditor';

export default function TerrainPage({ user }) {
  const [meta, setMeta] = useState(null);
  const [secteurs, setSecteurs] = useState([]);
  const [lts, setLts] = useState([]);
  const [logements, setLogements] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [filters, setFilters] = useState({
    secteur: user.role === 'responsable' ? (user.secteurAttribue || '') : '',
    code_lts: user.ltsAttribues?.length === 1 ? user.ltsAttribues[0] : '',
    quartier: '',
    parcActif: '',
    patrimoine: '',
    q: ''
  });
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [activeDiagnostic, setActiveDiagnostic] = useState(null);
  const [mobileStep, setMobileStep] = useState('list');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.meta(), api.secteurs(), api.diagnostics()])
      .then(([metaResult, secteursResult, diagnosticsResult]) => {
        setMeta(metaResult);
        setSecteurs(secteursResult);
        setDiagnostics(diagnosticsResult);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { api.lts(filters.secteur).then(setLts).catch((err) => setError(err.message)); }, [filters.secteur]);
  useEffect(() => { api.logements(filters).then(setLogements).catch((err) => setError(err.message)); }, [filters]);
  useEffect(() => {
    if (!selected) return;
    setDetailLoading(true);
    api.logement(selected.id)
      .then((detail) => {
        setSelectedDetail(detail);
        setMobileStep('detail');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selected]);

  if (loading) return <Loading text="Chargement du parcours terrain" />;

  const todayDiagnostics = diagnostics.filter((d) => d.agentId === user.id && String(d.dateModification || d.dateDebut || '').startsWith(todayIso()));
  const draftForSelected = selectedDetail?.diagnostics?.find((d) => d.agentId === user.id && ['brouillon', 'en_cours', 'a_verifier', 'brouillon_agent', 'a_verifier_responsable'].includes(d.statut));
  const quartiers = [...new Set(logements.map((l) => l.quartier).filter(Boolean))].sort();
  const patrimoineOptions = meta?.patrimoine?.statuts?.map((item) => [item.value, item.label]) || [];

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'secteur' ? { code_lts: '' } : {}) }));
  }

  function selectLogement(logement) {
    setSelected(logement);
    setSelectedDetail(null);
    setActiveDiagnostic(null);
    setMobileStep('detail');
  }

  function backToList() {
    setMobileStep('list');
    setActiveDiagnostic(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToDetail() {
    setMobileStep('detail');
    setActiveDiagnostic(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function startDiagnostic(mode) {
    if (!selectedDetail || !meta) return;
    if (mode === 'resume' && draftForSelected) {
      setActiveDiagnostic(draftForSelected);
      setMobileStep('diagnostic');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const generated = await api.diagnosticTemplateLogement(selectedDetail.logement.id);
    setActiveDiagnostic({
      logementId: selectedDetail.logement.id,
      agentId: user.id,
      agent: user,
      statut: 'brouillon_agent',
      commentaireGeneral: '',
      configurationLogementId: generated.configuration?.id,
      items: generated.items
    });
    setMobileStep('diagnostic');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function refreshAfterSave(diagnostic) {
    const [allDiagnostics, detail] = await Promise.all([api.diagnostics(), api.logement(diagnostic.logementId)]);
    setDiagnostics(allDiagnostics);
    setSelectedDetail(detail);
    setActiveDiagnostic(diagnostic);
  }

  return (
    <div className={`terrain terrainStep-${mobileStep}`}>
      <section className="panel filtersPanel terrainListPane">
        {selectedDetail && (
          <button className="mobileOnly secondary" type="button" onClick={() => setMobileStep('detail')}>
            Ouvrir la fiche sélectionnée
          </button>
        )}
        <div className="sectionTitle">
          <div><h1>Accueil agent</h1><p>Mes diagnostics du jour : {todayDiagnostics.length}</p></div>
          <span className="badge neutral">{roleLabel(user.role)}</span>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="filterGrid">
          <Select label="Secteur" value={filters.secteur} onChange={(value) => updateFilter('secteur', value)} options={secteurs.map((s) => [s, `Secteur ${s}`])} />
          <Select label="LTS" value={filters.code_lts} onChange={(value) => updateFilter('code_lts', value)} options={lts.map((item) => [item.code_lts, `${item.code_lts} - ${item.nom_lts}`])} />
          <Select label="Quartier" value={filters.quartier} onChange={(value) => updateFilter('quartier', value)} options={quartiers.map((q) => [q, q])} />
          <Select label="Parc actif" value={filters.parcActif} onChange={(value) => updateFilter('parcActif', value)} options={[['true', 'Parc actif'], ['false', 'Hors parc']]} />
          <Select label="Patrimoine" value={filters.patrimoine} onChange={(value) => updateFilter('patrimoine', value)} options={patrimoineOptions} />
          <label className="searchBox"><Search size={16} /><input value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} placeholder="Adresse, logement, occupant" /></label>
        </div>
        <div className="mobileList">
          {logements.map((logement) => (
            <button key={logement.id} type="button" className={selected?.id === logement.id ? 'listItem selected' : 'listItem'} onClick={() => selectLogement(logement)}>
              <strong>{logement.code_acces}</strong>
              <span>{logement.nom_lts} · {logement.adresse}</span>
              <small>{logement.type_logement || 'Type non renseigné'} · {logement.statut || 'Statut non renseigné'}</small>
              <span className={badgeClass(logement.statutPatrimonial)}>{patrimoineLabel(meta, logement.statutPatrimonial)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="workspace terrainDetailPane">
        {selected && (
          <button className="mobileOnly linkBtn mobileBack" type="button" onClick={backToList}>
            <ArrowLeft size={18} /> Liste logements
          </button>
        )}
        {!selectedDetail && !detailLoading && <EmptyState icon={Home} title="Sélection logement" text="Choisis un secteur, un LTS puis un logement pour ouvrir sa fiche." />}
        {detailLoading && <Loading text="Ouverture de la fiche logement" />}
        {selectedDetail && !activeDiagnostic && <LogementDetail detail={selectedDetail} meta={meta} user={user} onUpdated={setSelectedDetail} onStart={() => startDiagnostic('new')} onResume={() => startDiagnostic('resume')} canResume={Boolean(draftForSelected)} />}
        {selectedDetail && activeDiagnostic && <DiagnosticEditor user={user} meta={meta} logement={selectedDetail.logement} diagnostic={activeDiagnostic} onBack={backToDetail} onSaved={refreshAfterSave} />}
      </section>
    </div>
  );
}
