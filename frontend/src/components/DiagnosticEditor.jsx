import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, Save } from 'lucide-react';
import { api, API_URL } from '../services/api';
import { ETATS, URGENCES } from '../config/options';
import { badgeClass, label, money } from '../utils/format';
import { Select } from './ui';

const ETAT_COEFS = {
  non_controle: 0,
  bon: 0,
  moyen: 0.35,
  degrade: 0.7,
  tres_degrade: 1,
  dangereux: 1.25,
  non_concerne: 0
};

const URGENCE_RANK = { faible: 1, moyenne: 2, haute: 3, urgente: 4 };

function estimatedCost(item) {
  const serverCost = Number(item.coutEstimatif || item.coutMoyen || 0);
  const base = Number(item.prixMoyen || item.prixBase || item.prix || 0);
  if (!base) return serverCost;
  const etatCoef = ETAT_COEFS[item.etat] ?? 0;
  const urgenceCoef = { faible: 1, moyenne: 1.1, haute: 1.25, urgente: 1.45 }[item.urgence] || 1;
  return Math.round(base * etatCoef * urgenceCoef);
}

function globalUrgence(items = []) {
  if (items.some((item) => item.etat === 'dangereux' || item.urgence === 'urgente')) return 'urgente';
  if (items.some((item) => item.etat === 'tres_degrade' || item.urgence === 'haute')) return 'haute';
  if (items.some((item) => item.etat === 'degrade' || item.urgence === 'moyenne')) return 'moyenne';
  return 'faible';
}

function saveTime(date) {
  return date ? new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'en attente';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DiagnosticEditor({ user, meta, logement, diagnostic, onBack, onSaved }) {
  const [draft, setDraft] = useState(diagnostic);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(!diagnostic.id);
  const [lastSavedAt, setLastSavedAt] = useState(diagnostic.dateModification || null);
  const [message, setMessage] = useState('');
  const draftRef = useRef(draft);
  const savingRef = useRef(false);
  const etatOptions = meta?.etats?.map((item) => [item.value, item.label]) || ETATS;
  const urgenceOptions = meta?.urgences?.map((item) => [item.value, item.label]) || URGENCES;

  useEffect(() => {
    setDraft(diagnostic);
    setDirty(!diagnostic.id);
    setLastSavedAt(diagnostic.dateModification || null);
  }, [diagnostic.id]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const groups = useMemo(() => {
    const byZone = new Map();
    for (const item of draft.items || []) {
      if (!byZone.has(item.zone)) byZone.set(item.zone, []);
      byZone.get(item.zone).push(item);
    }
    return [...byZone.entries()];
  }, [draft.items]);

  const report = useMemo(() => {
    const items = draft.items || [];
    const controlled = items.filter((item) => !['non_controle', 'non_concerne'].includes(item.etat)).length;
    const total = items.reduce((sum, item) => sum + estimatedCost(item), 0);
    const urgence = globalUrgence(items);
    const priorityItems = items
      .filter((item) => ['degrade', 'tres_degrade', 'dangereux'].includes(item.etat) || ['haute', 'urgente'].includes(item.urgence))
      .sort((a, b) => (URGENCE_RANK[b.urgence] || 0) - (URGENCE_RANK[a.urgence] || 0) || estimatedCost(b) - estimatedCost(a))
      .slice(0, 5);
    const photos = items.reduce((sum, item) => sum + (item.photos?.length || 0), 0);
    const progress = items.length ? Math.round((controlled / items.length) * 100) : 0;
    const state = items.some((item) => item.etat === 'dangereux') ? 'Dangereux'
      : items.some((item) => item.etat === 'tres_degrade') ? 'Très dégradé'
        : items.some((item) => item.etat === 'degrade') ? 'Dégradé'
          : controlled ? 'Contrôle en cours' : 'Non contrôlé';
    return {
      controlled,
      progress,
      total,
      urgence,
      priorityItems,
      photos,
      state,
      preconisation: priorityItems.length
        ? `Prioriser ${priorityItems[0].element || priorityItems[0].item} (${label(URGENCES, priorityItems[0].urgence)}).`
        : 'Aucune intervention prioritaire détectée.'
    };
  }, [draft.items]);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => saveDraft('auto', draftRef.current), 1200);
    return () => clearTimeout(timer);
  }, [dirty, draft]);

  function markDirty(nextDraft) {
    setDraft(nextDraft);
    setDirty(true);
  }

  function patchItem(id, patch) {
    markDirty({
      ...draftRef.current,
      statut: draftRef.current.statut === 'valide_responsable' ? 'a_verifier_responsable' : 'brouillon_agent',
      items: (draftRef.current.items || []).map((item) => item.id === id ? { ...item, ...patch } : item)
    });
  }

  async function saveDraft(reason = 'manual', sourceDraft = draftRef.current) {
    if (savingRef.current) return sourceDraft;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        ...sourceDraft,
        logementId: logement.id,
        agentId: user.id,
        agent: user,
        statut: sourceDraft.statut || 'brouillon_agent'
      };
      const saved = sourceDraft.id ? await api.updateDiagnostic(sourceDraft.id, payload) : await api.createDiagnostic(payload);
      draftRef.current = saved;
      setDraft(saved);
      setDirty(false);
      setLastSavedAt(saved.dateModification || new Date().toISOString());
      if (reason !== 'auto') {
        setMessage('Diagnostic sauvegardé');
        await onSaved(saved);
      }
      return saved;
    } catch (err) {
      if (reason !== 'auto') setMessage(err.message);
      return sourceDraft;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function ensureSavedDraft() {
    while (savingRef.current) await wait(120);
    if (draftRef.current.id && !dirty) return draftRef.current;
    return saveDraft('photo', draftRef.current);
  }

  async function validate(statut) {
    const blockingItem = (draft.items || []).find((item) => {
      const needsPhoto = ['degrade', 'tres_degrade', 'dangereux'].includes(item.etat) && !(item.photos || []).length;
      const needsComment = item.etat === 'dangereux' && !String(item.commentaire || '').trim();
      return needsPhoto || needsComment;
    });
    if (blockingItem) {
      setMessage(`À compléter : photo obligatoire si dégradé et commentaire obligatoire si dangereux (${blockingItem.zone} - ${blockingItem.element}).`);
      return;
    }
    setSaving(true);
    try {
      const saved = draft.id
        ? await api.validateDiagnostic(draft.id, { agentId: user.id, agent: user, statut })
        : await api.createDiagnostic({ ...draft, logementId: logement.id, agentId: user.id, agent: user, statut });
      setDraft(saved);
      setDirty(false);
      setLastSavedAt(saved.dateModification || new Date().toISOString());
      setMessage(statut === 'valide_responsable' ? 'Diagnostic validé responsable' : 'Diagnostic terminé');
      await onSaved(saved);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addPhoto(item, file, source = 'terrain') {
    if (!file) return;
    setUploading(true);
    try {
      const savedDraft = await ensureSavedDraft();
      const photo = await api.uploadPhoto(file, {
        logementId: logement.id,
        diagnosticId: savedDraft.id,
        zone: item.zone,
        element: item.element,
        pieceId: item.pieceId || '',
        elementId: item.id,
        agentId: user.id,
        agentNom: user.prenom || user.nom || '',
        source
      });
      markDirty({
        ...draftRef.current,
        statut: draftRef.current.statut === 'valide_responsable' ? 'a_verifier_responsable' : 'brouillon_agent',
        photos: [...(draftRef.current.photos || []), photo],
        items: (draftRef.current.items || []).map((currentItem) => (
          currentItem.id === item.id
            ? { ...currentItem, photos: [...new Set([...(currentItem.photos || []), photo.url])] }
            : currentItem
        ))
      });
      setMessage('Photo enregistrée');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(item, url) {
    await api.deletePhoto(url);
    markDirty({
      ...draftRef.current,
      statut: draftRef.current.statut === 'valide_responsable' ? 'a_verifier_responsable' : 'brouillon_agent',
      photos: (draftRef.current.photos || []).filter((photo) => (typeof photo === 'string' ? photo !== url : photo.url !== url)),
      items: (draftRef.current.items || []).map((currentItem) => (
        currentItem.id === item.id
          ? { ...currentItem, photos: (currentItem.photos || []).filter((photoUrl) => photoUrl !== url) }
          : currentItem
      ))
    });
  }

  return (
    <div className="diagnosticMobile">
      <section className="panel editor">
        <div className="sectionTitle sticky diagnosticHeader">
          <div>
            <button className="linkBtn" type="button" onClick={onBack}><ArrowLeft size={18} /> Fiche logement</button>
            <h1>Diagnostic {logement.code_acces}</h1>
            <p>{report.progress}% contrôlé · {money(report.total)}</p>
            <span className="saveState">{saving ? 'Sauvegarde...' : `Dernière sauvegarde : ${saveTime(lastSavedAt)}`}</span>
          </div>
          <span className="progressRing">{report.progress}%</span>
        </div>

        <section className="reportPanel mobileReportTop">
          <h2>Rapport automatique</h2>
          <div className="reportGrid">
            <div><span>État général</span><strong>{report.state}</strong></div>
            <div><span>Urgence</span><strong className={badgeClass(report.urgence)}>{label(URGENCES, report.urgence)}</strong></div>
            <div><span>Budget estimé</span><strong>{money(report.total)}</strong></div>
            <div><span>Photos</span><strong>{report.photos}</strong></div>
          </div>
          <p>{report.preconisation}</p>
          <div className="priorityList">
            {report.priorityItems.map((item) => (
              <span key={item.id}>{item.zone} · {item.element} · {money(estimatedCost(item))}</span>
            ))}
          </div>
        </section>

        {groups.map(([zone, items]) => (
          <section className="zoneBlock" key={zone}>
            <div className="zoneHeader"><h2>{zone}</h2><strong>{money(items.reduce((sum, item) => sum + estimatedCost(item), 0))}</strong></div>
            {items.map((item) => (
              <article className="diagItem" key={item.id}>
                <div><strong>{item.element}</strong>{item.pieceNom && <small>{item.pieceNom}</small>}<small>{item.travauxProposes || 'Travaux proposés calculés à la sauvegarde'}</small></div>
                <Select label="État" value={item.etat} onChange={(value) => patchItem(item.id, { etat: value })} options={etatOptions} />
                <Select label="Urgence" value={item.urgence} onChange={(value) => patchItem(item.id, { urgence: value })} options={urgenceOptions} />
                <label className="full">Commentaire{item.etat === 'dangereux' && <small className="requiredText">Obligatoire si dangereux</small>}<textarea required={item.etat === 'dangereux'} value={item.commentaire || ''} onChange={(event) => patchItem(item.id, { commentaire: event.target.value })} /></label>
                <div className="photoActions">
                  <label className="uploadBtn primaryPhoto"><Camera size={18} /> Prendre photo<input type="file" accept="image/*" capture="environment" onChange={(event) => { addPhoto(item, event.target.files?.[0], 'terrain'); event.target.value = ''; }} /></label>
                  <label className="uploadBtn"><ImagePlus size={18} /> Importer<input type="file" accept="image/*" onChange={(event) => { addPhoto(item, event.target.files?.[0], 'galerie'); event.target.value = ''; }} /></label>
                  {uploading && <span className="muted">Envoi photo...</span>}
                  {['degrade', 'tres_degrade', 'dangereux'].includes(item.etat) && !(item.photos || []).length && <span className="requiredText">Photo obligatoire</span>}
                </div>
                <span className="estimate">{money(estimatedCost(item))}</span>
                {item.photos?.length > 0 && <div className="thumbs">{item.photos.map((url) => <span className="thumb" key={url}><img src={`${API_URL}${url}`} alt="" /><button type="button" onClick={() => removePhoto(item, url)}>Supprimer</button></span>)}</div>}
              </article>
            ))}
          </section>
        ))}
        <label>Commentaire général<textarea className="generalComment" value={draft.commentaireGeneral || ''} onChange={(event) => markDirty({ ...draftRef.current, commentaireGeneral: event.target.value })} /></label>
        <div className="actions stickyBottom diagnosticActions">
          <button className="secondary" type="button" onClick={() => saveDraft('manual')} disabled={saving}><Save size={18} /> Sauvegarder</button>
          <button type="button" onClick={() => validate('diagnostic_termine')} disabled={saving}><CheckCircle2 size={18} /> Terminer</button>
          {['responsable', 'admin'].includes(user.role) && draft.id && <button type="button" onClick={() => validate('valide_responsable')} disabled={saving}><CheckCircle2 size={18} /> Valider</button>}
        </div>
        {message && <p className="notice">{message}</p>}
      </section>
    </div>
  );
}
