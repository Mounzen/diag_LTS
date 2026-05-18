import React, { useEffect, useState } from 'react';
import { Camera, ClipboardCheck, Euro, Hammer, History, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Loading } from './ui';
import PhotoCompareSlider from './PhotoCompareSlider';

function formatDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return '-'; }
}
function formatMontant(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €'; }

const TYPE_META = {
  diagnostic: { icon: ClipboardCheck, color: '#1457a8', label: 'Diagnostic' },
  devis: { icon: Euro, color: '#eab308', label: 'Devis' },
  intervention: { icon: Hammer, color: '#16a34a', label: 'Intervention' }
};

export default function TimelineLogement({ logementId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await api.timeline(logementId);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (logementId) load(); }, [logementId]);

  if (loading) return <Loading />;
  if (!data) return <p className="muted">Erreur de chargement.</p>;
  if (!data.events.length) {
    return (
      <section className="timelineSection">
        <h2><History size={18} /> Chronologie du logement</h2>
        <p className="muted">Aucun événement à afficher. Démarre un diagnostic pour commencer l'historique.</p>
      </section>
    );
  }

  return (
    <section className="timelineSection">
      <div className="timelineHeader">
        <h2><History size={18} /> Chronologie du logement</h2>
        <button onClick={load} className="iconBtn" title="Actualiser"><RefreshCw size={14} /></button>
      </div>
      <div className="timeline">
        {data.events.map((event) => {
          const meta = TYPE_META[event.type] || { icon: ClipboardCheck, color: '#64748b', label: event.type };
          const Icon = meta.icon;
          return (
            <article key={event.id} className="timelineCard" style={{ borderLeftColor: meta.color }}>
              <header>
                <div className="timelineIcon" style={{ background: meta.color + '20', color: meta.color }}>
                  <Icon size={16} />
                </div>
                <div className="timelineHead">
                  <strong>{meta.label}</strong>
                  <span className="muted">{formatDate(event.date)}</span>
                </div>
              </header>
              {event.type === 'diagnostic' && (
                <dl>
                  <div><dt>Agent</dt><dd>{event.agent || '-'}</dd></div>
                  <div><dt>Statut</dt><dd>{event.statut}</dd></div>
                  <div><dt>Urgence</dt><dd><span className={`badge ${event.urgenceGlobale}`}>{event.urgenceGlobale}</span></dd></div>
                  <div><dt>Items dégradés</dt><dd>{event.itemsDegrades} / {event.itemsCount}</dd></div>
                  <div><dt>Budget estimé</dt><dd>{formatMontant(event.coutTotal)}</dd></div>
                </dl>
              )}
              {event.type === 'devis' && (
                <dl>
                  <div><dt>Entreprise</dt><dd>{event.entrepriseNom}</dd></div>
                  <div><dt>Montant TTC</dt><dd>{formatMontant(event.montantTTC)}</dd></div>
                  <div><dt>Statut</dt><dd>{event.statut}</dd></div>
                  <div><dt>Postes</dt><dd>{(event.postes || []).join(', ')}</dd></div>
                  {event.pdfUrl && <div><dt>PDF</dt><dd><a href={event.pdfUrl.startsWith('http') ? event.pdfUrl : event.pdfUrl} target="_blank" rel="noreferrer">Voir le PDF</a></dd></div>}
                </dl>
              )}
              {event.type === 'intervention' && (
                <>
                  <dl>
                    <div><dt>Entreprise</dt><dd>{event.entrepriseNom || '-'}</dd></div>
                    <div><dt>Statut</dt><dd>{event.statut}</dd></div>
                    <div><dt>Postes</dt><dd>{(event.postes || []).join(', ') || '-'}</dd></div>
                    <div><dt>Coût</dt><dd>{formatMontant(event.cout)}</dd></div>
                    {event.dateFin && <div><dt>Fin</dt><dd>{formatDate(event.dateFin)}</dd></div>}
                  </dl>
                  {(event.photosAvant?.length > 0 || event.photosApres?.length > 0) && (
                    <div className="interventionPhotos">
                      <h4>Photos avant / après</h4>
                      <PhotoCompareSlider photoAvant={event.photosAvant?.[0]} photoApres={event.photosApres?.[0]} />
                    </div>
                  )}
                  {event.commentaire && <p className="timelineComment">{event.commentaire}</p>}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
