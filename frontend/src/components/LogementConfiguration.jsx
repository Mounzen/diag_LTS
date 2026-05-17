import React, { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { api } from '../services/api';
import { Select } from './ui';

export default function LogementConfiguration({ logement, configuration, pieces = [], meta, user, onUpdated }) {
  const [draft, setDraft] = useState(configuration || {});
  const [piece, setPiece] = useState({ nom: '', type: 'chambre', surfaceEstimee: '', commentaire: '' });
  const [saving, setSaving] = useState(false);
  const typesPieces = meta?.configurationLogement?.typesPieces?.map((item) => [item.value, item.label]) || [];

  useEffect(() => {
    setDraft(configuration || {});
  }, [configuration?.id, logement.id]);

  function patch(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveConfiguration() {
    setSaving(true);
    try {
      await api.updateLogementConfiguration(logement.id, {
        ...draft,
        agentId: user?.id,
        agentNom: user?.prenom || user?.nom
      });
      onUpdated(await api.logement(logement.id));
    } finally {
      setSaving(false);
    }
  }

  async function addPiece() {
    if (!piece.type) return;
    setSaving(true);
    try {
      await api.createPiece(logement.id, {
        ...piece,
        agentId: user?.id,
        agentNom: user?.prenom || user?.nom
      });
      setPiece({ nom: '', type: 'chambre', surfaceEstimee: '', commentaire: '' });
      onUpdated(await api.logement(logement.id));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="configurationEditor">
      <div className="sectionTitle">
        <div>
          <h2>Configuration réelle du logement</h2>
          <p>Cette configuration génère les points de diagnostic sans supprimer les éléments existants.</p>
        </div>
      </div>
      <div className="filterGrid">
        <label>Type théorique<input value={draft.typeLogementTheorique || ''} onChange={(event) => patch('typeLogementTheorique', event.target.value)} /></label>
        <label>Configuration constatée<input value={draft.configurationReelleConstatee || ''} onChange={(event) => patch('configurationReelleConstatee', event.target.value)} placeholder="Ex. T3 réel avec varangue" /></label>
        <label>Chambres<input type="number" min="0" value={draft.nombreChambres ?? 0} onChange={(event) => patch('nombreChambres', Number(event.target.value))} /></label>
        <label>Pièces supplémentaires<input type="number" min="0" value={draft.nombrePiecesSupplementaires ?? 0} onChange={(event) => patch('nombrePiecesSupplementaires', Number(event.target.value))} /></label>
      </div>
      <div className="toggleGrid">
        {[
          ['sejour', 'Séjour'],
          ['cuisine', 'Cuisine'],
          ['salleDeBain', 'Salle de bain'],
          ['wc', 'WC'],
          ['varangueTerrasse', 'Varangue / terrasse'],
          ['dependance', 'Dépendance'],
          ['cour', 'Cour'],
          ['garageAbri', 'Garage / abri']
        ].map(([key, text]) => (
          <label key={key} className="checkLine"><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => patch(key, event.target.checked)} /> {text}</label>
        ))}
      </div>
      <label className="full">Autre pièce<input value={draft.autrePiece || ''} onChange={(event) => patch('autrePiece', event.target.value)} /></label>
      <label className="full">Commentaire configuration<textarea value={draft.commentaire || ''} onChange={(event) => patch('commentaire', event.target.value)} /></label>
      <button className="secondary" onClick={saveConfiguration} disabled={saving}><Save size={18} /> Enregistrer configuration</button>

      <div className="piecesHeader">
        <h3>Pièces ajoutées</h3>
        <span className="badge neutral">{pieces.length} pièce(s)</span>
      </div>
      <div className="pieceList">
        {pieces.length === 0 && <p className="muted">Aucune pièce ajoutée depuis le terrain.</p>}
        {pieces.map((item) => (
          <article key={item.id} className="pieceCard">
            <strong>{item.nom}</strong>
            <span>{typesPieces.find(([value]) => value === item.type)?.[1] || item.type}</span>
            <small>{item.elementsDiagnostic?.length || 0} éléments générés · {item.surfaceEstimee || 0} m²</small>
          </article>
        ))}
      </div>
      <div className="addPiece">
        <Select label="Type pièce" value={piece.type} onChange={(value) => setPiece((current) => ({ ...current, type: value }))} options={typesPieces} />
        <label>Nom<input value={piece.nom} onChange={(event) => setPiece((current) => ({ ...current, nom: event.target.value }))} placeholder="Ex. Chambre 1" /></label>
        <label>Surface estimée<input type="number" min="0" value={piece.surfaceEstimee} onChange={(event) => setPiece((current) => ({ ...current, surfaceEstimee: event.target.value }))} /></label>
        <label className="full">Commentaire<input value={piece.commentaire} onChange={(event) => setPiece((current) => ({ ...current, commentaire: event.target.value }))} /></label>
        <button onClick={addPiece} disabled={saving}><Plus size={18} /> Ajouter pièce</button>
      </div>
    </section>
  );
}
