import React, { useEffect, useRef, useState } from 'react';
import { MapPinned, Navigation, RefreshCw, Crosshair } from 'lucide-react';
import { api } from '../services/api';

const URGENCE_COLORS = {
  urgente: '#b42318',
  haute: '#f97316',
  moyenne: '#eab308',
  faible: '#16a34a',
  non_diagnostique: '#94a3b8'
};

const URGENCE_LABELS = {
  urgente: 'Urgente',
  haute: 'Haute',
  moyenne: 'Moyenne',
  faible: 'Faible',
  non_diagnostique: 'Non diagnostiqué'
};

// Centre par défaut : Saint-Denis de La Réunion
const DEFAULT_CENTER = [-20.879, 55.448];
const DEFAULT_ZOOM = 13;

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Impossible de charger Leaflet'));
    document.head.appendChild(script);
  });
}

function formatMontant(n) {
  return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' €';
}

export default function MapPage({ user }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const [data, setData] = useState({ logements: [], totalLogements: 0, geocoded: 0, sansCoords: 0 });
  const [status, setStatus] = useState({ inProgress: false, geocoded: 0, total: 0, sansCoords: 0 });
  const [filtreUrgence, setFiltreUrgence] = useState('');
  const [filtreSecteur, setFiltreSecteur] = useState('');
  const [loading, setLoading] = useState(true);
  const [batchLaunched, setBatchLaunched] = useState(false);
  const [recalageBusy, setRecalageBusy] = useState(false);

  async function loadData() {
    try {
      const result = await api.logementsWithCoords();
      // Garde-fou : ne mettre à jour que si la réponse a bien la forme attendue
      // (évite de planter le rendu si le backend renvoie une erreur / réponse hors-ligne)
      if (result && Array.isArray(result.logements)) setData(result);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStatus() {
    try {
      const s = await api.geocodeStatus();
      setStatus(s);
    } catch (err) {
      console.error(err);
    }
  }

  async function launchGeocodeBatch() {
    setBatchLaunched(true);
    try {
      await api.geocodeBatch(50);
      // Refresh status toutes les 3s tant que ça tourne
      const poll = setInterval(async () => {
        await loadStatus();
        await loadData();
      }, 5000);
      setTimeout(() => clearInterval(poll), 120000); // arrêt poll après 2 min max
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  }

  async function recalerLts() {
    if (!window.confirm('Recaler les logements mal placés sur le centre de leur LTS ?\n\nLes logements aberrants ou sans coordonnées seront regroupés autour de leur résidence (LTS). Les logements déjà bien placés ne bougent pas.')) return;
    setRecalageBusy(true);
    try {
      const r = await api.recalerLts();
      await loadData();
      await loadStatus();
      alert(`Recalage terminé : ${r.recales} logement(s) repositionné(s) sur ${r.totalLts} LTS.`);
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setRecalageBusy(false);
    }
  }

  // Init Leaflet
  useEffect(() => {
    let mounted = true;
    (async () => {
      const L = await loadLeaflet();
      if (!mounted || !mapRef.current || mapInstance.current) return;
      mapInstance.current = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(mapInstance.current);
      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
      await loadData();
      await loadStatus();
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Met à jour les marqueurs quand data ou filtres changent
  useEffect(() => {
    const L = window.L;
    if (!L || !markersLayer.current) return;
    markersLayer.current.clearLayers();
    const filtered = data.logements.filter((l) => {
      if (filtreUrgence && l.urgenceGlobale !== filtreUrgence) return false;
      if (filtreSecteur && String(l.secteur) !== filtreSecteur) return false;
      return true;
    });
    for (const log of filtered) {
      const color = URGENCE_COLORS[log.urgenceGlobale] || '#94a3b8';
      const icon = L.divIcon({
        className: 'mapMarker',
        html: `<div style="background:${color}" class="mapMarkerDot"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const marker = L.marker([log.latitude, log.longitude], { icon });
      const popup = `
        <div class="mapPopup">
          <strong>${log.code_acces}</strong><br/>
          <small>${log.adresse || ''}</small><br/>
          <span style="color:${color};font-weight:600">${URGENCE_LABELS[log.urgenceGlobale] || log.urgenceGlobale}</span><br/>
          ${log.diagnostique ? `Budget estimé : <b>${formatMontant(log.coutTotal)}</b><br/>` : ''}
          <small>Secteur ${log.secteur || '?'} · ${log.dansParcActif ? 'Parc actif' : 'Hors parc'}</small>
        </div>
      `;
      marker.bindPopup(popup);
      markersLayer.current.addLayer(marker);
    }
    // Auto-fit si on a des marqueurs
    if (filtered.length > 0 && mapInstance.current && filtered.length === data.logements.length) {
      const bounds = L.latLngBounds(filtered.map((l) => [l.latitude, l.longitude]));
      mapInstance.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [data, filtreUrgence, filtreSecteur]);

  const secteurs = [...new Set(data.logements.map((l) => String(l.secteur)).filter(Boolean))].sort();

  return (
    <div className="panel mapPanel">
      <div className="planningHeader">
        <div>
          <h1><MapPinned size={22} /> Cartographie du parc</h1>
          <p className="muted">
            {data.geocoded} / {data.totalLogements} logements géocodés
            {data.sansCoords > 0 && ` · ${data.sansCoords} restant${data.sansCoords > 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data.sansCoords > 0 && (
            <button onClick={launchGeocodeBatch} disabled={batchLaunched || status.inProgress} className="primary">
              <Navigation size={16} /> {status.inProgress || batchLaunched ? 'Géocodage en cours...' : `Géocoder ${Math.min(50, data.sansCoords)} logements`}
            </button>
          )}
          {user?.role === 'admin' && (
            <button onClick={recalerLts} disabled={recalageBusy} className="secondary" title="Replace les logements mal situés sur le centre de leur LTS">
              <Crosshair size={16} /> {recalageBusy ? 'Recalage...' : 'Recaler par LTS'}
            </button>
          )}
          <button onClick={() => { loadData(); loadStatus(); }} className="iconBtn" title="Actualiser"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="planningFilters">
        <select value={filtreUrgence} onChange={(e) => setFiltreUrgence(e.target.value)}>
          <option value="">Toutes urgences</option>
          {Object.entries(URGENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtreSecteur} onChange={(e) => setFiltreSecteur(e.target.value)}>
          <option value="">Tous secteurs</option>
          {secteurs.map((s) => <option key={s} value={s}>Secteur {s}</option>)}
        </select>
      </div>

      <div className="mapLegend">
        {Object.entries(URGENCE_LABELS).map(([v, l]) => (
          <span key={v} className="mapLegendItem">
            <span className="legendDot" style={{ background: URGENCE_COLORS[v] }} />
            {l}
          </span>
        ))}
      </div>

      <div ref={mapRef} className="mapContainer">
        {loading && <p className="muted" style={{ padding: 20 }}>Chargement de la carte...</p>}
      </div>

      {data.totalLogements > 0 && data.geocoded === 0 && !status.inProgress && (
        <p className="muted" style={{ marginTop: 12 }}>
          ℹ️ Aucun logement géocodé. Clique sur "Géocoder X logements" pour commencer (~1 minute pour 50 logements via OpenStreetMap).
        </p>
      )}
    </div>
  );
}
