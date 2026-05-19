import React, { useState } from 'react';
import { Building, Save } from 'lucide-react';
import { api } from '../services/api';

const ETAGES = [
  { value: 'RDC', label: 'Rez-de-chaussée (RDC)' },
  { value: 'N+1', label: '1er étage (N+1)' },
  { value: 'N+2', label: '2e étage (N+2)' },
  { value: 'N+3', label: '3e étage (N+3)' }
];

const COUVERTURES = [
  { value: 'tole', label: 'Tôle' },
  { value: 'tuile', label: 'Tuile' },
  { value: 'beton', label: 'Béton / terrasse' },
  { value: 'ardoise', label: 'Ardoise' }
];

export default function CaracteristiquesSection({ logement, user, onUpdated }) {
  const [data, setData] = useState({
    etage: logement.etage || 'RDC',
    couverture: logement.couverture || 'tole',
    hasCours: logement.hasCours !== false
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function update(field, value) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...data, agentId: user?.id || null };
      await api.updateCaracteristiques(logement.id, payload);
      setMessage('Caractéristiques enregistrées ✓');
      if (onUpdated) {
        const updated = await api.logement(logement.id);
        onUpdated(updated);
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="caracteristiquesSection">
      <h2><Building size={18} /> Caractéristiques structurelles</h2>
      <p className="muted">Étage, type de couverture, présence de cours. Ces infos déterminent les items générés au démarrage d'un nouveau diagnostic.</p>

      <div className="caracGrid">
        <label className="caracField">
          <span className="caracLabel">Niveau / étage</span>
          <select value={data.etage} onChange={(e) => update('etage', e.target.value)}>
            {ETAGES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <small className="muted">Si RDC : cours générées. Si étage : escalier + balcon générés.</small>
        </label>

        <label className="caracField">
          <span className="caracLabel">Type de toiture</span>
          <select value={data.couverture} onChange={(e) => update('couverture', e.target.value)}>
            {COUVERTURES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <small className="muted">Tôle = items spécifiques (faîtage, fixations, corrosion).</small>
        </label>

        <label className="caracField caracCheckbox">
          <input type="checkbox" checked={data.hasCours} onChange={(e) => update('hasCours', e.target.checked)} />
          <span>Logement avec cours avant/arrière</span>
          <small className="muted">À décocher pour SAPOTIS ou logements à l'étage sans cour.</small>
        </label>
      </div>

      <div className="caracFooter">
        <button onClick={save} disabled={saving} className="primary">
          <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {message && <span className={message.startsWith('Erreur') ? 'error' : 'muted'}>{message}</span>}
      </div>
    </section>
  );
}
