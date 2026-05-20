import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { listQueue, removeFromQueue, countQueue } from '../utils/offlineStore';
import { API_URL } from '../services/api';

async function rejouerQueue(setSyncing, setQueueCount, setMessage) {
  setSyncing(true);
  const items = await listQueue();
  let success = 0;
  let failed = 0;
  for (const op of items) {
    try {
      const res = await fetch(`${API_URL}${op.path}`, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: op.body ? JSON.stringify(op.body) : undefined
      });
      if (res.ok) {
        await removeFromQueue(op.id);
        success += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  setSyncing(false);
  const c = await countQueue();
  setQueueCount(c);
  if (success > 0) {
    setMessage(`${success} opération${success > 1 ? 's' : ''} synchronisée${success > 1 ? 's' : ''}`);
    setTimeout(() => setMessage(''), 4000);
  }
  if (failed > 0) {
    setMessage(`${failed} échec${failed > 1 ? 's' : ''} — il faudra réessayer`);
    setTimeout(() => setMessage(''), 6000);
  }
}

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  // Compter les opérations en attente
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const c = await countQueue().catch(() => 0);
      if (mounted) setQueueCount(c);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Sync auto au retour en ligne
  useEffect(() => {
    if (online && queueCount > 0 && !syncing) {
      rejouerQueue(setSyncing, setQueueCount, setMessage);
    }
  }, [online, queueCount, syncing]);

  if (online && queueCount === 0 && !message) return null;

  return (
    <div className={`offlineBanner ${online ? 'banner-online' : 'banner-offline'}`}>
      {!online && (
        <span><WifiOff size={14} /> Mode hors ligne — Vos saisies sont conservées localement</span>
      )}
      {online && queueCount > 0 && (
        <span>
          <RefreshCw size={14} className={syncing ? 'spinning' : ''} />
          {syncing ? `Synchronisation en cours…` : `${queueCount} opération${queueCount > 1 ? 's' : ''} en attente`}
          {!syncing && (
            <button className="bannerBtn" onClick={() => rejouerQueue(setSyncing, setQueueCount, setMessage)}>Synchroniser maintenant</button>
          )}
        </span>
      )}
      {message && online && queueCount === 0 && (
        <span><CheckCircle2 size={14} /> {message}</span>
      )}
    </div>
  );
}
