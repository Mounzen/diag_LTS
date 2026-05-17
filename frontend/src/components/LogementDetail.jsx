import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Play, Plus, RefreshCw, Save } from 'lucide-react';
import { api, API_URL, exportUrl } from '../services/api';
import { badgeClass, label, money, patrimoineLabel } from '../utils/format';
import { URGENCES } from '../config/options';
import { Fact, Select } from './ui';
import LogementConfiguration from './LogementConfiguration';
import DevisForm from './DevisForm';

export default function LogementDetail({ detail, meta, user, onUpdated, onStart, onResume, canResume }) {
  const { logement, diagnostics, photos, configuration, pieces } = detail;
  const latest = diagnostics[0];
  const latestPhotoUrls = new Set((latest?.items || []).flatMap((item) => item.photos || []));
  const diagnosticPhotos = latest
    ? (photos || []).filter((photo) => photo.diagnosticId === latest.id || latestPhotoUrls.has(photo.url))
    : (photos || []);
  const photosByZone = useMemo(() => {
    const groups = new Map();
    for (const photo of diagnosticPhotos) {
      const zone = photo.zone || 'Zone non renseignée';
      if (!groups.has(zone)) groups.set(zone, []);
      groups.get(zone).push(photo);
    }
    return [...groups.entries()];
  }, [diagnosticPhotos]);
  const [patrimoine, setPatrimoine] = useState({
    statutPatrimonial: logement.statutPatrimonial,
    dateSortieParc: logement.dateSortieParc || '',
    commentairePatrimonial: logement.commentairePatrimonial || ''
  });
  const [saving, setSaving] = useState(false);
  const [showDevisForm, setShowDevisForm] = useState(false);

  useEffect(() => {
    setPatrimoine({
      statutPatrimonial: logement.statutPatrimonial,
      dateSortieParc: logement.dateSortieParc || '',
      commentairePatrimonial: logement.commentairePatrimonial || ''
    });
  }, [logement.id, logement.statutPatrimonial, logement.dateSortieParc, logement.commentairePatrimonial]);

  async function savePatrimoine() {
    setSaving(true);
    try {
      await api.updatePatrimoine(logement.id, patrimoine);
      onUpdated(await api.logement(logement.id));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel detailPanel">
      {showDevisForm && (
        <DevisForm
          logement={logement}
          prefilledPostes={(latest?.items || []).filter((it) => ['dangereux', 'tres_degrade', 'degrade'].includes(it.etat)).map((it) => it.element || it.item).slice(0, 8)}
          user={user}
          onCreated={() => setShowDevisForm(false)}
          onCancel={() => setShowDevisForm(false)}
        />
      )}
      <div className="sectionTitle">
        <div><h1>{logement.code_acces}</h1><p>{logement.adresse}</p></div>
        <div className="badgeStack">
          <span className={badgeClass(logement.statutPatrimonial)}>{patrimoineLabel(meta, logement.statutPatrimonial)}</span>
          <span className={badgeClass(logement.niveauUrgence)}>{label(URGENCES, logement.niveauUrgence)}</span>
        </div>
      </div>
      <div className="facts">
        <Fact label="Secteur" value={logement.secteur} />
        <Fact label="Quartier" value={logement.quartier} />
        <Fact label="LTS" value={logement.nom_lts} />
        <Fact label="Adresse" value={logement.adresse} />
        <Fact label="Type" value={logement.type_logement} />
        <Fact label="Occupation" value={logement.statut} />
        <Fact label="État général" value={logement.etat_general} />
        <Fact label="Dans parc actif" value={logement.dansParcActif ? 'Oui' : 'Non'} />
        <Fact label="Diagnostic obligatoire" value={logement.diagnosticObligatoire ? 'Oui' : 'Non'} />
        <Fact label="Date sortie parc" value={logement.dateSortieParc || 'Non renseignée'} />
        <Fact label="Coût estimé total" value={money(logement.coutEstimeTotal)} />
      </div>
      <LogementConfiguration logement={logement} configuration={configuration} pieces={pieces} meta={meta} user={user} onUpdated={onUpdated} />
      <section className="patrimoineEditor">
        <h2>Gestion patrimoniale</h2>
        <div className="filterGrid">
          <Select label="Statut patrimonial" value={patrimoine.statutPatrimonial} onChange={(value) => setPatrimoine((current) => ({ ...current, statutPatrimonial: value }))} options={meta?.patrimoine?.statuts?.map((item) => [item.value, item.label]) || []} />
          <label>Date sortie parc<input type="date" value={patrimoine.dateSortieParc} onChange={(event) => setPatrimoine((current) => ({ ...current, dateSortieParc: event.target.value }))} /></label>
          <label className="full">Commentaire patrimonial<textarea value={patrimoine.commentairePatrimonial} onChange={(event) => setPatrimoine((current) => ({ ...current, commentairePatrimonial: event.target.value }))} /></label>
        </div>
        <button className="secondary" onClick={savePatrimoine} disabled={saving}><Save size={18} /> Mettre à jour</button>
      </section>
      <div className="actions">
        {canResume && <button onClick={onResume}><RefreshCw size={18} /> Reprendre diagnostic</button>}
        <button onClick={onStart}><Play size={18} /> Démarrer diagnostic</button>
        <button className="secondary" onClick={() => setShowDevisForm(true)}><Plus size={18} /> Créer un devis</button>
        <a className="button secondary" href={exportUrl(`/api/exports/logement/${logement.id}.pdf`)} target="_blank" rel="noreferrer"><FileText size={18} /> Export PDF logement</a>
        <a className="button secondary" href={exportUrl(`/api/exports/lts/${logement.code_lts}.pdf`)} target="_blank" rel="noreferrer"><FileText size={18} /> Export PDF LTS</a>
        <a className="button secondary" href={exportUrl(`/api/exports/secteur/${logement.secteur}.pdf`)} target="_blank" rel="noreferrer"><FileText size={18} /> Export PDF secteur</a>
        <a className="button secondary" href={exportUrl(`/api/exports/logement/${logement.id}-travaux.xlsx`)}><FileText size={18} /> Export Excel travaux logement</a>
        <a className="button secondary" href={exportUrl(`/api/exports/lts/${logement.code_lts}.xlsx`)}><FileText size={18} /> Export Excel LTS</a>
        <a className="button secondary" href={exportUrl(`/api/exports/secteur/${logement.secteur}.xlsx`)}><FileText size={18} /> Export Excel secteur</a>
      </div>
      <section>
        <h2>Historique diagnostics</h2>
        <div className="timeline">
          {diagnostics.length === 0 && <p className="muted">Aucun diagnostic enregistré.</p>}
          {diagnostics.map((diagnostic) => (
            <article key={diagnostic.id}>
              <strong>{diagnostic.statut}</strong>
              <span>{new Date(diagnostic.dateModification || diagnostic.dateDebut).toLocaleString('fr-FR')}</span>
              <small>{diagnostic.agent?.prenom || diagnostic.agent?.nom || 'Agent non renseigné'} · {money(diagnostic.coutTotal)}</small>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Galerie diagnostic</h2>
        <div className="diagnosticGallery">
          {diagnosticPhotos.length === 0 && <p className="muted">Aucune photo associée.</p>}
          {photosByZone.map(([zone, zonePhotos]) => (
            <div className="galleryZone" key={zone}>
              <h3>{zone}</h3>
              <div className="photoGrid">
                {zonePhotos.map((photo) => (
                  <figure className="photoCard" key={photo.id}>
                    <img src={`${API_URL}${photo.url}`} alt={photo.element || 'Photo diagnostic'} />
                    <figcaption>
                      <strong>{photo.element || 'Élément non renseigné'}</strong>
                      <span>{new Date(photo.date || photo.dateHeure).toLocaleString('fr-FR')}</span>
                      <span>{photo.agentNom || photo.agent?.prenom || photo.agent?.nom || photo.agentId || 'Agent non renseigné'}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
