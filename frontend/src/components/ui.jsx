import React from 'react';
import { RefreshCw } from 'lucide-react';
import BrandLogo from './BrandLogo';

export function Select({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tous</option>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

export function Fact({ label, value }) {
  return <div className="fact"><span>{label}</span><strong>{value || 'Non renseigné'}</strong></div>;
}

export function Kpi({ icon: Icon, label, value }) {
  return <article className="kpi"><Icon size={20} /><span>{label}</span><strong>{value}</strong></article>;
}

export function EmptyState({ icon: Icon, title, text }) {
  return <div className="panel empty"><Icon size={42} /><h2>{title}</h2><p>{text}</p></div>;
}

export function Loading({ text }) {
  return <div className="panel loading"><BrandLogo variant="markLight" className="loadingLogo" /><RefreshCw size={22} /><span>{text}</span></div>;
}

export function ListCard({ title, rows = [], left, right, moneyRight = false, formatMoney }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length === 0 && <p className="muted">Aucune donnée.</p>}
      {rows.map((row) => <div className="line" key={`${row[left]}-${row[right]}`}><span>{row[left]}</span><strong>{moneyRight ? formatMoney(row[right]) : row[right]}</strong></div>)}
    </section>
  );
}
