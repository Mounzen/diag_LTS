import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, Save } from 'lucide-react';
import { api } from '../services/api';

const OPTIONS_BINAIRE = [
  { value: '', label: '— Non vérifié —' },
  { value: 'present', label: 'Présent / Conforme' },
  { value: 'absent', label: 'Absent / Non conforme' }
];

const OPTIONS_DPE = [
  { value: '', label: '— Non réalisé —' },
  { value: 'A', label: 'A (très performant)' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F (peu performant)' },
  { value: 'G', label: 'G (très peu performant)' }
];

const OPTIONS_AMIANTE = [
  { value: '', label: '— Non vérifié —' },
  { value: 'non_applicable', label: 'Non applicable (bâti > 1997)' },
  { value: 'absent', label: 'Absent' },
  { value: 'present_traite', label: 'Présent, traité' },
  { value: 'present_actif', label: 'Présent, à traiter' }
];

const OPTIONS_OUI_NON = [
  { value: '', label: '— Non vérifié —' },
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' }
];

export default function ConformiteSection({ logement, user }) {
  const [data, setData] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getConformite(logement.id).then((conf) => setData(conf || {})).catch(() => {});
  }, [logement.id]);

  function update(field, value) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...data, agentId: user?.id || null };
      const saved = await api.updateConformite(logement.id, payload);
      setData(saved);
      setMessage('Conformité enregistrée ✓');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderSelect(label, field, options, help) {
    return (
      <label className="conformiteField">
        <span className="conformiteLabel">{label}</span>
        <select value={data[field] || ''} onChange={(e) => update(field, e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {help && <small className="muted">{help}</small>}
      </label>
    );
  }

  // Indicateur visuel global
  const conformeCount = Object.values(data).filter((v) => v === 'present' || v === 'oui' || v === 'absent' || v === 'non_applicable' || (typeof v === 'string' && v.match(/^[A-C]$/))).length;
  const nonConformeCount = Object.values(data).filter((v) => v === 'absent' || v === 'non' || v === 'present_actif' || v === 'present' || (typeof v === 'string' && v.match(/^[E-G]$/))).length;

  return (
    <section className="conformiteSection">
      <h2><ShieldAlert size={18} /> Conformité réglementaire</h2>
      <p className="muted">Obligations légales pour logements municipaux. Mise à jour : {data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('fr-FR') : 'jamais'}</p>

      <div className="conformiteGrid">
        {renderSelect('Détecteur de fumée', 'detecteurFumee', OPTIONS_BINAIRE, 'Obligatoire depuis mars 2015')}
        {renderSelect('Décret décence', 'decretDecence', OPTIONS_OUI_NON, 'Loi SRU - décret 2002-120')}
        {renderSelect('Classement DPE', 'dpe', OPTIONS_DPE, 'Diagnostic de performance énergétique')}
        {renderSelect('Amiante', 'amiante', OPTIONS_AMIANTE, 'DAPP requis si bâti < 1997')}
        {renderSelect('Électricité aux normes', 'electriciteAuxNormes', OPTIONS_OUI_NON, 'Diagnostic électrique > 15 ans')}
        <label className="conformiteField">
          <span className="conformiteLabel">Date de vérification</span>
          <input type="date" value={data.dateVerificationConformite || ''} onChange={(e) => update('dateVerificationConformite', e.target.value)} />
        </label>
        <label className="conformiteField wide">
          <span className="conformiteLabel">Commentaire</span>
          <textarea value={data.commentaireConformite || ''} onChange={(e) => update('commentaireConformite', e.target.value)} rows={2} placeholder="Précisions sur la conformité, prescriptions à venir..." />
        </label>
      </div>

      <div className="conformiteFooter">
        <div className="conformiteStats">
          {conformeCount > 0 && <span className="evolPos">✓ {conformeCount} point(s) conforme(s)</span>}
          {nonConformeCount > 0 && <span className="evolNeg">⚠ {nonConformeCount} point(s) non conforme(s)</span>}
        </div>
        <button onClick={save} disabled={saving} className="primary">
          <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer la conformité'}
        </button>
      </div>
      {message && <p className={message.startsWith('Erreur') ? 'error' : 'muted'} style={{ marginTop: 8 }}>{message}</p>}
    </section>
  );
}
