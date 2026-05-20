import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Save, X } from 'lucide-react';
import { api } from '../services/api';

/**
 * Composant canvas pour signature électronique tactile.
 * Props :
 *  - diagnosticId : id du diagnostic à signer
 *  - role : 'agent_terrain' | 'responsable' | 'direction'
 *  - user : utilisateur connecté (pour agentId, agentNom)
 *  - onSigned(signature) : callback succès
 *  - onCancel() : callback annulation
 */
export default function SignaturePad({ diagnosticId, role, user, onSigned, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const ROLE_LABELS = {
    agent_terrain: 'Agent terrain',
    responsable: 'Responsable',
    direction: 'Direction'
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ajuster la taille au pixel ratio pour éviter le flou sur écrans HDPI
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#172033';
    // Fond blanc
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setEmpty(false);
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stop() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  }

  async function submit() {
    if (empty) {
      setError('Veuillez signer avant de valider.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const result = await api.signDiagnostic(diagnosticId, {
        role,
        signatureDataUrl: dataUrl,
        agentId: user?.id || null,
        agentNom: user?.prenom || user?.nom || '',
        commentaire
      });
      if (onSigned) onSigned(result);
    } catch (err) {
      setError(err.message || 'Erreur lors de la signature');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="signaturePad">
      <h3>Signature — {ROLE_LABELS[role] || role}</h3>
      <p className="muted">Signez ci-dessous au doigt ou à la souris. La signature sera horodatée et le contenu du diagnostic sera figé par hash cryptographique.</p>

      <div className="signatureCanvasWrap">
        <canvas
          ref={canvasRef}
          className="signatureCanvas"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={stop}
        />
        {empty && <span className="signatureHint">— Signez ici —</span>}
      </div>

      <label className="signatureCommentaire">
        Commentaire (optionnel)
        <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ex: visa après vérification" />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="signatureActions">
        <button type="button" onClick={clear} className="secondary"><Eraser size={16} /> Effacer</button>
        <button type="button" onClick={onCancel} disabled={saving}><X size={16} /> Annuler</button>
        <button type="button" onClick={submit} disabled={saving || empty} className="primary"><Save size={16} /> {saving ? 'Signature en cours...' : 'Apposer la signature'}</button>
      </div>
    </div>
  );
}
