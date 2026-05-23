// Boîte de confirmation maison (basée sur une promesse) — remplace window.confirm().
// Usage : if (!(await confirmDialog('Supprimer ?', { danger: true }))) return;

let state = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(state);
}

export function subscribeConfirm(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    state = {
      message: String(message),
      title: opts.title || 'Confirmation',
      confirmLabel: opts.confirmLabel || 'Confirmer',
      cancelLabel: opts.cancelLabel || 'Annuler',
      danger: opts.danger || false,
      resolve
    };
    emit();
  });
}

export function resolveConfirm(value) {
  if (!state) return;
  const { resolve } = state;
  state = null;
  emit();
  resolve(value);
}
