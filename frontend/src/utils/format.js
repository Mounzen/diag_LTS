export const money = (value) => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
}).format(Number(value || 0));

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function label(list, value) {
  return list.find(([key]) => key === value)?.[1] || value || 'Non renseigné';
}

export function roleLabel(role) {
  return { agent: 'Agent', responsable: 'Responsable', admin: 'Admin', chef: 'Responsable', lecture_seule: 'Lecture seule' }[role] || role;
}

export function badgeClass(value) {
  return `badge ${String(value || '').replaceAll('_', '-')}`;
}

export function patrimoineLabel(meta, value) {
  return meta?.patrimoine?.statuts?.find((item) => item.value === value)?.badge || value || 'À vérifier';
}
