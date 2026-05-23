import React, { useEffect, useState } from 'react';
import { subscribeConfirm, resolveConfirm } from '../services/confirm';

export default function ConfirmDialog() {
  const [state, setState] = useState(null);
  useEffect(() => subscribeConfirm(setState), []);
  if (!state) return null;
  return (
    <div className="modalOverlay" onClick={(e) => { if (e.target === e.currentTarget) resolveConfirm(false); }}>
      <div className="modalContent confirmCard">
        <h3 className="confirmTitle">{state.title}</h3>
        <p className="confirmMessage">{state.message}</p>
        <div className="confirmActions">
          <button className="secondary" onClick={() => resolveConfirm(false)}>{state.cancelLabel}</button>
          <button className={state.danger ? 'confirmDanger' : 'primary'} onClick={() => resolveConfirm(true)}>{state.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
