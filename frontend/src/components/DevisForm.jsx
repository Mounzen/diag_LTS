import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import { api } from '../services/api';

const DEFAULT = {
  entrepriseNom: '',
  entrepriseContact: '',
  entrepriseTelephone: '',
  entrepriseEmail: '',
  postes: '',
  montantHT: '',
  montantTTC: '',
  commentaire: ''
};

/**
 * Formulaire de création d'un devis.
 * Props :
 *  - logement : objet logement (id obligatoire)
 *  - prefilledPostes : array de postes pré-remplis depuis le diagnostic
 *  - user : utilisateur connecté (pour createdBy)
 *  - onCreated(devis) : callback succès
 *  - onCancel() : callback annulation
 */
export default function DevisForm({ logement, prefilledPostes = [], user, onCreated, onCancel }) {
  const [form, setForm] = useState({
    ...DEFAULT,
    postes: prefilledPostes.join(', ')
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.entrepriseNom.trim()) {
      setError('Le nom de l\'entreprise est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        logementId: logement.id,
        entrepriseNom: form.entrepriseNom.trim(),
        entrepriseContact: form.entrepriseContact.trim(),
        entrepriseTelephone: form.entrepriseTelephone.trim(),
        entrepriseEmail: form.entrepriseEmail.trim(),
        postes: form.postes.split(',').map((p) => p.trim()).filter(Boolean),
        montantHT: Number(form.montantHT) || 0,
        montantTTC: Number(form.montantTTC) || 0,
        commentaire: form.commentaire,
        createdBy: user ? { id: user.id, prenom: user.prenom } : null
      };
      const created = await api.createDevis(payload);
      onCreated && onCreated(created);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du devis');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="devisForm" onSubmit={submit}>
      <h3>Nouveau devis - Logement {logement.code_acces}</h3>
      <p className="muted">{logement.adresse}</p>

      <div className="formGrid">
        <label>Entreprise *
          <input value={form.entrepriseNom} onChange={(e) => update('entrepriseNom', e.target.value)} placeholder="Ex: DUPONT BAT" required />
        </label>
        <label>Contact
          <input value={form.entrepriseContact} onChange={(e) => update('entrepriseContact', e.target.value)} placeholder="Nom du contact" />
        </label>
        <label>Téléphone
          <input value={form.entrepriseTelephone} onChange={(e) => update('entrepriseTelephone', e.target.value)} placeholder="01 23 45 67 89" />
        </label>
        <label>Email
          <input type="email" value={form.entrepriseEmail} onChange={(e) => update('entrepriseEmail', e.target.value)} placeholder="contact@entreprise.fr" />
        </label>
        <label className="wide">Postes de travaux (séparés par virgule)
          <input value={form.postes} onChange={(e) => update('postes', e.target.value)} placeholder="Façade, Toiture, Électricité..." />
        </label>
        <label>Montant HT (€)
          <input type="number" value={form.montantHT} onChange={(e) => update('montantHT', e.target.value)} placeholder="0" min="0" step="0.01" />
        </label>
        <label>Montant TTC (€)
          <input type="number" value={form.montantTTC} onChange={(e) => update('montantTTC', e.target.value)} placeholder="0" min="0" step="0.01" />
        </label>
        <label className="wide">Commentaire
          <textarea value={form.commentaire} onChange={(e) => update('commentaire', e.target.value)} rows={3} placeholder="Précisions, contexte..." />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="formActions">
        <button type="button" onClick={onCancel} disabled={saving}>
          <X size={16} /> Annuler
        </button>
        <button type="submit" className="primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Enregistrement...' : 'Créer le devis'}
        </button>
      </div>
    </form>
  );
}
