import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribe, dismissToast } from '../services/toast';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

export default function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribe(setItems), []);
  if (!items.length) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={18} className="toast-icon" />
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
