import React, { useEffect, useState } from 'react';
import { Eye, Filter, RefreshCw, Search } from 'lucide-react';
import { api } from '../services/api';
import { Loading } from '../components/ui';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

function labelAction(a) {
  const map = {
    connexion: 'Connexion',
    connexion_echec: 'Échec connexion',
    connexion_refusee_agent_inactif: 'Connexion refusée',
    photo_suppression: 'Suppression photo',
    devis_cree: 'Création devis',
    devis_statut_change: 'Changement statut devis',
    devis_supprime: 'Suppression devis',
    devis_pdf_upload: 'Upload PDF devis',
    devis_pdf_supprime: 'Suppression PDF devis',
    conformite_mise_a_jour: 'Conformité mise à jour'
  };
  return map[a] || a;
}

export default function AuditPage({ user }) {
  const [data, setData] = useState({ total: 0, actions: [], entries: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', logementId: '', dateFrom: '', dateTo: '', q: '' });
  const [details, setDetails] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const result = await api.audit(filters);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function update(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setFilters({ action: '', logementId: '', dateFrom: '', dateTo: '', q: '' });
    setTimeout(load, 0);
  }

  return (
    <div className="panel">
      <div className="planningHeader">
        <div>
          <h1><Eye size={22} /> Journal d'audit</h1>
          <p className="muted">{data.total} action(s) enregistrée(s)</p>
        </div>
        <button onClick={load}><RefreshCw size={16} /> Actualiser</button>
      </div>

      <div className="auditFilters">
        <label>Action
          <select value={filters.action} onChange={(e) => update('action', e.target.value)}>
            <option value="">Toutes</option>
            {data.actions.map((a) => <option key={a} value={a}>{labelAction(a)}</option>)}
          </select>
        </label>
        <label>Logement (ID)
          <input value={filters.logementId} onChange={(e) => update('logementId', e.target.value)} placeholder="LTS-001-001" />
        </label>
        <label>Du
          <input type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
        </label>
        <label>Au
          <input type="date" value={filters.dateTo} onChange={(e) => update('dateTo', e.target.value)} />
        </label>
        <label>Recherche libre
          <input value={filters.q} onChange={(e) => update('q', e.target.value)} placeholder="entreprise, agent, code..." />
        </label>
        <div className="auditActions">
          <button onClick={load} className="primary"><Filter size={14} /> Filtrer</button>
          <button onClick={reset} className="secondary">Réinitialiser</button>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Logement</th>
                <th>Agent</th>
                <th>Détails</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr><td colSpan="6" className="muted">Aucune entrée pour ces filtres.</td></tr>
              ) : data.entries.map((e, i) => (
                <tr key={e.id || i}>
                  <td>{formatDate(e.date)}</td>
                  <td><b>{labelAction(e.action)}</b></td>
                  <td>{e.logementId || e.logement_id || '-'}</td>
                  <td>{e.agentNom || e.agentId || e.userId || '-'}</td>
                  <td>{e.commentaire || (e.ancien && `${e.ancien} → ${e.nouveau}`) || (e.entreprise) || (e.champsModifies?.join(', ')) || '-'}</td>
                  <td><button onClick={() => setDetails(e)} title="Voir JSON brut"><Search size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {details && (
        <div className="modalOverlay" onClick={(e) => { if (e.target === e.currentTarget) setDetails(null); }}>
          <div className="modalContent">
            <h3>Détail action</h3>
            <pre style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px', overflowX: 'auto', fontSize: '12px' }}>
              {JSON.stringify(details, null, 2)}
            </pre>
            <div className="formActions">
              <button onClick={() => setDetails(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
