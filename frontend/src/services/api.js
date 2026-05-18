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
    const fd = new FormData();
    fd.append('photo', file);
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
  archiveHistorique: (logementId) => request(`/api/archive/logement/${encodeURIComponent(logementId)}/historique`)
};
