// Mini système de notifications (« toasts ») — pub/sub, sans dépendance.
// Remplace les alert() natifs par des notifications intégrées non bloquantes.
// Usage : import { toast } from '../services/toast';  toast.error('...');

let toasts = [];
const listeners = new Set();
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message, type = 'info', duration) {
  const id = nextId++;
  const ms = duration ?? (type === 'error' ? 7000 : 4500);
  toasts = [...toasts, { id, message: String(message), type }];
  emit();
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

toast.success = (m, d) => toast(m, 'success', d);
toast.error = (m, d) => toast(m, 'error', d);
toast.warning = (m, d) => toast(m, 'warning', d);
toast.info = (m, d) => toast(m, 'info', d);
