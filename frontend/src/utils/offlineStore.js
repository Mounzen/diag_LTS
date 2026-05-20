// Wrapper IndexedDB ultra simple pour stocker les drafts de diagnostics + queue de sync
const DB_NAME = 'diag-lts-offline';
const DB_VERSION = 1;
const STORE_DRAFTS = 'diagnostic_drafts';
const STORE_QUEUE = 'pending_saves';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const db = await openDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

// === Drafts (état local des diagnostics en cours de saisie) ===

export async function saveDraftLocal(diagnostic) {
  if (!diagnostic?.id) return;
  const store = await tx(STORE_DRAFTS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ ...diagnostic, savedLocallyAt: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadDraftLocal(id) {
  const store = await tx(STORE_DRAFTS);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraftLocal(id) {
  const store = await tx(STORE_DRAFTS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// === Queue de sync (opérations à rejouer au retour en ligne) ===

export async function enqueueOperation(op) {
  // op = { method, path, body, label, createdAt }
  const store = await tx(STORE_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add({ ...op, createdAt: op.createdAt || new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listQueue() {
  const store = await tx(STORE_QUEUE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeFromQueue(id) {
  const store = await tx(STORE_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countQueue() {
  const store = await tx(STORE_QUEUE);
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueue() {
  const store = await tx(STORE_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
