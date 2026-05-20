import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, PenLine, Save, ShieldCheck } from 'lucide-react';
import { api, assetUrl } from '../services/api';
import SignaturePad from './SignaturePad';
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

const UNITE_OPTIONS = [['u', 'U (unité)'], ['ml', 'ML (mètre linéaire)'], ['m2', 'm² (surface)'], ['forfait', 'Forfait']];
const OUVRANT_OPTIONS = [['', '—'], ['1_vantail', '1 vantail (simple)'], ['2_vantaux', '2 vantaux (double)']];
const MATERIAU_PORTE_OPTIONS = [
  ['', '—'],
  ['pleine_bois', 'Pleine bois'],
  ['pleine_alu', 'Pleine alu'],
  ['vitree', 'Vitrée'],
  ['mixte', 'Mixte (vitrée + pleine)'],
  ['isoplane', 'Isoplane (porte intérieure)'],
  ['jalousie_alu', 'Jalousie alu'],
  ['jalousie_bois', 'Jalousie bois']
];
const MATERIAU_FENETRE_OPTIONS = [
  ['', '—'],
  ['vitree_simple', 'Vitrée simple'],
  ['double_vitrage', 'Double vitrage'],
  ['coulissante', 'Coulissante'],
  ['jalousie_alu', 'Jalousie alu'],
  ['jalousie_bois', 'Jalousie bois']
];
const VOLET_OPTIONS = [['', '—'], ['aucun', 'Aucun'], ['plein_ext', 'Volet plein extérieur'], ['vitre_int', 'Volet vitré intérieur'], ['plein_ext_vitre_int', 'Plein ext. + vitré int.']];
const SOL_OPTIONS = [
  ['', '—'],
  ['carrelage', 'Carrelage'],
  ['beton', 'Béton brut / dalle'],
  ['parquet', 'Parquet bois'],
  ['parquet_stratifie', 'Parquet stratifié'],
  ['lino', 'Linoléum / PVC'],
  ['tomette', 'Tomette / pierre'],
  ['moquette', 'Moquette']
];

function isPorte(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('porte') || e.includes('portillon');
}
function isFenetre(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('fenêtre') || e.includes('fenetre') || e.includes('vitrage') || e.includes('baie');
}
function isLineaire(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('clôture') || e.includes('cloture') || e.includes('plinthe') || e.includes('cheminement');
}
function isSurfacique(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('sol') || e.includes('mur') || e.includes('plafond') || e.includes('façade') || e.includes('peinture') || e.includes('faïence') || e.includes('faience') || e.includes('carrelage') || e.includes('toiture');
}
function isSol(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('sol');
}
function isJalousie(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('jalousie');
}
function isElectriqueCount(item) {
  const e = String(item?.element || '').toLowerCase();
  return e.includes('prise') || e.includes('interrupteur') || e.includes('luminaire') || e.includes('point lumineux');
}

function estimatedCost(item) {
  const serverCost = Number(item.coutEstimatif || item.coutMoyen || 0);
  const base = Number(item.prixMoyen || item.prixBase || item.prix || 0);
  if (!base) return serverCost;
  const etatCoef = ETAT_COEFS[item.etat] ?? 0;
  const urgenceCoef = { faible: 1, moyenne: 1.1, haute: 1.25, urgente: 1.45 }[item.urgence] || 1;
  return Math.round(base * etatCoef * urgenceCoef);
}

function estimatedCostRange(item) {
  // Si le serveur a fourni coutBas/coutMoyen/coutHaut directement, on les utilise
  if (item.coutBas !== undefined || item.coutHaut !== undefined) {
    return {
      bas: Number(item.coutBas || item.coutMoyen || 0),
      moyen: Number(item.coutMoyen || item.coutEstimatif || 0),
      haut: Number(item.coutHaut || item.coutMoyen || 0)
    };
  }
  // Sinon on calcule depuis prixBas/prixMoyen/prixHaut
  const etatCoef = ETAT_COEFS[item.etat] ?? 0;
  const urgenceCoef = { faible: 1, moyenne: 1.1, haute: 1.25, urgente: 1.45 }[item.urgence] || 1;
  const factor = etatCoef * urgenceCoef;
  const prixBas = Number(item.prixBas || item.prixMoyen || item.prix || 0);
  const prixMoyen = Number(item.prixMoyen || item.prixBase || item.prix || 0);
  const prixHaut = Number(item.prixHaut || item.prixMoyen || item.prix || 0);
  return {
    bas: Math.round(prixBas * factor),
    moyen: Math.round(prixMoyen * factor),
    haut: Math.round(prixHaut * factor)
  };
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
  const [signaturePanelRole, setSignaturePanelRole] = useState(null);
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
    const totals = items.reduce((acc, item) => {
      const r = estimatedCostRange(item);
      acc.bas += r.bas;
      acc.moyen += r.moyen;
      acc.haut += r.haut;
      return acc;
    }, { bas: 0, moyen: 0, haut: 0 });
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
      totals,
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
    const timer = setTimeout(() => saveDraft('auto', draftRef.current), 3500);
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
      setLastSavedAt(saved.dateModification || new Date().toISOString());
      if (reason === 'auto') {
        // Auto-save : ne PAS écraser le draft local (préserve les frappes en cours)
        // On synchronise juste l'id (pour les futures updates) si c'était une création
        if (!sourceDraft.id && saved.id) {
          draftRef.current = { ...draftRef.current, id: saved.id };
          setDraft((current) => ({ ...current, id: saved.id }));
        }
        // setDirty(false) : seulement si l'utilisateur n'a rien tapé depuis
        // On compare draftRef.current avec sourceDraft pour détecter
        if (draftRef.current === sourceDraft || JSON.stringify(draftRef.current.items) === JSON.stringify(sourceDraft.items)) {
          setDirty(false);
        }
      } else {
        // Save manuel ou validation : on accepte la version serveur
        draftRef.current = saved;
        setDraft(saved);
        setDirty(false);
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
      {signaturePanelRole && (
        <div className="modalOverlay" onClick={(e) => { if (e.target === e.currentTarget) setSignaturePanelRole(null); }}>
          <div className="modalContent">
            <SignaturePad
              diagnosticId={draft.id}
              role={signaturePanelRole}
              user={user}
              onSigned={(sig) => {
                setSignaturePanelRole(null);
                setMessage(`Signature ${sig.role} apposée avec succès`);
                // Re-fetch le diagnostic pour avoir les signatures à jour
                api.diagnostic(draft.id).then((updated) => {
                  draftRef.current = updated;
                  setDraft(updated);
                });
              }}
              onCancel={() => setSignaturePanelRole(null)}
            />
          </div>
        </div>
      )}
      {draft.signatures?.length > 0 && (
        <section className="signaturesPanel">
          <h3><ShieldCheck size={16} /> Signatures apposées</h3>
          <div className="signaturesList">
            {draft.signatures.map((sig) => (
              <div key={sig.id} className="signatureItem">
                <strong>{sig.role.replace('_', ' ')}</strong>
                <span>{sig.agentNom || '-'} · {new Date(sig.dateSignature).toLocaleString('fr-FR')}</span>
                <img src={sig.signatureUrl} alt={`Signature ${sig.role}`} />
                {sig.commentaire && <small>{sig.commentaire}</small>}
                <small className="hashLabel">Hash : <code>{sig.contentHash?.slice(0, 16)}...</code></small>
              </div>
            ))}
          </div>
        </section>
      )}

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
            <div><span>Budget estimé</span><strong>{money(report.total)}</strong><small className="costRange">Fourchette : {money(report.totals.bas)} - {money(report.totals.haut)}</small></div>
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

                {/* Détails pour devis : dimensions + types pour portes/fenêtres/sols */}
                {(() => {
                  const needsDims = isPorte(item) || isFenetre(item) || isJalousie(item) || isSurfacique(item) || isLineaire(item) || isElectriqueCount(item);
                  return (
                    <details className="dimensionsBlock" {...(needsDims ? { open: true } : {})}>
                      <summary>📐 Détails dimensions / type {needsDims ? '(requis pour devis)' : '(optionnel)'}</summary>
                      <div className="dimensionsGrid">
                        <Select label="Unité" value={item.unite || (isSol(item) || isSurfacique(item) ? 'm2' : isLineaire(item) ? 'ml' : 'u')} onChange={(value) => patchItem(item.id, { unite: value })} options={UNITE_OPTIONS} />
                        <label>{isElectriqueCount(item) ? 'Nombre' : 'Quantité'}<input type="number" min="0" step={isElectriqueCount(item) ? '1' : '0.01'} placeholder={isElectriqueCount(item) ? 'ex: 4' : ''} value={item.quantite ?? 1} onChange={(e) => patchItem(item.id, { quantite: Number(e.target.value) || 0 })} /></label>
                        {needsDims && !isElectriqueCount(item) && (
                          <>
                            <label>Hauteur (cm)<input type="number" min="0" placeholder="ex: 210" value={item.hauteur || ''} onChange={(e) => {
                              const h = Number(e.target.value) || 0;
                              const patch = { hauteur: h };
                              // Auto-calc quantité selon unité
                              if (item.unite === 'm2' && h > 0 && item.largeur > 0) {
                                patch.quantite = Math.round(h * item.largeur) / 10000;
                              }
                              patchItem(item.id, patch);
                            }} /></label>
                            <label>Largeur (cm)<input type="number" min="0" placeholder="ex: 90" value={item.largeur || ''} onChange={(e) => {
                              const l = Number(e.target.value) || 0;
                              const patch = { largeur: l };
                              if (item.unite === 'm2' && l > 0 && item.hauteur > 0) {
                                patch.quantite = Math.round(item.hauteur * l) / 10000;
                              } else if (item.unite === 'ml' && l > 0) {
                                patch.quantite = Math.round(l) / 100;
                              }
                              patchItem(item.id, patch);
                            }} /></label>
                            {item.hauteur > 0 && item.largeur > 0 && (
                              <div className="surfaceCalcul">
                                <span className="caracLabel">Surface calculée</span>
                                <strong>{((item.hauteur * item.largeur) / 10000).toFixed(2)} m²</strong>
                              </div>
                            )}
                          </>
                        )}
                        {isPorte(item) && (
                          <>
                            <Select label="Ouvrant" value={item.typeOuvrant || ''} onChange={(value) => patchItem(item.id, { typeOuvrant: value })} options={OUVRANT_OPTIONS} />
                            <Select label="Matériau porte" value={item.materiau || ''} onChange={(value) => patchItem(item.id, { materiau: value })} options={MATERIAU_PORTE_OPTIONS} />
                            <Select label="Volet" value={item.volet || ''} onChange={(value) => patchItem(item.id, { volet: value })} options={VOLET_OPTIONS} />
                          </>
                        )}
                        {isFenetre(item) && !isJalousie(item) && (
                          <>
                            <Select label="Type fenêtre" value={item.materiau || ''} onChange={(value) => patchItem(item.id, { materiau: value })} options={MATERIAU_FENETRE_OPTIONS} />
                            <Select label="Volet" value={item.volet || ''} onChange={(value) => patchItem(item.id, { volet: value })} options={VOLET_OPTIONS} />
                          </>
                        )}
                        {isJalousie(item) && (
                          <Select label="Matériau jalousie" value={item.materiau || ''} onChange={(value) => patchItem(item.id, { materiau: value })} options={[['', '—'], ['jalousie_alu', 'Alu'], ['jalousie_bois', 'Bois']]} />
                        )}
                        {isSol(item) && (
                          <Select label="Type de sol" value={item.materiau || ''} onChange={(value) => patchItem(item.id, { materiau: value })} options={SOL_OPTIONS} />
                        )}
                      </div>
                    </details>
                  );
                })()}

                <div className="photoActions">
                  <label className="uploadBtn primaryPhoto"><Camera size={18} /> Prendre photo<input type="file" accept="image/*" capture="environment" onChange={(event) => { addPhoto(item, event.target.files?.[0], 'terrain'); event.target.value = ''; }} /></label>
                  <label className="uploadBtn"><ImagePlus size={18} /> Importer<input type="file" accept="image/*" onChange={(event) => { addPhoto(item, event.target.files?.[0], 'galerie'); event.target.value = ''; }} /></label>
                  {uploading && <span className="muted">Envoi photo...</span>}
                  {['degrade', 'tres_degrade', 'dangereux'].includes(item.etat) && !(item.photos || []).length && <span className="requiredText">Photo obligatoire</span>}
                </div>
                <span className="estimate">{money(estimatedCost(item))}</span>
                {item.photos?.length > 0 && <div className="thumbs">{item.photos.map((url) => <span className="thumb" key={url}><img src={assetUrl(url)} alt="" /><button type="button" onClick={() => removePhoto(item, url)}>Supprimer</button></span>)}</div>}
              </article>
            ))}
          </section>
        ))}
        <label>Commentaire général<textarea className="generalComment" value={draft.commentaireGeneral || ''} onChange={(event) => markDirty({ ...draftRef.current, commentaireGeneral: event.target.value })} /></label>
        <div className="actions stickyBottom diagnosticActions">
          <button className="secondary" type="button" onClick={() => saveDraft('manual')} disabled={saving}><Save size={18} /> Sauvegarder</button>
          {draft.id && (
            <>
              <button className="secondary" type="button" onClick={() => setSignaturePanelRole('agent_terrain')}><PenLine size={18} /> Signer (agent)</button>
              {user?.role === 'responsable' && <button className="secondary" type="button" onClick={() => setSignaturePanelRole('responsable')}><PenLine size={18} /> Signer (responsable)</button>}
              {user?.role === 'admin' && (
                <>
                  <button className="secondary" type="button" onClick={() => setSignaturePanelRole('responsable')}><PenLine size={18} /> Signer (responsable)</button>
                  <button className="secondary" type="button" onClick={() => setSignaturePanelRole('direction')}><PenLine size={18} /> Signer (direction)</button>
                </>
              )}
            </>
          )}
          <button type="button" onClick={() => validate('diagnostic_termine')} disabled={saving}><CheckCircle2 size={18} /> Terminer</button>
          {['responsable', 'admin'].includes(user.role) && draft.id && <button type="button" onClick={() => validate('valide_responsable')} disabled={saving}><CheckCircle2 size={18} /> Valider</button>}
        </div>
        {message && <p className="notice">{message}</p>}
      </section>
    </div>
  );
}
