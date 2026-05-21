import React, { useEffect, useState } from 'react';
import { ArrowLeft, Home, Search, Plus } from 'lucide-react';
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
  const [allLts, setAllLts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ code_lts: '', adresse: '', type_logement: 'T3', statut: 'vacant' });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    Promise.all([api.meta(), api.secteurs(), api.diagnostics(), api.lts()])
      .then(([metaResult, secteursResult, diagnosticsResult, ltsResult]) => {
        setMeta(metaResult);
        // Garde-fous : on force des tableaux pour ne jamais planter sur .map/.filter
        setSecteurs(Array.isArray(secteursResult) ? secteursResult : []);
        setDiagnostics(Array.isArray(diagnosticsResult) ? diagnosticsResult : []);
        setAllLts(Array.isArray(ltsResult) ? ltsResult : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { api.lts(filters.secteur).then((r) => setLts(Array.isArray(r) ? r : [])).catch((err) => setError(err.message)); }, [filters.secteur]);
  useEffect(() => { api.logements(filters).then((r) => setLogements(Array.isArray(r) ? r : [])).catch((err) => setError(err.message)); }, [filters]);
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

  async function submitAddLogement(event) {
    event.preventDefault();
    setAddError('');
    if (!addForm.code_lts) { setAddError('Choisis un LTS'); return; }
    if (!addForm.adresse.trim()) { setAddError('Saisis une adresse'); return; }
    setAddBusy(true);
    try {
      const created = await api.createLogement({ ...addForm, adresse: addForm.adresse.trim(), agentId: user.id });
      setShowAdd(false);
      setAddForm({ code_lts: '', adresse: '', type_logement: 'T3', statut: 'vacant' });
      // Filtre sur le LTS du logement créé pour qu'il apparaisse, puis ouvre sa fiche
      setFilters({ secteur: created.secteur || '', code_lts: created.code_lts || '', quartier: '', parcActif: '', patrimoine: '', q: '' });
      setSelected(created);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
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
        {user.role === 'admin' && (
          <button type="button" className="secondary addLogementBtn" onClick={() => { setShowAdd(true); setAddError(''); }}>
            <Plus size={16} /> Ajouter un logement
          </button>
        )}
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
              <strong>{logement.adresse || logement.code_acces}</strong>
              <span>LTS {logement.nom_lts}{logement.quartier ? ` · ${logement.quartier}` : ''}</span>
              <small>{logement.type_logement || 'Type non renseigné'} · {logement.statut || 'Statut non renseigné'} · {logement.code_acces}</small>
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

      {showAdd && (
        <div className="modalOverlay" onClick={() => !addBusy && setShowAdd(false)}>
          <div className="modalContent" onClick={(event) => event.stopPropagation()}>
            <div className="sectionTitle"><h2 style={{ margin: 0 }}>Ajouter un logement</h2></div>
            <form className="devisForm" onSubmit={submitAddLogement}>
              <div className="formGrid">
                <Select label="LTS" value={addForm.code_lts} onChange={(value) => setAddForm((f) => ({ ...f, code_lts: value }))} options={allLts.map((item) => [item.code_lts, `${item.code_lts} - ${item.nom_lts}`])} />
                <label>Type
                  <select value={addForm.type_logement} onChange={(event) => setAddForm((f) => ({ ...f, type_logement: event.target.value }))}>
                    {['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>Statut
                  <select value={addForm.statut} onChange={(event) => setAddForm((f) => ({ ...f, statut: event.target.value }))}>
                    <option value="vacant">vacant</option>
                    <option value="occupé">occupé</option>
                  </select>
                </label>
                <label className="wide">Adresse
                  <input value={addForm.adresse} onChange={(event) => setAddForm((f) => ({ ...f, adresse: event.target.value }))} placeholder="ex : 10 Chemin Alfred Mazérieux" />
                </label>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>Le secteur, le quartier et l'identifiant (ex : LTS-007-010) sont déduits automatiquement du LTS choisi.</p>
              {addError && <p className="error">{addError}</p>}
              <div className="formActions">
                <button type="button" className="secondary" onClick={() => setShowAdd(false)} disabled={addBusy}>Annuler</button>
                <button type="submit" className="primary" disabled={addBusy}>{addBusy ? 'Ajout…' : 'Créer le logement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
