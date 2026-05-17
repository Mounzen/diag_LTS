import React, { useEffect, useState, useMemo } from 'react';
import { CalendarClock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Loading, Select } from '../components/ui';
import DevisForm from '../components/DevisForm';

const STATUTS = [
  { value: '', label: 'Tous statuts' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'recu', label: 'Reçu' },
  { value: 'valide', label: 'Validé' },
  { value: 'refuse', label: 'Refusé' },
  { value: 'realise', label: 'Réalisé' }
];

const STATUT_LABEL = {
  en_attente: 'En attente',
  recu: 'Reçu',
  valide: 'Validé',
  refuse: 'Refusé',
  realise: 'Réalisé'
};

function formatMontant(n) {
  return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €';
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

export default function PlanningPage({ user }) {
  const [devisList, setDevisList] = useState([]);
  const [logements, setLogements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState('');
  const [logementFilter, setLogementFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLogement, setSelectedLogement] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [devis, logs] = await Promise.all([
        api.devisList(),
        api.logements()
      ]);
      setDevisList(devis || []);
      setLogements(logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return devisList.filter((d) => {
      if (statut && d.statut !== statut) return false;
      if (logementFilter && d.logementId !== logementFilter) return false;
      return true;
    });
  }, [devisList, statut, logementFilter]);

  const totalMontant = filtered.reduce((sum, d) => sum + Number(d.montantTTC || 0), 0);

  async function changeStatut(devis, newStatut) {
    try {
      await api.updateDevis(devis.id, { statut: newStatut });
      await load();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  }

  async function remove(devis) {
    if (!confirm(`Supprimer le devis ${devis.entrepriseNom} - ${formatMontant(devis.montantTTC)} ?`)) return;
    try {
      await api.deleteDevis(devis.id);
      await load();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  }

  function startCreate() {
    if (!selectedLogement) {
      alert('Sélectionne d\'abord un logement.');
      return;
    }
    setShowCreate(true);
  }

  function onCreated() {
    setShowCreate(false);
    setSelectedLogement('');
    load();
  }

  const logementForCreate = logements.find((l) => l.id === selectedLogement);

  if (showCreate && logementForCreate) {
    return (
      <div className="panel">
        <DevisForm
          logement={logementForCreate}
          user={user}
          onCreated={onCreated}
          onCancel={() => setShowCreate(false)}
        />
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="planningHeader">
        <div>
          <h1><CalendarClock size={22} /> Planning - Devis et travaux</h1>
          <p className="muted">{filtered.length} devis affiché(s) · Total {formatMontant(totalMontant)} TTC</p>
        </div>
        <button onClick={load} title="Recharger"><RefreshCw size={16} /> Actualiser</button>
      </div>

      <div className="planningFilters">
        <Select value={statut} onChange={setStatut} options={STATUTS.map((s) => [s.value, s.label])} />
        <select value={logementFilter} onChange={(e) => setLogementFilter(e.target.value)}>
          <option value="">Tous logements</option>
          {logements.slice(0, 200).map((l) => (
            <option key={l.id} value={l.id}>{l.code_acces} - {l.adresse}</option>
          ))}
        </select>
      </div>

      <div className="planningCreate">
        <select value={selectedLogement} onChange={(e) => setSelectedLogement(e.target.value)}>
          <option value="">Choisir un logement...</option>
          {logements.slice(0, 200).map((l) => (
            <option key={l.id} value={l.id}>{l.code_acces} - {l.adresse}</option>
          ))}
        </select>
        <button onClick={startCreate} className="primary"><Plus size={16} /> Nouveau devis</button>
      </div>

      {loading ? <Loading /> : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Logement</th>
                <th>Entreprise</th>
                <th>Postes</th>
                <th>Montant TTC</th>
                <th>Date demande</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="muted">Aucun devis pour ces filtres.</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.logementCode}</b></td>
                  <td>{d.entrepriseNom}<br /><span className="muted">{d.entrepriseEmail}</span></td>
                  <td>{(d.postes || []).join(', ')}</td>
                  <td><b>{formatMontant(d.montantTTC)}</b></td>
                  <td>{formatDate(d.dateDemande)}</td>
                  <td>
                    <select value={d.statut} onChange={(e) => changeStatut(d, e.target.value)}>
                      {STATUTS.slice(1).map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td><button onClick={() => remove(d)} title="Supprimer"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
