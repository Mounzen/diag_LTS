export const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.12:3001';
async function parseResponse(res) {
  const type = res.headers.get('content-type') || '';
  if (!res.ok) {
    const payload = type.includes('application/json') ? await res.json().catch(() => ({})) : {};
    throw new Error(payload.message || 'Erreur API');
  }
  return type.includes('application/json') ? res.json() : res.blob();
}

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const method = (options.method || 'GET').toUpperCase();
  // Si hors-ligne et opération d'écriture (POST/PUT/DELETE) : enqueue pour resync
  const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (typeof navigator !== 'undefined' && !navigator.onLine && isWrite && !(options.body instanceof FormData)) {
    try {
      const { enqueueOperation } = await import('../utils/offlineStore.js');
      let body = null;
      if (options.body) {
        try { body = JSON.parse(options.body); } catch { body = options.body; }
      }
      await enqueueOperation({ method, path, body, label: path });
      // Renvoyer une réponse optimiste pour ne pas casser l'UI
      return body || { offline: true, queued: true };
    } catch (err) {
      console.warn('Offline enqueue failed:', err);
    }
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return parseResponse(res);
}

function qs(params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  const query = new URLSearchParams(clean).toString();
  return query ? `?${query}` : '';
}

export const exportUrl = (path, params = {}) => `${API_URL}${path}${qs(params)}`;

// Retourne l'URL absolue d'un asset (photo, PDF). Si l'URL est déjà absolue (http*), la retourne telle quelle.
// Sinon préfixe avec API_URL (cas des anciens uploads en /uploads/...).
export const assetUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
};

// Compression d'image côté client avant upload.
// Réduit une photo téléphone (3-5 MB) à ~500 KB max sans perte visible.
// Resize à 1920px max + JPEG qualité 80%.
async function compressImage(file, { maxWidth = 1920, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression échouée'));
          const newName = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], newName || 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Impossible de charger l\'image'));
    };
    img.src = objectUrl;
  });
}

export const api = {
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  meta: () => request('/api/meta'),
  secteurs: () => request('/api/secteurs'),
  lts: (secteur = '') => request(`/api/lts${qs({ secteur })}`),
  logements: (params = {}) => request(`/api/logements${qs(params)}`),
  logement: (id) => request(`/api/logements/${encodeURIComponent(id)}`),
  updatePatrimoine: (id, payload) => request(`/api/logements/${encodeURIComponent(id)}/patrimoine`, { method: 'PUT', body: JSON.stringify(payload) }),
  logementConfiguration: (id) => request(`/api/logements/${encodeURIComponent(id)}/configuration`),
  updateLogementConfiguration: (id, payload) => request(`/api/logements/${encodeURIComponent(id)}/configuration`, { method: 'PUT', body: JSON.stringify(payload) }),
  createPiece: (id, payload) => request(`/api/logements/${encodeURIComponent(id)}/pieces`, { method: 'POST', body: JSON.stringify(payload) }),
  updatePiece: (id, pieceId, payload) => request(`/api/logements/${encodeURIComponent(id)}/pieces/${encodeURIComponent(pieceId)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  diagnosticTemplateLogement: (id) => request(`/api/logements/${encodeURIComponent(id)}/diagnostic-template`),
  diagnostics: (params = {}) => request(`/api/diagnostics${qs(params)}`),
  diagnostic: (id) => request(`/api/diagnostics/${encodeURIComponent(id)}`),
  createDiagnostic: (payload) => request('/api/diagnostics', { method: 'POST', body: JSON.stringify(payload) }),
  updateDiagnostic: (id, payload) => request(`/api/diagnostics/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  validateDiagnostic: (id, payload = {}) => request(`/api/diagnostics/${encodeURIComponent(id)}/validate`, { method: 'POST', body: JSON.stringify(payload) }),
  dashboard: (params = {}) => request(`/api/dashboard${qs(params)}`),
  uploadPhoto: async (file, metadata = {}) => {
    // Compresser si c'est une image (gagne ~×6 sur le quota Supabase)
    let payload = file;
    if (file && file.type && file.type.startsWith('image/')) {
      try {
        payload = await compressImage(file);
      } catch (err) {
        console.warn('Compression échouée, upload du fichier original:', err.message);
      }
    }
    const fd = new FormData();
    fd.append('photo', payload);
    Object.entries(metadata).forEach(([key, value]) => fd.append(key, value ?? ''));
    return request('/api/uploads', { method: 'POST', body: fd });
  },
  deletePhoto: (id) => request(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  devisList: (params = {}) => request(`/api/devis${qs(params)}`),
  devis: (id) => request(`/api/devis/${encodeURIComponent(id)}`),
  createDevis: (payload) => request('/api/devis', { method: 'POST', body: JSON.stringify(payload) }),
  updateDevis: (id, payload) => request(`/api/devis/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDevis: (id) => request(`/api/devis/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadDevisPdf: async (id, file) => {
    const fd = new FormData();
    fd.append('devisPdf', file);
    return request(`/api/devis/${encodeURIComponent(id)}/upload`, { method: 'POST', body: fd });
  },
  deleteDevisPdf: (id) => request(`/api/devis/${encodeURIComponent(id)}/upload`, { method: 'DELETE' }),
  archiveDiagnostics: (params = {}) => request(`/api/archive/diagnostics${qs(params)}`),
  archiveHistorique: (logementId) => request(`/api/archive/logement/${encodeURIComponent(logementId)}/historique`),
  audit: (params = {}) => request(`/api/audit${qs(params)}`),
  getConformite: (id) => request(`/api/logements/${encodeURIComponent(id)}/conformite`),
  updateConformite: (id, payload) => request(`/api/logements/${encodeURIComponent(id)}/conformite`, { method: 'PUT', body: JSON.stringify(payload) }),
  interventions: (params = {}) => request(`/api/interventions${qs(params)}`),
  intervention: (id) => request(`/api/interventions/${encodeURIComponent(id)}`),
  createIntervention: (payload) => request('/api/interventions', { method: 'POST', body: JSON.stringify(payload) }),
  updateIntervention: (id, payload) => request(`/api/interventions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteIntervention: (id) => request(`/api/interventions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadInterventionPhoto: async (id, file, { phase = 'apres', zone = '', element = '' } = {}) => {
    let payload = file;
    if (file && file.type && file.type.startsWith('image/')) {
      try { payload = await compressImage(file); } catch (err) { console.warn('Compression échouée:', err.message); }
    }
    const fd = new FormData();
    fd.append('photo', payload);
    fd.append('phase', phase);
    if (zone) fd.append('zone', zone);
    if (element) fd.append('element', element);
    return request(`/api/interventions/${encodeURIComponent(id)}/photos`, { method: 'POST', body: fd });
  },
  timeline: (logementId) => request(`/api/logements/${encodeURIComponent(logementId)}/timeline`),
  statsImpact: (annee) => request(`/api/stats/impact${annee ? '?annee=' + annee : ''}`),
  logementsWithCoords: () => request('/api/carto/logements'),
  geocodeStatus: () => request('/api/admin/geocode-status'),
  geocodeBatch: (limit = 50) => request('/api/admin/geocode-batch', { method: 'POST', body: JSON.stringify({ limit }) }),
  geocodeLogement: (id, payload = {}) => request(`/api/logements/${encodeURIComponent(id)}/geocode`, { method: 'POST', body: JSON.stringify(payload) }),
  updateCaracteristiques: (id, payload) => request(`/api/logements/${encodeURIComponent(id)}/caracteristiques`, { method: 'PUT', body: JSON.stringify(payload) }),
  signDiagnostic: (id, payload) => request(`/api/diagnostics/${encodeURIComponent(id)}/signature`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteSignature: (diagnosticId, sigId, payload = {}) => request(`/api/diagnostics/${encodeURIComponent(diagnosticId)}/signature/${encodeURIComponent(sigId)}`, { method: 'DELETE', body: JSON.stringify(payload) }),
  verifySignatures: (id) => request(`/api/diagnostics/${encodeURIComponent(id)}/signatures/verify`)
};
