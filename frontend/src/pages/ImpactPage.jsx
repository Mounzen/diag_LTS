import React, { useEffect, useState } from 'react';
import { Award, Euro, Hammer, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../services/api';
import { Loading } from '../components/ui';

function formatMontant(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €'; }

const ETAT_COLORS = {
  bon: '#16a34a',
  moyen: '#84cc16',
  degrade: '#eab308',
  tres_degrade: '#f97316',
  dangereux: '#b42318',
  non_diagnostique: '#94a3b8'
};

const ETAT_LABELS = {
  bon: 'Bon',
  moyen: 'Moyen',
  degrade: 'Dégradé',
  tres_degrade: 'Très dégradé',
  dangereux: 'Dangereux',
  non_diagnostique: 'Non diagnostiqué'
};

export default function ImpactPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);

  async function load() {
    setLoading(true);
    try {
      const result = await api.statsImpact(annee);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [annee]);

  if (loading) return <div className="panel"><Loading /></div>;
  if (!data) return <div className="panel"><p className="muted">Aucune donnée disponible.</p></div>;

  const totalDist = Object.values(data.distributionEtat).reduce((s, n) => s + n, 0);

  return (
    <div className="panel">
      <div className="planningHeader">
        <div>
          <h1><TrendingUp size={22} /> Impact des travaux</h1>
          <p className="muted">Bilan d'amélioration du parc et indicateurs annuels</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="iconBtn"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="impactKpis">
        <div className="impactKpi">
          <Hammer size={18} className="impactKpiIcon" />
          <strong>{data.interventionsRealisees}</strong>
          <span>intervention(s) réalisée(s) en {data.annee}</span>
        </div>
        <div className="impactKpi">
          <Euro size={18} className="impactKpiIcon" />
          <strong>{formatMontant(data.budgetEngage)}</strong>
          <span>budget engagé (travaux réceptionnés)</span>
        </div>
        <div className="impactKpi">
          <Award size={18} className="impactKpiIcon" />
          <strong>{data.logementsAmeliores}</strong>
          <span>logement(s) amélioré(s) sur {data.totalLogements}</span>
        </div>
        <div className="impactKpi">
          <TrendingUp size={18} className="impactKpiIcon" />
          <strong>{data.interventionsPlanifiees + data.interventionsEnCours}</strong>
          <span>intervention(s) à venir / en cours</span>
        </div>
      </div>

      <section className="impactSection">
        <h2>État actuel du parc</h2>
        <div className="distributionBar">
          {Object.entries(data.distributionEtat).map(([etat, count]) => {
            const pct = totalDist > 0 ? (count / totalDist) * 100 : 0;
            if (pct < 0.5) return null;
            return (
              <div key={etat} className="distSegment" style={{ width: `${pct}%`, background: ETAT_COLORS[etat] }} title={`${ETAT_LABELS[etat]}: ${count}`}>
                {pct > 5 && <span>{count}</span>}
              </div>
            );
          })}
        </div>
        <div className="distLegend">
          {Object.entries(data.distributionEtat).map(([etat, count]) => (
            <div key={etat} className="distLegendItem">
              <span className="distDot" style={{ background: ETAT_COLORS[etat] }} />
              <span>{ETAT_LABELS[etat]} : <b>{count}</b></span>
            </div>
          ))}
        </div>
      </section>

      <section className="impactSection">
        <h2>🏆 Top 10 Success stories {data.annee}</h2>
        {data.successStories.length === 0 ? (
          <p className="muted">Aucune intervention avec diag avant/après pour cette année. Renseigne `diagnosticAvantId` et `diagnosticApresId` dans les interventions pour mesurer l'impact.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Logement</th>
                  <th>Items dégradés (avant)</th>
                  <th>Items dégradés (après)</th>
                  <th>Gain</th>
                  <th>Coût</th>
                </tr>
              </thead>
              <tbody>
                {data.successStories.map((s) => (
                  <tr key={s.intervention}>
                    <td><b>{s.logementCode}</b></td>
                    <td>{s.degAvant}</td>
                    <td>{s.degApres}</td>
                    <td className="evolPos">−{s.gain}</td>
                    <td>{formatMontant(s.cout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
