import React, { useEffect, useState } from 'react';
import { Archive, ChevronLeft, History, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Loading } from '../components/ui';

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

function urgenceLabel(u) {
  return { faible: 'Faible', moyenne: 'Moyenne', haute: 'Haute', urgente: 'Urgente' }[u] || (u || '-');
}

export default function ArchivePage({ user }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('');
  const [secteur, setSecteur] = useState('');
  const [historique, setHistorique] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (selectedYear) params.annee = selectedYear;
      if (secteur) params.secteur = secteur;
      const json = await api.archiveDiagnostics(params);
      setData(json || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedYear, secteur]);

  async function showHistorique(logementId) {
    try {
      const json = await api.archiveHistorique(logementId);
      setHistorique(json);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  }

  if (historique) {
    return (
      <div className="panel">
        <button onClick={() => setHistorique(null)} className="secondary"><ChevronLeft size={16} /> Retour à l'archive</button>
        <h1 style={{marginTop: 12}}><History size={20} /> Historique - {historique.logement.code_acces}</h1>
        <p className="muted">{historique.logement.adresse}</p>
        {historique.historique.length === 0 ? (
          <p className="muted">Aucun diagnostic dans l'historique.</p>
        ) : (
          <div className="archiveTimeline">
            {historique.historique.map((d, i) => {
              const prev = historique.historique[i + 1];
              const diff = prev ? d.itemsDegrades - prev.itemsDegrades : null;
              const diffBudget = prev ? d.coutTotal - prev.coutTotal : null;
              return (
                <article key={d.id} className="archiveCard">
                  <header>
                    <strong>{d.annee} - {formatDate(d.date)}</strong>
                    <span className={`badge ${d.urgenceGlobale}`}>{urgenceLabel(d.urgenceGlobale)}</span>
                  </header>
                  <dl>
                    <div><dt>Agent</dt><dd>{d.agent || '-'}</dd></div>
                    <div><dt>Statut</dt><dd>{d.statut}</dd></div>
                    <div><dt>Items contrôlés</dt><dd>{d.itemsCount}</dd></div>
                    <div><dt>Items dégradés</dt><dd>{d.itemsDegrades} {diff !== null && diff !== 0 && <span className={diff > 0 ? 'evolNeg' : 'evolPos'}>({diff > 0 ? '+' : ''}{diff} vs précédent)</span>}</dd></div>
                    <div><dt>Budget estimé</dt><dd>{formatMontant(d.coutTotal)} {diffBudget !== null && diffBudget !== 0 && <span className={diffBudget > 0 ? 'evolNeg' : 'evolPos'}>({diffBudget > 0 ? '+' : ''}{formatMontant(diffBudget)})</span>}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const yearsAvailable = data.map((d) => d.annee);
  const totalDiags = data.reduce((s, y) => s + y.count, 0);
  const totalBudget = data.reduce((s, y) => s + y.budgetTotal, 0);

  return (
    <div className="panel">
      <div className="planningHeader">
        <div>
          <h1><Archive size={22} /> Archive des diagnostics</h1>
          <p className="muted">{totalDiags} diagnostic(s) · Budget cumulé {formatMontant(totalBudget)}</p>
        </div>
        <button onClick={load}><RefreshCw size={16} /> Actualiser</button>
      </div>

      <div className="planningFilters">
        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
          <option value="">Toutes les années</option>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input value={secteur} onChange={(e) => setSecteur(e.target.value)} placeholder="Filtrer par secteur..." />
      </div>

      {loading ? <Loading /> : (
        data.length === 0 ? <p className="muted">Aucun diagnostic trouvé pour ces filtres.</p> :
        data.map((yearGroup) => (
          <section key={yearGroup.annee} className="archiveYear">
            <h2>{yearGroup.annee} <span className="muted">- {yearGroup.count} diagnostic(s) - {formatMontant(yearGroup.budgetTotal)}</span></h2>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Logement</th>
                    <th>Adresse</th>
                    <th>Secteur</th>
                    <th>Agent</th>
                    <th>Statut</th>
                    <th>Urgence</th>
                    <th>Budget</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {yearGroup.diagnostics.map((d) => (
                    <tr key={d.id}>
                      <td>{formatDate(d.dateDiagnostic)}</td>
                      <td><b>{d.code_acces}</b></td>
                      <td>{d.adresse}</td>
                      <td>{d.secteur}</td>
                      <td>{d.agent || '-'}</td>
                      <td>{d.statut}</td>
                      <td><span className={`badge ${d.urgenceGlobale}`}>{urgenceLabel(d.urgenceGlobale)}</span></td>
                      <td><b>{formatMontant(d.coutTotal)}</b></td>
                      <td><button onClick={() => showHistorique(d.logementId)} title="Voir l'historique"><History size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
