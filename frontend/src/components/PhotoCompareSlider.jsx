import React, { useState, useRef } from 'react';
import { assetUrl } from '../services/api';

/**
 * Slider de comparaison photo avant/après.
 * Drag horizontal pour faire glisser le voile entre les 2 images.
 * Props: photoAvant (object {url}), photoApres (object {url}), labelAvant, labelApres.
 */
export default function PhotoCompareSlider({ photoAvant, photoApres, labelAvant = 'Avant', labelApres = 'Après' }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  function move(clientX) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }

  function onMouseDown(e) {
    dragging.current = true;
    move(e.clientX);
    e.preventDefault();
  }
  function onMouseMove(e) { if (dragging.current) move(e.clientX); }
  function onMouseUp() { dragging.current = false; }
  function onTouchStart(e) { dragging.current = true; move(e.touches[0].clientX); }
  function onTouchMove(e) { if (dragging.current) move(e.touches[0].clientX); }

  if (!photoAvant && !photoApres) {
    return <p className="muted">Aucune photo de comparaison.</p>;
  }
  if (!photoAvant) {
    return (
      <div className="singlePhoto">
        <img src={assetUrl(photoApres.url)} alt={labelApres} />
        <span className="photoTag">{labelApres}</span>
      </div>
    );
  }
  if (!photoApres) {
    return (
      <div className="singlePhoto">
        <img src={assetUrl(photoAvant.url)} alt={labelAvant} />
        <span className="photoTag">{labelAvant}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="photoSlider"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onMouseUp}
    >
      <img src={assetUrl(photoApres.url)} alt={labelApres} className="photoFull" />
      <div className="photoCover" style={{ width: `${position}%` }}>
        <img src={assetUrl(photoAvant.url)} alt={labelAvant} className="photoFull" />
      </div>
      <div
        className="photoSliderHandle"
        style={{ left: `${position}%` }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <span className="handleBar" />
      </div>
      <span className="photoTag tagLeft">{labelAvant}</span>
      <span className="photoTag tagRight">{labelApres}</span>
    </div>
  );
}
